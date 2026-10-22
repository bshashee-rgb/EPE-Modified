import { Hono } from 'hono';
import { evaluate, resolveCompanions, parseCode, priceRows } from '../../server/engine.js';
import { getFxRates } from '../../server/fx.js';
import * as d from './data.js';
import { verifyCredentials, createSession, getSession, clearSession, hashPassword, verifyPassword } from './auth.js';

const app = new Hono();
const DB = (c) => c.env.DB;

// D1 occasionally rejects a write with a transient overload/timeout error under concurrent
// load rather than a data problem — retrying almost always succeeds on the 2nd/3rd attempt.
// Used for the currency-change write (PATCH /api/quotes/:id), the flow most exposed to this.
const isTransientD1Error = (e) => /D1 DB is overloaded|Requests queued for too long|Network connection lost/i.test(String(e?.cause?.message || e?.message || ''));
async function withD1Retry(fn, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); } catch (e) {
      if (i === attempts || !isTransientD1Error(e)) throw e;
      await new Promise((r) => setTimeout(r, 150 * i));
    }
  }
}

// ---- auth gate: everything under /api/* needs a session except login + ping.
const AUTH_EXEMPT = new Set(['/api/auth/login', '/api/ping']);
app.use('/api/*', async (c, next) => {
  if (AUTH_EXEMPT.has(c.req.path)) return next();
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Not signed in' }, 401);
  if (c.req.path.startsWith('/api/admin/') && session.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  c.set('session', session);
  return next();
});
// Server-derived actor for the audit trail (client X-Actor header is ignored).
const actor = (c) => c.get('session')?.name || c.get('session')?.sub || 'system';

// Unauthenticated liveness check — exempted above via AUTH_EXEMPT.
app.get('/api/ping', (c) => c.json({ ok: true }));

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const user = await verifyCredentials(DB(c), body.email, body.password);
  if (!user) return c.json({ error: 'Invalid email or password' }, 401);
  await createSession(c, user);
  return c.json({ email: user.email, name: user.name, role: user.role });
});
app.post('/api/auth/logout', async (c) => { clearSession(c); return c.json({ ok: true }); });
app.get('/api/auth/me', async (c) => {
  const s = c.get('session');
  return c.json({ email: s.sub, name: s.name, role: s.role });
});
app.post('/api/auth/change-password', async (c) => {
  const s = c.get('session');
  const body = await c.req.json().catch(() => ({}));
  const user = await verifyCredentials(DB(c), s.sub, body.current);
  if (!user) return c.json({ error: 'Current password is incorrect' }, 401);
  if (!body.next || String(body.next).length < 8) return c.json({ error: 'New password must be at least 8 characters' }, 400);
  const { hash, salt } = await hashPassword(String(body.next));
  await DB(c).prepare('UPDATE users SET password_hash=?, password_salt=? WHERE email=?').bind(hash, salt, user.email).run();
  return c.json({ ok: true });
});

// ---- finalized-quote guard & validation (server is the authority — NFR-3) ----
const QUOTE_STATUSES = ['Draft', 'Sent', 'Won', 'Lost', 'Expired'];
const CONTENT_FIELDS = ['customer_id', 'quote_date', 'validity_days', 'terms', 'notes', 'discount_pct', 'tax_pct', 'currency'];
const clampPct = (v) => Math.max(0, Math.min(100, Number.isFinite(+v) ? +v : 0));
const clampQty = (v) => { const n = +v; return Number.isFinite(n) && n > 0 ? n : 1; };

// ---- Attachments: any file type except an executable/script denylist (malware-storage risk).
const BLOCKED_EXTENSIONS = new Set(['.exe', '.js', '.mjs', '.cjs', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.com', '.scr', '.vbs', '.vbe', '.wsf', '.jar', '.apk', '.dll']);
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB
// Served with Content-Disposition: inline. text/html & image/svg+xml are deliberately excluded
// even though they aren't "dangerous" in the malware sense — rendering either inline at the
// app's own origin is a classic stored-XSS vector.
const INLINE_PREVIEW_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const ATTACHMENT_CATEGORIES = ['technical', 'costing', 'scan', 'other'];
const APPROVAL_DECISIONS = ['approved', 'rejected'];
const fileExt = (name) => { const m = /\.[^./\\]+$/.exec(String(name || '')); return m ? m[0].toLowerCase() : ''; };
// Strip path separators/control chars and cap length — used in the R2 key and in the
// Content-Disposition filename we echo back.
const sanitizeFileName = (name) => String(name || 'file').replace(/[\/\\]/g, '_').replace(/[\x00-\x1f]/g, '').slice(-180) || 'file';

// ---------- Catalogue ----------
app.get('/api/catalog', async (c) => {
  const categories = (await DB(c).prepare('SELECT * FROM categories ORDER BY sort').all()).results;
  const families = (await DB(c).prepare('SELECT id, category_id, code, name, description, datasheet_ref, kind, status, updated_at FROM families ORDER BY sort, name').all()).results;
  return c.json({ categories, families });
});

app.get('/api/families/:id/meta', async (c) => {
  const id = +c.req.param('id');
  const meta = await d.loadFamilyMeta(DB(c), id);
  if (!meta) return c.json({ error: 'family not found' }, 404);
  // spare parts linked to this family (any status) — used for the admin tab record count
  meta.spare_count = (await DB(c).prepare('SELECT COUNT(*) n FROM part_families WHERE family_id=?').bind(id).first()).n;
  return c.json(meta);
});

// Popularity: how frequently & recently each product family / part has been quoted.
// Score = time-decayed frequency: every quote line contributes 2^(-ageDays/halfLife),
// summed per item. Recent lines weigh most; many lines outscore a single old one.
app.get('/api/popularity', async (c) => {
  const HALF_LIFE_DAYS = 30;
  const lambda = Math.LN2 / HALF_LIFE_DAYS;
  const now = Date.now();
  // normalise 'YYYY-MM-DD' and 'YYYY-MM-DD HH:MM:SS' to a valid UTC instant
  const parseTs = (s) => {
    if (!s) return now;
    const iso = s.includes(' ') ? s.replace(' ', 'T') : (s.length <= 10 ? s + 'T00:00:00' : s);
    const t = Date.parse(iso + 'Z');
    return Number.isNaN(t) ? now : t;
  };
  const scoreMap = (rows) => {
    const m = {};
    for (const r of rows) {
      if (r.id == null) continue;
      const ageDays = Math.max(0, (now - parseTs(r.ts)) / 86400000);
      const w = Math.exp(-lambda * ageDays);
      if (!m[r.id]) m[r.id] = { id: r.id, score: 0, freq: 0, last: r.ts };
      m[r.id].score += w;
      m[r.id].freq += 1;
      if (r.ts && (!m[r.id].last || r.ts > m[r.id].last)) m[r.id].last = r.ts;
    }
    return m;
  };
  // exclude archived quotes; use the quote's issue/creation date for recency
  const famRows = (await DB(c).prepare(`SELECT l.family_id AS id, COALESCE(q.quote_date, q.created_at) AS ts
     FROM quote_lines l JOIN quotes q ON q.id=l.quote_id
     WHERE l.family_id IS NOT NULL AND q.archived=0`).all()).results;
  const partRows = (await DB(c).prepare(`SELECT l.part_id AS id, COALESCE(q.quote_date, q.created_at) AS ts
     FROM quote_lines l JOIN quotes q ON q.id=l.quote_id
     WHERE l.part_id IS NOT NULL AND q.archived=0`).all()).results;
  return c.json({ families: scoreMap(famRows), parts: scoreMap(partRows) });
});

// ---------- Configurator ----------
async function priceFor(DB, priceListId, familyId, effective, segments) {
  const bases = (await DB.prepare('SELECT * FROM base_prices WHERE price_list_id=? AND family_id=?').bind(priceListId, familyId).all()).results;
  const adders = (await DB.prepare('SELECT * FROM option_prices WHERE price_list_id=? AND family_id=?').bind(priceListId, familyId).all()).results;
  return priceRows(bases, adders, effective, segments);
}

app.post('/api/families/:id/evaluate', async (c) => {
  const meta = await d.loadFamilyMeta(DB(c), +c.req.param('id'));
  if (!meta) return c.json({ error: 'family not found' }, 404);
  // .catch(()=>({})): Express's json() treats an empty body as {}, Hono throws — keep Express semantics
  const body = await c.req.json().catch(() => ({}));
  const result = evaluate(meta, body.selections || {});
  const priceList = await d.activePriceList(DB(c));
  if (priceList && result.complete && !result.violations.length) {
    result.price = await priceFor(DB(c), priceList.id, meta.family.id, result.effective, meta.segments);
    result.price.currency = priceList.currency;
  }
  if (result.complete && !result.violations.length) {
    result.companions = resolveCompanions(meta, result.effective);
  }
  return c.json(result);
});

app.post('/api/families/:id/parse-code', async (c) => {
  const meta = await d.loadFamilyMeta(DB(c), +c.req.param('id'));
  if (!meta) return c.json({ error: 'family not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  return c.json(parseCode(meta, String(body.code || '')));
});

// Search families by name/code, or locate by pasted ordering code prefix
app.get('/api/search', async (c) => {
  const q = String(c.req.query('q') || '').trim();
  if (!q) return c.json({ families: [], parts: [] });
  const like = `%${q}%`;
  const families = (await DB(c).prepare('SELECT id, code, name, kind FROM families WHERE name LIKE ? OR code LIKE ? LIMIT 20').bind(like, like).all()).results;
  const parts = (await DB(c).prepare('SELECT id, part_number, name FROM parts WHERE part_number LIKE ? OR name LIKE ? LIMIT 20').bind(like, like).all()).results;
  return c.json({ families, parts });
});

// ---------- Parts ----------
app.get('/api/parts', async (c) => {
  const rows = (await DB(c).prepare(`SELECT p.*, f.name AS family_name,
      (SELECT amount FROM part_prices pp JOIN price_lists pl ON pl.id = pp.price_list_id AND pl.status='published' WHERE pp.part_id = p.id LIMIT 1) AS price
    FROM parts p LEFT JOIN families f ON f.id = p.family_id WHERE p.status='active' ORDER BY p.part_number`).all()).results;
  const out = [];
  for (const r of rows) out.push({ ...r, family_ids: await d.partFamilyIds(DB(c), r.id) });
  return c.json(out);
});

// ---------- Customers ----------
app.get('/api/customers', async (c) => c.json((await DB(c).prepare('SELECT * FROM customers ORDER BY name').all()).results));
app.post('/api/customers', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { name, contact, email, phone, address, gstin } = body;
  const r = await DB(c).prepare('INSERT INTO customers(name,contact,email,phone,address,gstin) VALUES (?,?,?,?,?,?)')
    .bind(name, contact || null, email || null, phone || null, address || null, gstin || null).run();
  const id = r.meta.last_row_id;
  await d.audit(DB(c), actor(c), 'create', 'customer', id);
  return c.json(await DB(c).prepare('SELECT * FROM customers WHERE id=?').bind(id).first());
});

// ---------- Quotes ----------
app.get('/api/quotes', async (c) => {
  // ?archived=1 includes archived (default excludes). `items` aggregates each quote's
  // line codes+descriptions so the client can search "by item" as well as by customer.
  const includeArchived = c.req.query('archived') === '1';
  const rows = (await DB(c).prepare(`SELECT q.*, c.name AS customer_name,
     (SELECT COUNT(*) FROM quote_lines l WHERE l.quote_id=q.id) AS line_count,
     (SELECT SUM(CASE WHEN l.poa=1 THEN 0 ELSE l.unit_price*l.qty*(1-l.discount_pct/100.0) END) FROM quote_lines l WHERE l.quote_id=q.id) AS subtotal,
     (SELECT MAX(l.poa) FROM quote_lines l WHERE l.quote_id=q.id) AS has_poa,
     (SELECT group_concat(l.ordering_code || ' ' || COALESCE(l.description,''), ' | ') FROM quote_lines l WHERE l.quote_id=q.id) AS items
   FROM quotes q LEFT JOIN customers c ON c.id=q.customer_id
   ${includeArchived ? '' : 'WHERE q.archived = 0'}
   ORDER BY q.id DESC`).all()).results;
  return c.json(rows);
});

// Archive (soft-hide, recoverable) / unarchive
app.post('/api/quotes/:id/archive', async (c) => {
  const id = +c.req.param('id');
  await DB(c).prepare("UPDATE quotes SET archived=1, updated_at=datetime('now'), updated_by=? WHERE id=?").bind(actor(c) || 'demo', id).run();
  await d.audit(DB(c), actor(c), 'archive', 'quote', id);
  return c.json(await DB(c).prepare('SELECT * FROM quotes WHERE id=?').bind(id).first());
});
app.post('/api/quotes/:id/unarchive', async (c) => {
  const id = +c.req.param('id');
  await DB(c).prepare("UPDATE quotes SET archived=0, updated_at=datetime('now'), updated_by=? WHERE id=?").bind(actor(c) || 'demo', id).run();
  await d.audit(DB(c), actor(c), 'unarchive', 'quote', id);
  return c.json(await DB(c).prepare('SELECT * FROM quotes WHERE id=?').bind(id).first());
});

// Delete PERMANENTLY (lines cascade). Distinct from archive — cannot be undone.
app.delete('/api/quotes/:id', async (c) => {
  const id = +c.req.param('id');
  const q = await DB(c).prepare('SELECT number, revision FROM quotes WHERE id=?').bind(id).first();
  if (!q) return c.json({ error: 'not found' }, 404);
  // purge this quote's per-quote history so a later rowid reuse can't inherit a stale timeline;
  // record the deletion under 'quote-deleted' so the global admin audit still keeps it.
  await DB(c).batch([
    DB(c).prepare('DELETE FROM quote_lines WHERE quote_id=?').bind(id),
    DB(c).prepare('DELETE FROM quotes WHERE id=?').bind(id),
    DB(c).prepare("DELETE FROM audit_log WHERE entity='quote' AND entity_id=?").bind(String(id)),
    DB(c).prepare('INSERT INTO audit_log(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)')
      .bind(actor(c) || 'demo', 'delete', 'quote-deleted', String(id), JSON.stringify({ number: q.number, revision: q.revision })),
  ]);
  return c.json({ ok: true });
});

app.post('/api/quotes', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { customer_id, notes } = body;
  const number = await d.nextQuoteNumber(DB(c));
  const r = await DB(c).prepare("INSERT INTO quotes(number, customer_id, notes, quote_date, created_by, updated_by) VALUES (?,?,?, date('now'), ?, ?)")
    .bind(number, customer_id || null, notes || null, actor(c), actor(c)).run();
  const newId = r.meta.last_row_id;
  await d.audit(DB(c), actor(c), 'create', 'quote', newId, { number });
  return c.json(await DB(c).prepare('SELECT * FROM quotes WHERE id=?').bind(newId).first());
});

// Per-quote change history (timeline)
app.get('/api/quotes/:id/audit', async (c) => {
  const id = +c.req.param('id');
  const rows = (await DB(c).prepare("SELECT id, at, actor, action, detail FROM audit_log WHERE entity='quote' AND entity_id=? ORDER BY id DESC").bind(String(id)).all()).results;
  return c.json(rows.map((r) => ({ ...r, detail: r.detail ? JSON.parse(r.detail) : null })));
});

// ---------- Attachments (files against a quote — technical workings, costing sheets, scans) ----------
// No requireDraft gate: attachments/approval are internal governance about the quote, not
// customer-facing commercial content, and must keep working after a quote is Sent (the main
// real-world use case) — same reasoning as why /archive and plain status changes are exempted.
app.get('/api/quotes/:id/attachments', async (c) => {
  const quoteId = +c.req.param('id');
  const rows = (await DB(c).prepare('SELECT * FROM attachments WHERE quote_id=? AND archived=0 ORDER BY uploaded_at DESC, id DESC').bind(quoteId).all()).results;
  return c.json(rows);
});

app.post('/api/quotes/:id/attachments', async (c) => {
  const quoteId = +c.req.param('id');
  const quote = await DB(c).prepare('SELECT id FROM quotes WHERE id=?').bind(quoteId).first();
  if (!quote) return c.json({ error: 'quote not found' }, 404);
  const form = await c.req.formData().catch(() => null);
  const file = form && form.get('file');
  if (!file || typeof file === 'string') return c.json({ error: 'file is required' }, 400);
  const category = ATTACHMENT_CATEGORIES.includes(form.get('category')) ? form.get('category') : 'other';
  const ext = fileExt(file.name);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return c.json({ error: `Files of type '${ext}' are not allowed for security reasons.` }, 400);
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return c.json({ error: `File is too large — maximum is ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB.` }, 400);
  }
  const r2Key = `q${quoteId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const mimeType = file.type || 'application/octet-stream';
  await c.env.ATTACHMENTS.put(r2Key, file.stream(), { httpMetadata: { contentType: mimeType } });
  const r = await DB(c).prepare(`INSERT INTO attachments(quote_id,file_name,mime_type,size_bytes,r2_key,category,uploaded_by)
      VALUES (?,?,?,?,?,?,?)`)
    .bind(quoteId, file.name, mimeType, file.size, r2Key, category, actor(c)).run();
  const newId = r.meta.last_row_id;
  await d.audit(DB(c), actor(c), 'upload-attachment', 'attachment', newId, { file_name: file.name, category });
  await d.audit(DB(c), actor(c), 'upload-attachment', 'quote', quoteId, { file_name: file.name, attachment_id: newId });
  return c.json(await DB(c).prepare('SELECT * FROM attachments WHERE id=?').bind(newId).first());
});

app.get('/api/attachments/:id', async (c) => {
  const id = +c.req.param('id');
  const row = await DB(c).prepare('SELECT * FROM attachments WHERE id=? AND archived=0').bind(id).first();
  if (!row) return c.json({ error: 'attachment not found' }, 404);
  const obj = await c.env.ATTACHMENTS.get(row.r2_key);
  if (!obj) return c.json({ error: 'file not found in storage' }, 404);
  const forceDownload = c.req.query('download') === '1';
  const inline = !forceDownload && INLINE_PREVIEW_MIME.has(row.mime_type);
  c.header('Content-Type', row.mime_type);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${sanitizeFileName(row.file_name)}"`);
  return c.body(obj.body);
});

app.delete('/api/attachments/:id', async (c) => {
  const id = +c.req.param('id');
  const row = await DB(c).prepare('SELECT * FROM attachments WHERE id=?').bind(id).first();
  if (!row) return c.json({ error: 'attachment not found' }, 404);
  await DB(c).prepare('UPDATE attachments SET archived=1 WHERE id=?').bind(id).run();
  await d.audit(DB(c), actor(c), 'remove-attachment', 'attachment', id, { file_name: row.file_name });
  await d.audit(DB(c), actor(c), 'remove-attachment', 'quote', row.quote_id, { file_name: row.file_name, attachment_id: id });
  return c.json({ ok: true });
});

// ---------- Manager approval (admin-only; reuses the existing admin role — no separate "manager" role) ----------
app.patch('/api/quotes/:id/approval', async (c) => {
  const session = c.get('session');
  if (session.role !== 'admin') return c.json({ error: 'Admin access required' }, 403);
  const id = +c.req.param('id');
  const quote = await DB(c).prepare('SELECT id FROM quotes WHERE id=?').bind(id).first();
  if (!quote) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  if (!APPROVAL_DECISIONS.includes(body.decision)) {
    return c.json({ error: `decision must be one of: ${APPROVAL_DECISIONS.join(', ')}` }, 400);
  }
  await DB(c).prepare('UPDATE quotes SET approval_status=?, approved_by=?, approved_at=datetime(\'now\'), approval_notes=? WHERE id=?')
    .bind(body.decision, actor(c), body.notes || null, id).run();
  await d.audit(DB(c), actor(c), body.decision === 'approved' ? 'approve' : 'reject', 'quote', id, { notes: body.notes || null });
  return c.json(await DB(c).prepare('SELECT * FROM quotes WHERE id=?').bind(id).first());
});

app.get('/api/quotes/:id', async (c) => {
  const id = +c.req.param('id');
  const quote = await DB(c).prepare('SELECT q.*, c.name AS customer_name, c.address AS customer_address, c.contact AS customer_contact, c.email AS customer_email FROM quotes q LEFT JOIN customers c ON c.id=q.customer_id WHERE q.id=?').bind(id).first();
  if (!quote) return c.json({ error: 'not found' }, 404);
  const lines = (await DB(c).prepare('SELECT l.*, f.name AS family_name FROM quote_lines l LEFT JOIN families f ON f.id=l.family_id WHERE l.quote_id=? ORDER BY l.line_no').bind(quote.id).all()).results;
  for (const l of lines) {
    l.config = l.config_json ? JSON.parse(l.config_json) : null;
    l.spec = l.spec_summary ? JSON.parse(l.spec_summary) : null;
    l.breakdown = l.price_breakdown ? JSON.parse(l.price_breakdown) : null;
    l.companions = l.companions_json ? JSON.parse(l.companions_json) : null;
  }
  return c.json({ quote, lines });
});

app.get('/api/fx-rates', async (c) => {
  try {
    const { rates, fetchedAt, stale } = await getFxRates();
    const currencies = Object.keys(rates).sort();
    return c.json({ base: 'INR', currencies, rates, fetchedAt, stale });
  } catch (e) {
    return c.json({ error: `Could not fetch live exchange rates: ${e.message}` }, 502);
  }
});

app.patch('/api/quotes/:id', async (c) => {
  const id = +c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const allowed = ['status', 'customer_id', 'quote_date', 'validity_days', 'terms', 'notes', 'discount_pct', 'tax_pct', 'currency', 'fx_rate'];
  const quote = await DB(c).prepare('SELECT * FROM quotes WHERE id=?').bind(id).first();
  if (!quote) return c.json({ error: 'not found' }, 404);
  if ('status' in body && !QUOTE_STATUSES.includes(body.status)) {
    return c.json({ error: `Invalid status '${body.status}'. Allowed: ${QUOTE_STATUSES.join(', ')}.` }, 400);
  }
  // Field-aware finalize guard: content edits are blocked on a non-Draft quote, but
  // status transitions and archive/unarchive stay allowed (BUG-1).
  if (quote.status !== 'Draft' && CONTENT_FIELDS.some((k) => k in body)) {
    return c.json({ error: `Quote ${quote.number} Rev ${quote.revision} is ${quote.status} and locked — save a new revision or a new quote to edit its contents.` }, 409);
  }
  if ('discount_pct' in body) body.discount_pct = clampPct(body.discount_pct);
  if ('tax_pct' in body) body.tax_pct = clampPct(body.tax_pct);
  // Currency is paired with a live-fetched fx_rate snapshot, set together so a quote's
  // converted total stays fixed once set (and locks with everything else once finalized).
  if ('currency' in body) {
    let rates;
    try {
      rates = (await getFxRates()).rates;
    } catch (e) {
      return c.json({ error: `Could not fetch live exchange rates: ${e.message}` }, 502);
    }
    if (rates[body.currency] == null) {
      return c.json({ error: `Unsupported currency '${body.currency}'.` }, 400);
    }
    body.fx_rate = rates[body.currency];
  }
  const sets = [], vals = [];
  for (const k of allowed) if (k in body) { sets.push(`${k}=?`); vals.push(body[k]); }
  if (sets.length) {
    vals.push(actor(c), id);
    await withD1Retry(() => DB(c).prepare(`UPDATE quotes SET ${sets.join(',')}, updated_at=datetime('now'), updated_by=? WHERE id=?`).bind(...vals).run());
    // a status change reads differently from a content edit in the timeline
    const action = (Object.keys(body).length === 1 && 'status' in body) ? 'status' : 'update';
    await d.audit(DB(c), actor(c), action, 'quote', id, body);
  }
  return c.json(await DB(c).prepare('SELECT * FROM quotes WHERE id=?').bind(id).first());
});

// Shared: create a Draft copy of a quote (its lines included), issued today.
// mode 'revision' keeps the number and bumps the revision letter;
// mode 'newquote' assigns a fresh number at revision A.
async function copyQuote(DB, q, mode, actor) {
  const number = mode === 'revision' ? q.number : await d.nextQuoteNumber(DB);
  const revision = mode === 'revision' ? await d.nextRevision(DB, q.number) : 'A';
  if (mode === 'revision' && !revision) {
    return { error: { error: `Quote ${q.number} has reached its last revision letter (Z). Create a new quote instead.` }, status: 409 };
  }
  // One atomic batch (SRV-5): header + line copies + audit succeed or fail together.
  // The new header row is addressed by its UNIQUE(number, revision) key.
  const who = actor || 'demo';
  await DB.batch([
    DB.prepare(`INSERT INTO quotes(number,revision,customer_id,status,currency,fx_rate,quote_date,validity_days,terms,notes,discount_pct,tax_pct,created_by,updated_by)
      VALUES (?,?,?,?,?,?, date('now'), ?,?,?,?,?,?,?)`)
      .bind(number, revision, q.customer_id, 'Draft', q.currency, q.fx_rate, q.validity_days, q.terms, q.notes, q.discount_pct, q.tax_pct, who, who),
    DB.prepare(`INSERT INTO quote_lines(quote_id,line_no,kind,family_id,part_id,ordering_code,description,config_json,spec_summary,companions_json,qty,unit_price,price_breakdown,poa,availability,discount_pct)
      SELECT (SELECT id FROM quotes WHERE number=? AND revision=?), line_no, kind, family_id, part_id, ordering_code, description, config_json, spec_summary, companions_json, qty, unit_price, price_breakdown, poa, availability, discount_pct
      FROM quote_lines WHERE quote_id=? ORDER BY line_no`)
      .bind(number, revision, q.id),
    DB.prepare(`INSERT INTO audit_log(actor,action,entity,entity_id,detail)
      VALUES (?,?, 'quote', (SELECT id FROM quotes WHERE number=? AND revision=?), ?)`)
      .bind(who, mode === 'revision' ? 'revise' : 'clone', number, revision, JSON.stringify({ from: q.id, number, revision })),
  ]);
  return { quote: await DB.prepare('SELECT * FROM quotes WHERE number=? AND revision=?').bind(number, revision).first() };
}

// Revise: same number, next revision letter (Q-… Rev B)
app.post('/api/quotes/:id/revise', async (c) => {
  const id = +c.req.param('id');
  const q = await DB(c).prepare('SELECT * FROM quotes WHERE id=?').bind(id).first();
  if (!q) return c.json({ error: 'not found' }, 404);
  const result = await copyQuote(DB(c), q, 'revision', actor(c));
  if (result.error) return c.json(result.error, result.status);
  return c.json(result.quote);
});

// Clone: brand-new quote number, revision A (a separate quotation)
app.post('/api/quotes/:id/clone', async (c) => {
  const id = +c.req.param('id');
  const q = await DB(c).prepare('SELECT * FROM quotes WHERE id=?').bind(id).first();
  if (!q) return c.json({ error: 'not found' }, 404);
  const result = await copyQuote(DB(c), q, 'newquote', actor(c));
  if (result.error) return c.json(result.error, result.status);
  return c.json(result.quote);
});

// Add configured line
app.post('/api/quotes/:id/lines', async (c) => {
  const quoteId = +c.req.param('id');
  const g = await d.requireDraft(DB(c), quoteId);   // BUG-1: only Draft quotes accept new lines
  if (g.error) return c.json(g.error, g.status);
  const quote = g.quote;
  const body = await c.req.json().catch(() => ({}));
  const { kind } = body;
  const qty = clampQty(body.qty);
  const lineNoRow = await DB(c).prepare('SELECT COALESCE(MAX(line_no),0) AS m FROM quote_lines WHERE quote_id=?').bind(quoteId).first();
  const lineNo = lineNoRow.m + 1;

  if (kind === 'part') {
    const part = await DB(c).prepare('SELECT * FROM parts WHERE id=?').bind(+body.part_id).first();
    if (!part) return c.json({ error: 'part not found' }, 404);
    const priceRow = await DB(c).prepare(`SELECT pp.amount FROM part_prices pp JOIN price_lists pl ON pl.id=pp.price_list_id AND pl.status='published' WHERE pp.part_id=? LIMIT 1`).bind(part.id).first();
    const results = await DB(c).batch([
      DB(c).prepare(`INSERT INTO quote_lines(quote_id,line_no,kind,part_id,ordering_code,description,qty,unit_price,poa)
        VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(quoteId, lineNo, 'part', part.id, part.part_number, part.name, qty, priceRow ? priceRow.amount : null, priceRow ? 0 : 1),
      DB(c).prepare("UPDATE quotes SET updated_at=datetime('now'), updated_by=? WHERE id=?").bind(actor(c) || 'demo', quoteId),
      DB(c).prepare('INSERT INTO audit_log(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)')
        .bind(actor(c) || 'demo', 'add-line', 'quote', String(quoteId), JSON.stringify({ part: part.part_number })),
    ]);
    const newId = results[0].meta.last_row_id;
    return c.json(await DB(c).prepare('SELECT * FROM quote_lines WHERE id=?').bind(newId).first());
  }

  if (kind === 'custom') {
    const description = (body.description || '').trim();
    if (!description) return c.json({ error: 'description is required for a custom line' }, 400);
    const orderingCode = (body.ordering_code || '').trim() || 'CUSTOM';
    const hasPrice = body.unit_price != null && body.unit_price !== '';
    const unitPrice = hasPrice ? Math.max(0, +body.unit_price || 0) : null; // never silently ₹0 — blank => PoA
    const results = await DB(c).batch([
      DB(c).prepare(`INSERT INTO quote_lines(quote_id,line_no,kind,ordering_code,description,qty,unit_price,poa)
        VALUES (?,?,?,?,?,?,?,?)`)
        .bind(quoteId, lineNo, 'custom', orderingCode, description, qty, unitPrice, hasPrice ? 0 : 1),
      DB(c).prepare("UPDATE quotes SET updated_at=datetime('now'), updated_by=? WHERE id=?").bind(actor(c) || 'demo', quoteId),
      DB(c).prepare('INSERT INTO audit_log(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)')
        .bind(actor(c) || 'demo', 'add-line', 'quote', String(quoteId), JSON.stringify({ code: orderingCode, custom: true })),
    ]);
    const newId = results[0].meta.last_row_id;
    return c.json(await DB(c).prepare('SELECT * FROM quote_lines WHERE id=?').bind(newId).first());
  }

  // configured product line: re-evaluate server-side (NFR-3: server is the authority)
  const familyId = +body.family_id;
  const meta = await d.loadFamilyMeta(DB(c), familyId);
  if (!meta) return c.json({ error: 'family not found' }, 404);
  if (meta.family.status === 'archived') {
    return c.json({ error: `${meta.family.name} is archived — it cannot be added to new quotations. Existing quotations that reference it are unaffected.` }, 400);
  }
  if (meta.family.status !== 'published') {
    return c.json({ error: `${meta.family.name} is still in '${meta.family.status}' status — publish it from the Admin screen before quoting.` }, 400);
  }
  const result = evaluate(meta, body.selections || {});
  if (!result.complete) return c.json({ error: 'Configuration incomplete', violations: result.violations }, 400);
  if (result.violations.length) return c.json({ error: 'Configuration invalid', violations: result.violations }, 400);

  const priceList = await d.activePriceList(DB(c));
  const price = priceList ? await priceFor(DB(c), priceList.id, familyId, result.effective, meta.segments) : { poa: true, total: null, breakdown: [] };
  const companions = resolveCompanions(meta, result.effective);
  const spec = meta.segments.filter(s => s.in_code || true).map(s => {
    const v = result.effective[s.key];
    const vals = Array.isArray(v) ? v : (v != null && v !== '' ? [v] : []);
    const labels = vals.map(val => {
      const o = s.options.find(o => o.code === String(val));
      return o ? `${o.code} — ${o.label}` : String(val);
    });
    return { name: s.name, value: labels.join(', ') || '—' };
  });
  const results2 = await DB(c).batch([
    DB(c).prepare(`INSERT INTO quote_lines(quote_id,line_no,kind,family_id,ordering_code,description,config_json,spec_summary,companions_json,qty,unit_price,price_breakdown,poa,availability)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(quoteId, lineNo, 'config', familyId, result.code, meta.family.name,
        JSON.stringify(result.effective), JSON.stringify(spec), JSON.stringify(companions),
        qty, price.total, JSON.stringify(price.breakdown), price.poa ? 1 : 0, result.availability),
    DB(c).prepare("UPDATE quotes SET updated_at=datetime('now'), updated_by=? WHERE id=?").bind(actor(c) || 'demo', quoteId),
    DB(c).prepare('INSERT INTO audit_log(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)')
      .bind(actor(c) || 'demo', 'add-line', 'quote', String(quoteId), JSON.stringify({ code: result.code })),
  ]);
  const newId = results2[0].meta.last_row_id;
  return c.json(await DB(c).prepare('SELECT * FROM quote_lines WHERE id=?').bind(newId).first());
});

// Reconfigure an existing configured line: re-evaluate the new selections server-side
// and update the SAME line in place (code, spec snapshot, companions, price), keeping line_no.
app.patch('/api/lines/:id/reconfigure', async (c) => {
  const id = +c.req.param('id');
  const line = await DB(c).prepare('SELECT * FROM quote_lines WHERE id=?').bind(id).first();
  if (!line) return c.json({ error: 'line not found' }, 404);
  if (line.kind !== 'config') return c.json({ error: 'Only configured product lines can be reconfigured.' }, 400);
  const g = await d.requireDraft(DB(c), line.quote_id);   // BUG-1
  if (g.error) return c.json(g.error, g.status);
  const meta = await d.loadFamilyMeta(DB(c), line.family_id);
  if (!meta) return c.json({ error: 'family not found' }, 404);
  if (meta.family.status === 'archived') {
    return c.json({ error: `${meta.family.name} is archived — its quotation lines cannot be reconfigured.` }, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  const result = evaluate(meta, body.selections || {});
  if (!result.complete) return c.json({ error: 'Configuration incomplete', violations: result.violations }, 400);
  if (result.violations.length) return c.json({ error: 'Configuration invalid', violations: result.violations }, 400);

  const priceList = await d.activePriceList(DB(c));
  const price = priceList ? await priceFor(DB(c), priceList.id, line.family_id, result.effective, meta.segments) : { poa: true, total: null, breakdown: [] };
  const companions = resolveCompanions(meta, result.effective);
  const spec = meta.segments.map(s => {
    const v = result.effective[s.key];
    const vals = Array.isArray(v) ? v : (v != null && v !== '' ? [v] : []);
    const labels = vals.map(val => {
      const o = s.options.find(o => o.code === String(val));
      return o ? `${o.code} — ${o.label}` : String(val);
    });
    return { name: s.name, value: labels.join(', ') || '—' };
  });
  await DB(c).batch([
    DB(c).prepare(`UPDATE quote_lines SET ordering_code=?, config_json=?, spec_summary=?, companions_json=?,
        qty=?, unit_price=?, price_breakdown=?, poa=?, availability=? WHERE id=?`)
      .bind(result.code, JSON.stringify(result.effective), JSON.stringify(spec), JSON.stringify(companions),
        body.qty || line.qty, price.total, JSON.stringify(price.breakdown), price.poa ? 1 : 0, result.availability, line.id),
    DB(c).prepare("UPDATE quotes SET updated_at=datetime('now'), updated_by=? WHERE id=?").bind(actor(c) || 'demo', line.quote_id),
    DB(c).prepare('INSERT INTO audit_log(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)')
      .bind(actor(c) || 'demo', 'reconfigure-line', 'quote', String(line.quote_id), JSON.stringify({ line: line.id, code: result.code, was: line.ordering_code })),
  ]);
  return c.json(await DB(c).prepare('SELECT * FROM quote_lines WHERE id=?').bind(line.id).first());
});

app.patch('/api/lines/:id', async (c) => {
  const id = +c.req.param('id');
  const line = await DB(c).prepare('SELECT quote_id, ordering_code FROM quote_lines WHERE id=?').bind(id).first();
  if (!line) return c.json({ error: 'line not found' }, 404);
  const g = await d.requireDraft(DB(c), line.quote_id);   // BUG-1
  if (g.error) return c.json(g.error, g.status);
  const body = await c.req.json().catch(() => ({}));
  if ('qty' in body) body.qty = clampQty(body.qty);
  if ('discount_pct' in body) body.discount_pct = clampPct(body.discount_pct);
  if ('unit_price' in body) body.unit_price = Math.max(0, +body.unit_price || 0);
  const allowed = ['qty', 'discount_pct', 'unit_price'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in body) { sets.push(`${k}=?`); vals.push(body[k]); }
  if (sets.length) {
    vals.push(id);
    await DB(c).batch([
      DB(c).prepare(`UPDATE quote_lines SET ${sets.join(',')} WHERE id=?`).bind(...vals),
      DB(c).prepare("UPDATE quotes SET updated_at=datetime('now'), updated_by=? WHERE id=?").bind(actor(c) || 'demo', line.quote_id),
      DB(c).prepare('INSERT INTO audit_log(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)')
        .bind(actor(c) || 'demo', 'edit-line', 'quote', String(line.quote_id), JSON.stringify({ code: line.ordering_code, ...body })),
    ]);
  }
  return c.json(await DB(c).prepare('SELECT * FROM quote_lines WHERE id=?').bind(id).first());
});
app.delete('/api/lines/:id', async (c) => {
  const id = +c.req.param('id');
  const line = await DB(c).prepare('SELECT quote_id, ordering_code FROM quote_lines WHERE id=?').bind(id).first();
  if (!line) return c.json({ error: 'line not found' }, 404);
  const g = await d.requireDraft(DB(c), line.quote_id);   // BUG-1
  if (g.error) return c.json(g.error, g.status);
  await DB(c).batch([
    DB(c).prepare('DELETE FROM quote_lines WHERE id=?').bind(id),
    DB(c).prepare("UPDATE quotes SET updated_at=datetime('now'), updated_by=? WHERE id=?").bind(actor(c) || 'demo', line.quote_id),
    DB(c).prepare('INSERT INTO audit_log(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)')
      .bind(actor(c) || 'demo', 'delete-line', 'quote', String(line.quote_id), JSON.stringify({ code: line.ordering_code })),
  ]);
  return c.json({ ok: true });
});

// Reorder a quote's lines: body.order is line ids in the desired order; line_no is
// renumbered 1..n to match. Ids not in `order` (if any) keep their relative order after.
app.post('/api/quotes/:id/reorder', async (c) => {
  const quoteId = +c.req.param('id');
  const g = await d.requireDraft(DB(c), quoteId);   // BUG-1
  if (g.error) return c.json(g.error, g.status);
  const body = await c.req.json().catch(() => ({}));
  const order = Array.isArray(body.order) ? body.order.map(Number) : null;
  if (!order) return c.json({ error: 'order (array of line ids) is required' }, 400);
  const ownRows = (await DB(c).prepare('SELECT id FROM quote_lines WHERE quote_id=?').bind(quoteId).all()).results;
  const own = new Set(ownRows.map((l) => l.id));
  const seq = [...order.filter((id) => own.has(id)), ...[...own].filter((id) => !order.includes(id))];
  const stmts = [];
  let n = 1;
  for (const lineId of seq) stmts.push(DB(c).prepare('UPDATE quote_lines SET line_no=? WHERE id=? AND quote_id=?').bind(n++, lineId, quoteId));
  stmts.push(DB(c).prepare("UPDATE quotes SET updated_at=datetime('now'), updated_by=? WHERE id=?").bind(actor(c) || 'demo', quoteId));
  stmts.push(DB(c).prepare('INSERT INTO audit_log(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)')
    .bind(actor(c) || 'demo', 'reorder', 'quote', String(quoteId), JSON.stringify({ order: seq })));
  await DB(c).batch(stmts);
  return c.json({ ok: true });
});

// ---------- Admin: product categories ----------
app.get('/api/admin/categories', async (c) => {
  return c.json((await DB(c).prepare(`SELECT c.*, (SELECT COUNT(*) FROM families f WHERE f.category_id=c.id) AS family_count
    FROM categories c ORDER BY c.sort, c.name`).all()).results);
});
app.post('/api/admin/categories', async (c) => {
  const DBc = DB(c);
  const body = await c.req.json().catch(() => ({}));
  const { code, name, sort } = body;
  if (!code || !code.trim() || !name || !name.trim()) return c.json({ error: 'code and name are required' }, 400);
  if (await DBc.prepare('SELECT 1 FROM categories WHERE code=?').bind(code.trim()).first()) {
    return c.json({ error: `Category code '${code.trim()}' already exists` }, 409);
  }
  const nextSort = sort != null && sort !== '' ? +sort : ((await DBc.prepare('SELECT COALESCE(MAX(sort),0) m FROM categories').first()).m + 1);
  const r = await DBc.prepare('INSERT INTO categories(code, name, sort) VALUES (?,?,?)').bind(code.trim(), name.trim(), nextSort).run();
  await d.audit(DBc, actor(c), 'create', 'category', r.meta.last_row_id, { code: code.trim(), name: name.trim() });
  return c.json(await DBc.prepare('SELECT * FROM categories WHERE id=?').bind(r.meta.last_row_id).first());
});
app.patch('/api/admin/categories/:id', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  const existing = await DBc.prepare('SELECT * FROM categories WHERE id=?').bind(id).first();
  if (!existing) return c.json({ error: 'category not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const { code, name, sort } = body;
  if (code != null && code.trim() && code.trim() !== existing.code && await DBc.prepare('SELECT 1 FROM categories WHERE code=? AND id<>?').bind(code.trim(), id).first()) {
    return c.json({ error: `Category code '${code.trim()}' already exists` }, 409);
  }
  const sets = [], vals = [];
  if (code != null && code.trim()) { sets.push('code=?'); vals.push(code.trim()); }
  if (name != null && name.trim()) { sets.push('name=?'); vals.push(name.trim()); }
  if (sort != null && sort !== '') { sets.push('sort=?'); vals.push(+sort); }
  if (sets.length) { vals.push(id); await DBc.prepare(`UPDATE categories SET ${sets.join(',')} WHERE id=?`).bind(...vals).run(); }
  await d.audit(DBc, actor(c), 'update', 'category', id, body);
  return c.json(await DBc.prepare('SELECT * FROM categories WHERE id=?').bind(id).first());
});
app.delete('/api/admin/categories/:id', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  const n = (await DBc.prepare('SELECT COUNT(*) n FROM families WHERE category_id=?').bind(id).first()).n;
  if (n > 0) return c.json({ error: `Cannot delete: ${n} product famil${n === 1 ? 'y' : 'ies'} still use this category. Reassign or archive them first.` }, 409);
  await DBc.prepare('DELETE FROM categories WHERE id=?').bind(id).run();
  await d.audit(DBc, actor(c), 'delete', 'category', id);
  return c.json({ ok: true });
});

// ---------- Admin: metadata CRUD ----------
app.get('/api/admin/families', async (c) => {
  const rows = (await DB(c).prepare(`SELECT f.*, c.name AS category_name,
     (SELECT COUNT(*) FROM segments s WHERE s.family_id=f.id) AS segment_count,
     (SELECT COUNT(*) FROM rules r WHERE r.family_id=f.id) AS rule_count
   FROM families f JOIN categories c ON c.id=f.category_id ORDER BY c.sort, f.sort, f.name`).all()).results;
  return c.json(rows);
});

app.patch('/api/admin/families/:id', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const allowed = ['name', 'description', 'datasheet_ref', 'status'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in body) { sets.push(`${k}=?`); vals.push(body[k]); }
  if (sets.length) { vals.push(id); await DBc.prepare(`UPDATE families SET ${sets.join(',')} WHERE id=?`).bind(...vals).run(); }
  await d.touchFamily(DBc, id);
  await d.audit(DBc, actor(c), 'update', 'family', id, body);
  return c.json(await DBc.prepare('SELECT * FROM families WHERE id=?').bind(id).first());
});

// Create a new product family (admin). Starts with an empty segment list.
app.post('/api/admin/families', async (c) => {
  const DBc = DB(c);
  const body = await c.req.json().catch(() => ({}));
  const { category_id, code, name, description, datasheet_ref, separator } = body;
  if (!category_id || !code || !name) return c.json({ error: 'category_id, code and name are required' }, 400);
  if (await DBc.prepare('SELECT 1 FROM families WHERE code=?').bind(code).first()) return c.json({ error: `Family code '${code}' already exists` }, 409);
  // new families start as DRAFT: visible to admin only, not quotable, until published
  const r = await DBc.prepare(`INSERT INTO families(category_id, code, name, description, datasheet_ref, kind, code_template, status, updated_at)
     VALUES (?,?,?,?,?,'configurable',?, 'draft', datetime('now'))`)
    .bind(category_id, code.trim(), name.trim(), description || null, datasheet_ref || null,
      JSON.stringify({ separator: separator || '-' })).run();
  await d.audit(DBc, actor(c), 'create', 'family', r.meta.last_row_id, body);
  return c.json(await DBc.prepare('SELECT * FROM families WHERE id=?').bind(r.meta.last_row_id).first());
});

// Create a new specification segment for a family
app.post('/api/admin/segments', async (c) => {
  const DBc = DB(c);
  const body = await c.req.json().catch(() => ({}));
  const { family_id, key, name, selection_type, required, help, numeric_unit } = body;
  if (!family_id || !key || !name) return c.json({ error: 'family_id, key and name are required' }, 400);
  if (await DBc.prepare('SELECT 1 FROM segments WHERE family_id=? AND key=?').bind(family_id, key).first()) {
    return c.json({ error: `Segment key '${key}' already exists in this family` }, 409);
  }
  const pos = (await DBc.prepare('SELECT COALESCE(MAX(position),0) m FROM segments WHERE family_id=?').bind(family_id).first()).m + 1;
  const r = await DBc.prepare(`INSERT INTO segments(family_id, key, name, position, selection_type, required, in_code, numeric_unit, help)
     VALUES (?,?,?,?,?,?,1,?,?)`)
    .bind(family_id, key.trim(), name.trim(), pos, selection_type || 'single', required === false ? 0 : 1, numeric_unit || null, help || null).run();
  await d.touchFamily(DBc, family_id);
  await d.audit(DBc, actor(c), 'create', 'segment', r.meta.last_row_id, body);
  return c.json(await DBc.prepare('SELECT * FROM segments WHERE id=?').bind(r.meta.last_row_id).first());
});

// Create / delete dependency rules (admin power users; rule body is validated JSON)
app.post('/api/admin/rules', async (c) => {
  const DBc = DB(c);
  const body = await c.req.json().catch(() => ({}));
  const { family_id, type, rule, note } = body;
  if (!family_id || !type || !rule) return c.json({ error: 'family_id, type and rule are required' }, 400);
  if (!['FILTER', 'DERIVE', 'DEFAULT', 'CONSTRAINT', 'COMPOSE'].includes(type)) return c.json({ error: 'invalid rule type' }, 400);
  let parsed;
  try { parsed = typeof rule === 'string' ? JSON.parse(rule) : rule; } catch { return c.json({ error: 'rule must be valid JSON' }, 400); }
  const r = await DBc.prepare('INSERT INTO rules(family_id, type, rule, note) VALUES (?,?,?,?)')
    .bind(family_id, type, JSON.stringify(parsed), note || null).run();
  await d.touchFamily(DBc, family_id);
  await d.audit(DBc, actor(c), 'create', 'rule', r.meta.last_row_id, { type, rule: parsed });
  return c.json(await DBc.prepare('SELECT * FROM rules WHERE id=?').bind(r.meta.last_row_id).first());
});
app.patch('/api/admin/rules/:id', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  const existing = await DBc.prepare('SELECT * FROM rules WHERE id=?').bind(id).first();
  if (!existing) return c.json({ error: 'rule not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const { type, rule, note } = body;
  const sets = [], vals = [];
  if (type) {
    if (!['FILTER', 'DERIVE', 'DEFAULT', 'CONSTRAINT', 'COMPOSE'].includes(type)) return c.json({ error: 'invalid rule type' }, 400);
    sets.push('type=?'); vals.push(type);
  }
  if (rule !== undefined) {
    let parsed;
    try { parsed = typeof rule === 'string' ? JSON.parse(rule) : rule; } catch { return c.json({ error: 'rule must be valid JSON' }, 400); }
    sets.push('rule=?'); vals.push(JSON.stringify(parsed));
  }
  if ('note' in body) { sets.push('note=?'); vals.push(note || null); }
  if (sets.length) { vals.push(id); await DBc.prepare(`UPDATE rules SET ${sets.join(',')} WHERE id=?`).bind(...vals).run(); }
  await d.touchFamily(DBc, existing.family_id);
  await d.audit(DBc, actor(c), 'update', 'rule', id, body);
  return c.json(await DBc.prepare('SELECT * FROM rules WHERE id=?').bind(id).first());
});
app.delete('/api/admin/rules/:id', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  const fid = (await DBc.prepare('SELECT family_id FROM rules WHERE id=?').bind(id).first())?.family_id;
  await DBc.prepare('DELETE FROM rules WHERE id=?').bind(id).run();
  await d.touchFamily(DBc, fid);
  await d.audit(DBc, actor(c), 'delete', 'rule', id);
  return c.json({ ok: true });
});

// Usage check: which quotations reference this family (for the archive confirmation)
app.get('/api/admin/families/:id/usage', async (c) => {
  const id = +c.req.param('id');
  const quotes = (await DB(c).prepare(`SELECT q.id, q.number, q.revision, q.status, COUNT(l.id) AS line_count
     FROM quotes q JOIN quote_lines l ON l.quote_id = q.id
     WHERE l.family_id = ? GROUP BY q.id ORDER BY q.id DESC`).bind(id).all()).results;
  return c.json({ quotes, total: quotes.length });
});

// Archive / unarchive. Archiving NEVER deletes: the family and all its metadata stay
// in the database so historical quotes remain fully reproducible.
app.post('/api/admin/families/:id/archive', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  const fam = await DBc.prepare('SELECT * FROM families WHERE id=?').bind(id).first();
  if (!fam) return c.json({ error: 'family not found' }, 404);
  await DBc.prepare("UPDATE families SET status='archived' WHERE id=?").bind(fam.id).run();
  const usage = (await DBc.prepare('SELECT COUNT(DISTINCT quote_id) n FROM quote_lines WHERE family_id=?').bind(fam.id).first()).n;
  await d.audit(DBc, actor(c), 'archive', 'family', fam.id, { code: fam.code, referenced_in_quotes: usage });
  return c.json(await DBc.prepare('SELECT * FROM families WHERE id=?').bind(fam.id).first());
});
app.post('/api/admin/families/:id/unarchive', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  await DBc.prepare("UPDATE families SET status='published' WHERE id=?").bind(id).run();
  await d.audit(DBc, actor(c), 'unarchive', 'family', id);
  return c.json(await DBc.prepare('SELECT * FROM families WHERE id=?').bind(id).first());
});

// Publish a draft family — with a validation gate (FR-4.4 lite): it must have at least
// one segment, and every required selectable segment needs at least one active option.
app.post('/api/admin/families/:id/publish', async (c) => {
  const DBc = DB(c);
  const meta = await d.loadFamilyMeta(DBc, +c.req.param('id'));
  if (!meta) return c.json({ error: 'family not found' }, 404);
  const problems = [];
  if (!meta.segments.length) problems.push('The family has no specification segments yet.');
  for (const seg of meta.segments) {
    if (seg.required && ['single', 'multi'].includes(seg.selection_type) && !seg.options.length) {
      problems.push(`Segment '${seg.name}' (${seg.key}) is required but has no options.`);
    }
  }
  if (problems.length) return c.json({ error: 'Cannot publish yet', problems }, 400);
  await DBc.prepare("UPDATE families SET status='published' WHERE id=?").bind(meta.family.id).run();
  await d.audit(DBc, actor(c), 'publish', 'family', meta.family.id, { code: meta.family.code });
  return c.json(await DBc.prepare('SELECT * FROM families WHERE id=?').bind(meta.family.id).first());
});

app.post('/api/admin/options', async (c) => {
  const DBc = DB(c);
  const body = await c.req.json().catch(() => ({}));
  const { segment_id, code, label, is_standard, on_request, price_on_application } = body;
  if (!segment_id || !code || !String(code).trim() || !label || !String(label).trim()) {
    return c.json({ error: 'segment_id, code and label are required' }, 400);
  }
  if (await DBc.prepare('SELECT 1 FROM options WHERE segment_id=? AND code=?').bind(segment_id, String(code).trim()).first()) {
    return c.json({ error: `Option code '${String(code).trim()}' already exists in this segment` }, 409);
  }
  const r = await DBc.prepare('INSERT INTO options(segment_id,code,label,is_standard,on_request,price_on_application) VALUES (?,?,?,?,?,?)')
    .bind(segment_id, String(code).trim(), label, is_standard ? 1 : 0, on_request ? 1 : 0, price_on_application ? 1 : 0).run();
  await d.touchFamily(DBc, await d.segmentFamilyId(DBc, segment_id));
  await d.audit(DBc, actor(c), 'create', 'option', r.meta.last_row_id, body);
  return c.json(await DBc.prepare('SELECT * FROM options WHERE id=?').bind(r.meta.last_row_id).first());
});
app.patch('/api/admin/options/:id', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const allowed = ['code', 'label', 'is_standard', 'on_request', 'price_on_application', 'status'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in body) { sets.push(`${k}=?`); vals.push(body[k]); }
  if (sets.length) { vals.push(id); await DBc.prepare(`UPDATE options SET ${sets.join(',')} WHERE id=?`).bind(...vals).run(); }
  await d.touchFamily(DBc, await d.optionFamilyId(DBc, id));
  await d.audit(DBc, actor(c), 'update', 'option', id, body);
  return c.json(await DBc.prepare('SELECT * FROM options WHERE id=?').bind(id).first());
});

app.get('/api/admin/audit', async (c) =>
  c.json((await DB(c).prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all()).results));

// Record counts for the top-level admin tabs
app.get('/api/admin/summary', async (c) => {
  const DBc = DB(c);
  return c.json({
    families: (await DBc.prepare('SELECT COUNT(*) n FROM families').first()).n,
    spares: (await DBc.prepare('SELECT COUNT(*) n FROM parts').first()).n,
    audit: (await DBc.prepare('SELECT COUNT(*) n FROM audit_log').first()).n,
  });
});

// ---------- Admin: pricing ----------
app.get('/api/admin/prices/:familyId', async (c) => {
  const familyId = +c.req.param('familyId');
  const pl = await d.activePriceList(DB(c));
  if (!pl) return c.json({ base: [], options: [] });
  return c.json({
    priceList: pl,
    base: (await DB(c).prepare('SELECT * FROM base_prices WHERE price_list_id=? AND family_id=?').bind(pl.id, familyId).all()).results,
    options: (await DB(c).prepare('SELECT * FROM option_prices WHERE price_list_id=? AND family_id=?').bind(pl.id, familyId).all()).results,
  });
});

// Create a base price row: match is {} (generic) or {segKey: optionCode} for a keyed price.
app.post('/api/admin/base-prices', async (c) => {
  const DBc = DB(c);
  const pl = await d.activePriceList(DBc);
  if (!pl) return c.json({ error: 'no published price list' }, 400);
  const body = await c.req.json().catch(() => ({}));
  const { family_id, match, amount } = body;
  if (!family_id || amount == null || amount === '') return c.json({ error: 'family_id and amount are required' }, 400);
  let matchStr = typeof match === 'string' ? (match || '{}') : JSON.stringify(match || {});
  try { JSON.parse(matchStr); } catch { return c.json({ error: 'match must be valid JSON, e.g. {"size":"0013"}' }, 400); }
  const r = await DBc.prepare('INSERT INTO base_prices(price_list_id,family_id,match,amount) VALUES (?,?,?,?)')
    .bind(pl.id, +family_id, matchStr, +amount).run();
  await d.audit(DBc, actor(c), 'create', 'base_price', r.meta.last_row_id, { family_id, match: matchStr, amount });
  return c.json(await DBc.prepare('SELECT * FROM base_prices WHERE id=?').bind(r.meta.last_row_id).first());
});
app.patch('/api/admin/base-prices/:id', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const amount = +body.amount;
  if (!Number.isFinite(amount)) return c.json({ error: 'amount must be a number' }, 400);
  await DBc.prepare('UPDATE base_prices SET amount=? WHERE id=?').bind(amount, id).run();
  await d.audit(DBc, actor(c), 'update', 'base_price', id, body);
  return c.json({ ok: true });
});
app.delete('/api/admin/base-prices/:id', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  await DBc.prepare('DELETE FROM base_prices WHERE id=?').bind(id).run();
  await d.audit(DBc, actor(c), 'delete', 'base_price', id);
  return c.json({ ok: true });
});

// Create an option adder: kind 'abs' (₹) or 'pct' (% of base).
app.post('/api/admin/option-prices', async (c) => {
  const DBc = DB(c);
  const pl = await d.activePriceList(DBc);
  if (!pl) return c.json({ error: 'no published price list' }, 400);
  const body = await c.req.json().catch(() => ({}));
  const { family_id, segment_key, option_code, kind, amount } = body;
  if (!family_id || !segment_key || !option_code || amount == null || amount === '') {
    return c.json({ error: 'family_id, segment_key, option_code and amount are required' }, 400);
  }
  const existing = await DBc.prepare('SELECT id FROM option_prices WHERE price_list_id=? AND family_id=? AND segment_key=? AND option_code=?')
    .bind(pl.id, +family_id, segment_key, option_code).first();
  if (existing) return c.json({ error: 'an adder already exists for this option' }, 409);
  const r = await DBc.prepare('INSERT INTO option_prices(price_list_id,family_id,segment_key,option_code,kind,amount) VALUES (?,?,?,?,?,?)')
    .bind(pl.id, +family_id, segment_key, option_code, kind === 'pct' ? 'pct' : 'abs', +amount).run();
  await d.audit(DBc, actor(c), 'create', 'option_price', r.meta.last_row_id, body);
  return c.json(await DBc.prepare('SELECT * FROM option_prices WHERE id=?').bind(r.meta.last_row_id).first());
});
app.patch('/api/admin/option-prices/:id', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const sets = [], vals = [];
  if ('amount' in body) { sets.push('amount=?'); vals.push(+body.amount); }
  if ('kind' in body) { sets.push('kind=?'); vals.push(body.kind === 'pct' ? 'pct' : 'abs'); }
  if (sets.length) { vals.push(id); await DBc.prepare(`UPDATE option_prices SET ${sets.join(',')} WHERE id=?`).bind(...vals).run(); }
  await d.audit(DBc, actor(c), 'update', 'option_price', id, body);
  return c.json({ ok: true });
});
app.delete('/api/admin/option-prices/:id', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  await DBc.prepare('DELETE FROM option_prices WHERE id=?').bind(id).run();
  await d.audit(DBc, actor(c), 'delete', 'option_price', id);
  return c.json({ ok: true });
});

// ---------- Admin: spare parts (many-to-many with families) ----------
// Rewrite a part's family links and keep parts.family_id (primary) in sync — one atomic batch.
async function setPartFamilies(DB, partId, familyIds) {
  const ids = [...new Set((familyIds || []).map((x) => +x).filter(Boolean))];
  await DB.batch([
    DB.prepare('DELETE FROM part_families WHERE part_id=?').bind(partId),
    ...ids.map((fid) => DB.prepare('INSERT OR IGNORE INTO part_families(part_id, family_id) VALUES (?,?)').bind(partId, fid)),
    DB.prepare('UPDATE parts SET family_id=? WHERE id=?').bind(ids[0] || null, partId),
  ]);
  return ids;
}
async function setPartPrice(DB, partId, price) {
  const pl = await d.activePriceList(DB);
  if (!pl) return;
  const stmts = [DB.prepare('DELETE FROM part_prices WHERE part_id=? AND price_list_id=?').bind(partId, pl.id)];
  if (price != null && price !== '') stmts.push(DB.prepare('INSERT INTO part_prices(price_list_id, part_id, amount) VALUES (?,?,?)').bind(pl.id, partId, +price));
  await DB.batch(stmts);
}

app.get('/api/admin/parts', async (c) => {
  const rows = (await DB(c).prepare(`SELECT p.*, f.name AS family_name,
      (SELECT amount FROM part_prices pp JOIN price_lists pl ON pl.id=pp.price_list_id AND pl.status='published' WHERE pp.part_id=p.id LIMIT 1) AS price
    FROM parts p LEFT JOIN families f ON f.id=p.family_id ORDER BY p.part_number`).all()).results;
  const out = [];
  for (const r of rows) out.push({ ...r, family_ids: await d.partFamilyIds(DB(c), r.id) });
  return c.json(out);
});

app.post('/api/admin/parts', async (c) => {
  const DBc = DB(c);
  const body = await c.req.json().catch(() => ({}));
  const { part_number, name, description, family_ids, price } = body;
  if (!part_number || !part_number.trim() || !name || !name.trim()) {
    return c.json({ error: 'part_number and name are required' }, 400);
  }
  if (await DBc.prepare('SELECT 1 FROM parts WHERE part_number=?').bind(part_number.trim()).first()) {
    return c.json({ error: `Part number '${part_number.trim()}' already exists` }, 409);
  }
  const r = await DBc.prepare("INSERT INTO parts(part_number, name, description, status) VALUES (?,?,?,'active')")
    .bind(part_number.trim(), name.trim(), description || null).run();
  const id = r.meta.last_row_id;
  await setPartFamilies(DBc, id, family_ids);
  await setPartPrice(DBc, id, price);
  await d.audit(DBc, actor(c), 'create', 'part', id, { part_number: part_number.trim(), name: name.trim(), family_ids: await d.partFamilyIds(DBc, id) });
  const row = await DBc.prepare('SELECT * FROM parts WHERE id=?').bind(id).first();
  return c.json({ ...row, family_ids: await d.partFamilyIds(DBc, id) });
});

app.patch('/api/admin/parts/:id', async (c) => {
  const DBc = DB(c);
  const id = +c.req.param('id');
  const existing = await DBc.prepare('SELECT * FROM parts WHERE id=?').bind(id).first();
  if (!existing) return c.json({ error: 'part not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const { part_number, name, description, status, family_ids, price } = body;
  if (part_number != null && part_number.trim() && part_number.trim() !== existing.part_number) {
    if (await DBc.prepare('SELECT 1 FROM parts WHERE part_number=? AND id<>?').bind(part_number.trim(), id).first()) {
      return c.json({ error: `Part number '${part_number.trim()}' already exists` }, 409);
    }
  }
  const sets = [], vals = [];
  if (part_number != null && part_number.trim()) { sets.push('part_number=?'); vals.push(part_number.trim()); }
  if (name != null && name.trim()) { sets.push('name=?'); vals.push(name.trim()); }
  if ('description' in body) { sets.push('description=?'); vals.push(description || null); }
  if (status && ['active', 'retired'].includes(status)) { sets.push('status=?'); vals.push(status); }
  if (sets.length) { vals.push(id); await DBc.prepare(`UPDATE parts SET ${sets.join(',')} WHERE id=?`).bind(...vals).run(); }
  if ('family_ids' in body) await setPartFamilies(DBc, id, family_ids);
  if ('price' in body) await setPartPrice(DBc, id, price);
  await d.audit(DBc, actor(c), 'update', 'part', id, body);
  const row = await DBc.prepare('SELECT * FROM parts WHERE id=?').bind(id).first();
  return c.json({ ...row, family_ids: await d.partFamilyIds(DBc, id) });
});

// ---------- Dashboard ----------
app.get('/api/dashboard', async (c) => {
  const DBc = DB(c);
  const byStatus = (await DBc.prepare('SELECT status, COUNT(*) AS n FROM quotes GROUP BY status').all()).results;
  const topFamilies = (await DBc.prepare(`SELECT f.name, COUNT(*) AS n FROM quote_lines l JOIN families f ON f.id=l.family_id GROUP BY f.id ORDER BY n DESC LIMIT 8`).all()).results;
  const poaLines = (await DBc.prepare('SELECT COUNT(*) AS n FROM quote_lines WHERE poa=1').first()).n;
  const totals = await DBc.prepare(`SELECT COUNT(*) AS quotes, (SELECT COUNT(*) FROM quote_lines) AS lines FROM quotes`).first();
  return c.json({ byStatus, topFamilies, poaLines, totals });
});

// ---------- Admin: backups / export ----------
const EXPORT_TABLES = ['categories','families','segments','options','rules','companion_links','parts','part_families','price_lists','base_prices','option_prices','part_prices','customers','quotes','quote_lines','audit_log','attachments'];

// D1 Time Travel replaces file snapshots (NFR-4): restore via
//   wrangler d1 time-travel restore epe-quote --timestamp=<ISO>
app.get('/api/admin/backups', (c) => c.json([]));
app.post('/api/admin/backups', async (c) => {
  await d.audit(DB(c), actor(c), 'backup', 'database', '', { mode: 'd1-time-travel' });
  return c.json({ ok: true, file: null, note: 'Backups are automatic on Cloudflare D1 (Time Travel, 30-day point-in-time restore).' });
});
// No lock-in: full-database export as JSON, downloadable anytime.
app.get('/api/admin/export', async (c) => {
  const out = {};
  for (const t of EXPORT_TABLES) out[t] = (await DB(c).prepare(`SELECT * FROM ${t}`).all()).results;
  c.header('Content-Disposition', `attachment; filename="epe-quote.${new Date().toISOString().slice(0, 10)}.json"`);
  return c.json(out);
});

app.onError((err, c) => {
  if (err.httpStatus) return c.json({ error: err.message }, err.httpStatus);
  const msg = String(err.cause?.message || err.message || '');
  if (/UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(msg)) {
    return c.json({ error: 'That record already exists (duplicate key).' }, 409);
  }
  if (/FOREIGN KEY constraint failed/i.test(msg)) {
    return c.json({ error: 'A referenced record does not exist.' }, 400);
  }
  if (/NOT NULL constraint failed|CHECK constraint failed/i.test(msg)) {
    return c.json({ error: 'The request is missing or has an invalid required value.' }, 400);
  }
  // D1 rejects a request when too many are already queued against the database rather than
  // failing the data itself — retrying is the correct client response, so surface it as a
  // retryable 503 instead of the opaque, non-retryable 500 below.
  if (/D1 DB is overloaded|Requests queued for too long|Network connection lost/i.test(msg)) {
    return c.json({ error: 'The database is temporarily busy. Please try again in a moment.' }, 503);
  }
  console.error('[error]', c.req.method, c.req.path, '-', msg);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
