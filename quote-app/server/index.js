import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { openDb, createSchema, snapshotDb, listBackups, DB_PATH } from './db.js';
import { loadFamilyMeta, evaluate, resolveCompanions, priceConfiguration, parseCode } from './engine.js';
import { getFxRates } from './fx.js';

const db = openDb();
createSchema(db, { backup: true }); // versioned migrations + auto-backup (data-safety layer)
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ---- Attachments: local filesystem stand-in for the Worker's R2 bucket (dev only) ----
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.EPE_UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const BLOCKED_EXTENSIONS = new Set(['.exe', '.js', '.mjs', '.cjs', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.com', '.scr', '.vbs', '.vbe', '.wsf', '.jar', '.apk', '.dll']);
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB
const INLINE_PREVIEW_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const ATTACHMENT_CATEGORIES = ['technical', 'costing', 'scan', 'other'];
const APPROVAL_DECISIONS = ['approved', 'rejected'];
const fileExt = (name) => { const m = /\.[^./\\]+$/.exec(String(name || '')); return m ? m[0].toLowerCase() : ''; };
const sanitizeFileName = (name) => String(name || 'file').replace(/[/\\]/g, '_').replace(/[\x00-\x1f]/g, '').slice(-180) || 'file';
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { const dir = path.join(UPLOAD_DIR, 'q' + req.params.id); fs.mkdirSync(dir, { recursive: true }); cb(null, dir); },
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}-${sanitizeFileName(file.originalname)}`),
  }),
  limits: { fileSize: MAX_ATTACHMENT_BYTES },
});

const audit = (actor, action, entity, entityId, detail) =>
  db.prepare('INSERT INTO audit_log(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)')
    .run(actor || 'demo', action, entity, String(entityId ?? ''), detail ? JSON.stringify(detail) : null);

const QUERY_TYPES = ['technical', 'commercial'];

// Stamp a family's last-metadata-change time (catalogue freshness indicator)
const touchFamily = (familyId) => {
  if (familyId) db.prepare("UPDATE families SET updated_at = datetime('now') WHERE id=?").run(familyId);
};
// Related product families for a spare part (many-to-many)
const partFamilyIds = (partId) =>
  db.prepare('SELECT family_id FROM part_families WHERE part_id=? ORDER BY family_id').all(partId).map((r) => r.family_id);
const segmentFamilyId = (segmentId) => db.prepare('SELECT family_id FROM segments WHERE id=?').get(segmentId)?.family_id;
const optionFamilyId = (optionId) => db.prepare('SELECT s.family_id AS fid FROM options o JOIN segments s ON s.id=o.segment_id WHERE o.id=?').get(optionId)?.fid;
// Record who last modified a quote (and when) on any content change
const stampQuote = (quoteId, actor) => db.prepare("UPDATE quotes SET updated_at=datetime('now'), updated_by=? WHERE id=?").run(actor || 'demo', quoteId);
const lineQuoteId = (lineId) => db.prepare('SELECT quote_id FROM quote_lines WHERE id=?').get(lineId)?.quote_id;

// ---- finalized-quote guard & validation (server is the authority — NFR-3) ----
const QUOTE_STATUSES = ['Draft', 'Sent', 'Won', 'Lost', 'Expired'];
const CONTENT_FIELDS = ['customer_id', 'quote_date', 'validity_days', 'terms', 'notes', 'discount_pct', 'tax_pct', 'currency'];
// A quote's *contents* (lines + commercial fields) may only change while it is a Draft.
// Status transitions and archive/unarchive are always allowed. Returns the quote, or
// null after sending the appropriate 404/409.
const requireDraftQuote = (res, quoteId) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id=?').get(+quoteId);
  if (!q) { res.status(404).json({ error: 'quote not found' }); return null; }
  if (q.status !== 'Draft') {
    res.status(409).json({ error: `Quote ${q.number} Rev ${q.revision} is ${q.status} and locked — save a new revision or a new quote to change its contents.` });
    return null;
  }
  return q;
};
// Next revision letter from the HIGHEST existing revision for this number (not the source row),
// so re-revising the same quote can't collide. Returns null when past 'Z'.
const nextRevision = (number) => {
  let max = 'A';
  for (const r of db.prepare('SELECT revision FROM quotes WHERE number=?').all(number)) if (r.revision > max) max = r.revision;
  return max >= 'Z' ? null : String.fromCharCode(max.charCodeAt(0) + 1);
};
const clampPct = (v) => Math.max(0, Math.min(100, Number.isFinite(+v) ? +v : 0));
const clampQty = (v) => { const n = +v; return Number.isFinite(n) && n > 0 ? n : 1; };

// ---------- Catalogue ----------
app.get('/api/catalog', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort').all();
  const families = db.prepare("SELECT id, category_id, code, name, description, datasheet_ref, kind, status, updated_at FROM families ORDER BY sort, name").all();
  res.json({ categories, families });
});

app.get('/api/families/:id/meta', (req, res) => {
  const meta = loadFamilyMeta(db, +req.params.id);
  if (!meta) return res.status(404).json({ error: 'family not found' });
  // spare parts linked to this family (any status) — used for the admin tab record count
  meta.spare_count = db.prepare('SELECT COUNT(*) n FROM part_families WHERE family_id=?').get(+req.params.id).n;
  res.json(meta);
});

// Popularity: how frequently & recently each product family / part has been quoted.
// Score = time-decayed frequency: every quote line contributes 2^(-ageDays/halfLife),
// summed per item. Recent lines weigh most; many lines outscore a single old one.
app.get('/api/popularity', (req, res) => {
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
  const famRows = db.prepare(`SELECT l.family_id AS id, COALESCE(q.quote_date, q.created_at) AS ts
     FROM quote_lines l JOIN quotes q ON q.id=l.quote_id
     WHERE l.family_id IS NOT NULL AND q.archived=0`).all();
  const partRows = db.prepare(`SELECT l.part_id AS id, COALESCE(q.quote_date, q.created_at) AS ts
     FROM quote_lines l JOIN quotes q ON q.id=l.quote_id
     WHERE l.part_id IS NOT NULL AND q.archived=0`).all();
  res.json({ families: scoreMap(famRows), parts: scoreMap(partRows) });
});

// ---------- Configurator ----------
app.post('/api/families/:id/evaluate', (req, res) => {
  const meta = loadFamilyMeta(db, +req.params.id);
  if (!meta) return res.status(404).json({ error: 'family not found' });
  const selections = req.body.selections || {};
  const result = evaluate(meta, selections);
  const priceList = db.prepare("SELECT * FROM price_lists WHERE status='published' ORDER BY id LIMIT 1").get();
  if (priceList && result.complete && !result.violations.length) {
    result.price = priceConfiguration(db, priceList.id, meta.family.id, result.effective, meta.segments);
    result.price.currency = priceList.currency;
  }
  if (result.complete && !result.violations.length) {
    result.companions = resolveCompanions(meta, result.effective);
  }
  res.json(result);
});

app.post('/api/families/:id/parse-code', (req, res) => {
  const meta = loadFamilyMeta(db, +req.params.id);
  if (!meta) return res.status(404).json({ error: 'family not found' });
  res.json(parseCode(meta, String(req.body.code || '')));
});

// Search families by name/code, or locate by pasted ordering code prefix
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ families: [], parts: [] });
  const like = `%${q}%`;
  const families = db.prepare('SELECT id, code, name, kind FROM families WHERE name LIKE ? OR code LIKE ? LIMIT 20').all(like, like);
  const parts = db.prepare('SELECT id, part_number, name FROM parts WHERE part_number LIKE ? OR name LIKE ? LIMIT 20').all(like, like);
  res.json({ families, parts });
});

// ---------- Parts ----------
app.get('/api/parts', (req, res) => {
  const rows = db.prepare(`SELECT p.*, f.name AS family_name,
      (SELECT amount FROM part_prices pp JOIN price_lists pl ON pl.id = pp.price_list_id AND pl.status='published' WHERE pp.part_id = p.id LIMIT 1) AS price
    FROM parts p LEFT JOIN families f ON f.id = p.family_id WHERE p.status='active' ORDER BY p.part_number`).all();
  res.json(rows.map((r) => ({ ...r, family_ids: partFamilyIds(r.id) })));
});

// ---------- Customers ----------
app.get('/api/customers', (req, res) => res.json(db.prepare('SELECT * FROM customers ORDER BY name').all()));
app.post('/api/customers', (req, res) => {
  const { name, contact, email, phone, address, gstin } = req.body;
  const r = db.prepare('INSERT INTO customers(name,contact,email,phone,address,gstin) VALUES (?,?,?,?,?,?)')
    .run(name, contact || null, email || null, phone || null, address || null, gstin || null);
  audit(req.headers['x-actor'], 'create', 'customer', r.lastInsertRowid);
  res.json(db.prepare('SELECT * FROM customers WHERE id=?').get(r.lastInsertRowid));
});

// ---------- Quotes ----------
function nextQuoteNumber() {
  const year = new Date().getFullYear();
  // Use the highest existing sequence number + 1 (robust to deletes and to numbers
  // shared across revisions — COUNT(*)+1 would collide in both cases).
  const rows = db.prepare("SELECT DISTINCT number FROM quotes WHERE number LIKE ?").all(`Q-${year}-%`);
  let max = 0;
  for (const r of rows) { const m = r.number.match(/-(\d+)$/); if (m) max = Math.max(max, +m[1]); }
  return `Q-${year}-${String(max + 1).padStart(4, '0')}`;
}

app.get('/api/quotes', (req, res) => {
  // ?archived=1 includes archived (default excludes). `items` aggregates each quote's
  // line codes+descriptions so the client can search "by item" as well as by customer.
  // ?customer_id= (Customer History comparison view) always includes archived quotes too —
  // historical pricing comparison needs old/archived quotes that the default list hides.
  const customerId = req.query.customer_id;
  const includeArchived = req.query.archived === '1' || !!customerId;
  const conds = [];
  const binds = [];
  if (!includeArchived) conds.push('q.archived = 0');
  if (customerId) { conds.push('q.customer_id = ?'); binds.push(+customerId); }
  const rows = db.prepare(`SELECT q.*, c.name AS customer_name,
     (SELECT COUNT(*) FROM quote_lines l WHERE l.quote_id=q.id) AS line_count,
     (SELECT SUM(CASE WHEN l.poa=1 THEN 0 ELSE l.unit_price*l.qty*(1-l.discount_pct/100.0) END) FROM quote_lines l WHERE l.quote_id=q.id) AS subtotal,
     (SELECT MAX(l.poa) FROM quote_lines l WHERE l.quote_id=q.id) AS has_poa,
     (SELECT group_concat(l.ordering_code || ' ' || COALESCE(l.description,''), ' | ') FROM quote_lines l WHERE l.quote_id=q.id) AS items
   FROM quotes q LEFT JOIN customers c ON c.id=q.customer_id
   ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
   ORDER BY q.id DESC`).all(...binds);
  res.json(rows);
});

// Archive (soft-hide, recoverable) / unarchive
app.post('/api/quotes/:id/archive', (req, res) => {
  db.prepare("UPDATE quotes SET archived=1, updated_at=datetime('now'), updated_by=? WHERE id=?").run(req.headers['x-actor'] || 'demo', +req.params.id);
  audit(req.headers['x-actor'], 'archive', 'quote', req.params.id);
  res.json(db.prepare('SELECT * FROM quotes WHERE id=?').get(+req.params.id));
});
app.post('/api/quotes/:id/unarchive', (req, res) => {
  db.prepare("UPDATE quotes SET archived=0, updated_at=datetime('now'), updated_by=? WHERE id=?").run(req.headers['x-actor'] || 'demo', +req.params.id);
  audit(req.headers['x-actor'], 'unarchive', 'quote', req.params.id);
  res.json(db.prepare('SELECT * FROM quotes WHERE id=?').get(+req.params.id));
});

// Delete PERMANENTLY (lines cascade). Distinct from archive — cannot be undone.
app.delete('/api/quotes/:id', (req, res) => {
  const q = db.prepare('SELECT number, revision FROM quotes WHERE id=?').get(+req.params.id);
  if (!q) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM quote_lines WHERE quote_id=?').run(+req.params.id);
  db.prepare('DELETE FROM quotes WHERE id=?').run(+req.params.id);
  // purge this quote's per-quote history so a later rowid reuse can't inherit a stale timeline;
  // record the deletion under 'quote-deleted' so the global admin audit still keeps it.
  db.prepare("DELETE FROM audit_log WHERE entity='quote' AND entity_id=?").run(String(+req.params.id));
  audit(req.headers['x-actor'], 'delete', 'quote-deleted', req.params.id, { number: q.number, revision: q.revision });
  res.json({ ok: true });
});

app.post('/api/quotes', (req, res) => {
  const { customer_id, notes } = req.body;
  const actor = req.headers['x-actor'] || 'demo';
  const number = nextQuoteNumber();
  const r = db.prepare("INSERT INTO quotes(number, customer_id, notes, quote_date, created_by, updated_by) VALUES (?,?,?, date('now'), ?, ?)")
    .run(number, customer_id || null, notes || null, actor, actor);
  audit(actor, 'create', 'quote', r.lastInsertRowid, { number });
  res.json(db.prepare('SELECT * FROM quotes WHERE id=?').get(r.lastInsertRowid));
});

// Per-quote change history (timeline)
app.get('/api/quotes/:id/audit', (req, res) => {
  const rows = db.prepare("SELECT id, at, actor, action, detail FROM audit_log WHERE entity='quote' AND entity_id=? ORDER BY id DESC").all(String(+req.params.id));
  res.json(rows.map((r) => ({ ...r, detail: r.detail ? JSON.parse(r.detail) : null })));
});

// ---------- Attachments (mirrors the Worker's R2-backed routes using local disk) ----------
app.get('/api/quotes/:id/attachments', (req, res) => {
  res.json(db.prepare('SELECT * FROM attachments WHERE quote_id=? AND archived=0 ORDER BY uploaded_at DESC, id DESC').all(+req.params.id));
});

app.post('/api/quotes/:id/attachments', upload.single('file'), (req, res) => {
  const quoteId = +req.params.id;
  const quote = db.prepare('SELECT id FROM quotes WHERE id=?').get(quoteId);
  if (!quote) { if (req.file) fs.unlinkSync(req.file.path); return res.status(404).json({ error: 'quote not found' }); }
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  const ext = fileExt(req.file.originalname);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: `Files of type '${ext}' are not allowed for security reasons.` });
  }
  const category = ATTACHMENT_CATEGORIES.includes(req.body.category) ? req.body.category : 'other';
  const r2Key = path.relative(UPLOAD_DIR, req.file.path);
  const mimeType = req.file.mimetype || 'application/octet-stream';
  const actor = req.headers['x-actor'] || 'demo';
  const r = db.prepare(`INSERT INTO attachments(quote_id,file_name,mime_type,size_bytes,r2_key,category,uploaded_by)
      VALUES (?,?,?,?,?,?,?)`)
    .run(quoteId, req.file.originalname, mimeType, req.file.size, r2Key, category, actor);
  const newId = r.lastInsertRowid;
  audit(actor, 'upload-attachment', 'attachment', newId, { file_name: req.file.originalname, category });
  audit(actor, 'upload-attachment', 'quote', quoteId, { file_name: req.file.originalname, attachment_id: newId });
  res.json(db.prepare('SELECT * FROM attachments WHERE id=?').get(newId));
});

app.get('/api/attachments/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM attachments WHERE id=? AND archived=0').get(+req.params.id);
  if (!row) return res.status(404).json({ error: 'attachment not found' });
  const filePath = path.join(UPLOAD_DIR, row.r2_key);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'file not found in storage' });
  const forceDownload = req.query.download === '1';
  const inline = !forceDownload && INLINE_PREVIEW_MIME.has(row.mime_type);
  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${sanitizeFileName(row.file_name)}"`);
  fs.createReadStream(filePath).pipe(res);
});

app.delete('/api/attachments/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM attachments WHERE id=?').get(+req.params.id);
  if (!row) return res.status(404).json({ error: 'attachment not found' });
  db.prepare('UPDATE attachments SET archived=1 WHERE id=?').run(+req.params.id);
  audit(req.headers['x-actor'], 'remove-attachment', 'attachment', req.params.id, { file_name: row.file_name });
  audit(req.headers['x-actor'], 'remove-attachment', 'quote', row.quote_id, { file_name: row.file_name, attachment_id: +req.params.id });
  res.json({ ok: true });
});

// Manager approval — Express has no real session/role system (legacy X-Actor header only,
// already documented as insecure beyond local dev), so this route is UI-gated only here; the
// client already hides the Approve/Reject control unless effectiveRole === 'admin'.
app.patch('/api/quotes/:id/approval', (req, res) => {
  const quote = db.prepare('SELECT id FROM quotes WHERE id=?').get(+req.params.id);
  if (!quote) return res.status(404).json({ error: 'not found' });
  if (!APPROVAL_DECISIONS.includes(req.body.decision)) {
    return res.status(400).json({ error: `decision must be one of: ${APPROVAL_DECISIONS.join(', ')}` });
  }
  const actor = req.headers['x-actor'] || 'demo';
  db.prepare("UPDATE quotes SET approval_status=?, approved_by=?, approved_at=datetime('now'), approval_notes=? WHERE id=?")
    .run(req.body.decision, actor, req.body.notes || null, +req.params.id);
  audit(actor, req.body.decision === 'approved' ? 'approve' : 'reject', 'quote', req.params.id, { notes: req.body.notes || null });
  res.json(db.prepare('SELECT * FROM quotes WHERE id=?').get(+req.params.id));
});

app.get('/api/quotes/:id', (req, res) => {
  const quote = db.prepare('SELECT q.*, c.name AS customer_name, c.address AS customer_address, c.contact AS customer_contact, c.email AS customer_email FROM quotes q LEFT JOIN customers c ON c.id=q.customer_id WHERE q.id=?').get(+req.params.id);
  if (!quote) return res.status(404).json({ error: 'not found' });
  const lines = db.prepare('SELECT l.*, f.name AS family_name FROM quote_lines l LEFT JOIN families f ON f.id=l.family_id WHERE l.quote_id=? ORDER BY l.line_no').all(quote.id);
  for (const l of lines) {
    l.config = l.config_json ? JSON.parse(l.config_json) : null;
    l.spec = l.spec_summary ? JSON.parse(l.spec_summary) : null;
    l.breakdown = l.price_breakdown ? JSON.parse(l.price_breakdown) : null;
    l.companions = l.companions_json ? JSON.parse(l.companions_json) : null;
  }
  res.json({ quote, lines });
});

// ---------- Clarifications (post-offer customer queries + TAT) ----------
app.get('/api/quotes/:id/clarifications', (req, res) => {
  res.json(db.prepare('SELECT * FROM clarifications WHERE quote_id=? AND archived=0 ORDER BY raised_at DESC, id DESC').all(+req.params.id));
});

app.post('/api/quotes/:id/clarifications', (req, res) => {
  const quoteId = +req.params.id;
  const quote = db.prepare('SELECT id, status FROM quotes WHERE id=?').get(quoteId);
  if (!quote) return res.status(404).json({ error: 'quote not found' });
  if (quote.status === 'Draft') {
    return res.status(409).json({ error: 'Clarifications can only be logged once the quote has been sent as an offer (it is still Draft).' });
  }
  if (!QUERY_TYPES.includes(req.body.query_type)) {
    return res.status(400).json({ error: `query_type must be one of: ${QUERY_TYPES.join(', ')}` });
  }
  const question = String(req.body.question || '').trim();
  if (!question) return res.status(400).json({ error: 'question is required' });
  const actor = req.headers['x-actor'] || 'demo';
  const r = db.prepare('INSERT INTO clarifications(quote_id,query_type,question,raised_by) VALUES (?,?,?,?)')
    .run(quoteId, req.body.query_type, question, actor);
  const newId = r.lastInsertRowid;
  audit(actor, 'raise-clarification', 'clarification', newId, { question });
  audit(actor, 'raise-clarification', 'quote', quoteId, { question, clarification_id: newId });
  res.json(db.prepare('SELECT * FROM clarifications WHERE id=?').get(newId));
});

app.patch('/api/clarifications/:id/respond', (req, res) => {
  const row = db.prepare('SELECT * FROM clarifications WHERE id=?').get(+req.params.id);
  if (!row) return res.status(404).json({ error: 'clarification not found' });
  const response = String(req.body.response || '').trim();
  if (!response) return res.status(400).json({ error: 'response is required' });
  const actor = req.headers['x-actor'] || 'demo';
  db.prepare("UPDATE clarifications SET response=?, responded_at=datetime('now'), responded_by=?, status='answered' WHERE id=?")
    .run(response, actor, +req.params.id);
  audit(actor, 'respond-clarification', 'clarification', req.params.id, { response });
  audit(actor, 'respond-clarification', 'quote', row.quote_id, { response, clarification_id: +req.params.id });
  res.json(db.prepare('SELECT * FROM clarifications WHERE id=?').get(+req.params.id));
});

app.delete('/api/clarifications/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM clarifications WHERE id=?').get(+req.params.id);
  if (!row) return res.status(404).json({ error: 'clarification not found' });
  db.prepare('UPDATE clarifications SET archived=1 WHERE id=?').run(+req.params.id);
  const actor = req.headers['x-actor'] || 'demo';
  audit(actor, 'remove-clarification', 'clarification', req.params.id, { question: row.question });
  audit(actor, 'remove-clarification', 'quote', row.quote_id, { question: row.question, clarification_id: +req.params.id });
  res.json({ ok: true });
});

app.get('/api/fx-rates', async (req, res) => {
  try {
    const { rates, fetchedAt, stale } = await getFxRates();
    const currencies = Object.keys(rates).sort();
    res.json({ base: 'INR', currencies, rates, fetchedAt, stale });
  } catch (e) {
    res.status(502).json({ error: `Could not fetch live exchange rates: ${e.message}` });
  }
});

app.patch('/api/quotes/:id', async (req, res) => {
  const allowed = ['status', 'customer_id', 'quote_date', 'validity_days', 'terms', 'notes', 'discount_pct', 'tax_pct', 'currency', 'fx_rate'];
  const actor = req.headers['x-actor'] || 'demo';
  const quote = db.prepare('SELECT * FROM quotes WHERE id=?').get(+req.params.id);
  if (!quote) return res.status(404).json({ error: 'not found' });
  if ('status' in req.body && !QUOTE_STATUSES.includes(req.body.status)) {
    return res.status(400).json({ error: `Invalid status '${req.body.status}'. Allowed: ${QUOTE_STATUSES.join(', ')}.` });
  }
  // Field-aware finalize guard: content edits are blocked on a non-Draft quote, but
  // status transitions and archive/unarchive stay allowed (BUG-1).
  if (quote.status !== 'Draft' && CONTENT_FIELDS.some((k) => k in req.body)) {
    return res.status(409).json({ error: `Quote ${quote.number} Rev ${quote.revision} is ${quote.status} and locked — save a new revision or a new quote to edit its contents.` });
  }
  if ('discount_pct' in req.body) req.body.discount_pct = clampPct(req.body.discount_pct);
  if ('tax_pct' in req.body) req.body.tax_pct = clampPct(req.body.tax_pct);
  // Currency is paired with a live-fetched fx_rate snapshot, set together so a quote's
  // converted total stays fixed once set (and locks with everything else once finalized).
  if ('currency' in req.body) {
    let rates;
    try {
      rates = (await getFxRates()).rates;
    } catch (e) {
      return res.status(502).json({ error: `Could not fetch live exchange rates: ${e.message}` });
    }
    if (rates[req.body.currency] == null) {
      return res.status(400).json({ error: `Unsupported currency '${req.body.currency}'.` });
    }
    req.body.fx_rate = rates[req.body.currency];
  }
  const sets = [], vals = [];
  for (const k of allowed) if (k in req.body) { sets.push(`${k}=?`); vals.push(req.body[k]); }
  if (sets.length) {
    vals.push(actor, +req.params.id);
    db.prepare(`UPDATE quotes SET ${sets.join(',')}, updated_at=datetime('now'), updated_by=? WHERE id=?`).run(...vals);
    // a status change reads differently from a content edit in the timeline
    const action = (Object.keys(req.body).length === 1 && 'status' in req.body) ? 'status' : 'update';
    audit(actor, action, 'quote', req.params.id, req.body);
  }
  res.json(db.prepare('SELECT * FROM quotes WHERE id=?').get(+req.params.id));
});

// Shared: create a Draft copy of a quote (its lines included), issued today.
// mode 'revision' keeps the number and bumps the revision letter;
// mode 'newquote' assigns a fresh number at revision A.
function copyQuote(q, mode, actor) {
  const number = mode === 'revision' ? q.number : nextQuoteNumber();
  const revision = mode === 'revision' ? nextRevision(q.number) : 'A';
  if (mode === 'revision' && !revision) {
    throw Object.assign(new Error(`Quote ${q.number} has reached its last revision letter (Z). Create a new quote instead.`), { httpStatus: 409 });
  }
  // one transaction: header + all line copies + audit succeed or roll back together (SRV-5)
  const make = db.transaction(() => {
    const r = db.prepare(`INSERT INTO quotes(number,revision,customer_id,status,currency,fx_rate,quote_date,validity_days,terms,notes,discount_pct,tax_pct,created_by,updated_by)
      VALUES (?,?,?,?,?,?, date('now'), ?,?,?,?,?,?,?)`)
      .run(number, revision, q.customer_id, 'Draft', q.currency, q.fx_rate, q.validity_days, q.terms, q.notes, q.discount_pct, q.tax_pct, actor || 'demo', actor || 'demo');
    const newId = r.lastInsertRowid;
    const lines = db.prepare('SELECT * FROM quote_lines WHERE quote_id=? ORDER BY line_no').all(q.id);
    const ins = db.prepare(`INSERT INTO quote_lines(quote_id,line_no,kind,family_id,part_id,ordering_code,description,config_json,spec_summary,companions_json,qty,unit_price,price_breakdown,poa,availability,discount_pct)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const l of lines) ins.run(newId, l.line_no, l.kind, l.family_id, l.part_id, l.ordering_code, l.description, l.config_json, l.spec_summary, l.companions_json, l.qty, l.unit_price, l.price_breakdown, l.poa, l.availability, l.discount_pct);
    audit(actor, mode === 'revision' ? 'revise' : 'clone', 'quote', newId, { from: q.id, number, revision });
    return newId;
  });
  return db.prepare('SELECT * FROM quotes WHERE id=?').get(make());
}

// Revise: same number, next revision letter (Q-… Rev B)
app.post('/api/quotes/:id/revise', (req, res) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id=?').get(+req.params.id);
  if (!q) return res.status(404).json({ error: 'not found' });
  res.json(copyQuote(q, 'revision', req.headers['x-actor']));
});

// Clone: brand-new quote number, revision A (a separate quotation)
app.post('/api/quotes/:id/clone', (req, res) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id=?').get(+req.params.id);
  if (!q) return res.status(404).json({ error: 'not found' });
  res.json(copyQuote(q, 'newquote', req.headers['x-actor']));
});

// Add configured line
app.post('/api/quotes/:id/lines', (req, res) => {
  const quoteId = +req.params.id;
  const quote = requireDraftQuote(res, quoteId);   // BUG-1: only Draft quotes accept new lines
  if (!quote) return;
  const { kind } = req.body;
  const qty = clampQty(req.body.qty);
  const lineNo = (db.prepare('SELECT COALESCE(MAX(line_no),0) AS m FROM quote_lines WHERE quote_id=?').get(quoteId).m) + 1;

  if (kind === 'part') {
    const part = db.prepare('SELECT * FROM parts WHERE id=?').get(+req.body.part_id);
    if (!part) return res.status(404).json({ error: 'part not found' });
    const priceRow = db.prepare(`SELECT pp.amount FROM part_prices pp JOIN price_lists pl ON pl.id=pp.price_list_id AND pl.status='published' WHERE pp.part_id=? LIMIT 1`).get(part.id);
    const newId = db.transaction(() => {
      const r = db.prepare(`INSERT INTO quote_lines(quote_id,line_no,kind,part_id,ordering_code,description,qty,unit_price,poa)
        VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(quoteId, lineNo, 'part', part.id, part.part_number, part.name, qty, priceRow ? priceRow.amount : null, priceRow ? 0 : 1);
      stampQuote(quoteId, req.headers['x-actor']);
      audit(req.headers['x-actor'], 'add-line', 'quote', quoteId, { part: part.part_number });
      return r.lastInsertRowid;
    })();
    return res.json(db.prepare('SELECT * FROM quote_lines WHERE id=?').get(newId));
  }

  if (kind === 'custom') {
    const description = (req.body.description || '').trim();
    if (!description) return res.status(400).json({ error: 'description is required for a custom line' });
    const orderingCode = (req.body.ordering_code || '').trim() || 'CUSTOM';
    const hasPrice = req.body.unit_price != null && req.body.unit_price !== '';
    const unitPrice = hasPrice ? Math.max(0, +req.body.unit_price || 0) : null; // never silently ₹0 — blank => PoA
    const newId = db.transaction(() => {
      const r = db.prepare(`INSERT INTO quote_lines(quote_id,line_no,kind,ordering_code,description,qty,unit_price,poa)
        VALUES (?,?,?,?,?,?,?,?)`)
        .run(quoteId, lineNo, 'custom', orderingCode, description, qty, unitPrice, hasPrice ? 0 : 1);
      stampQuote(quoteId, req.headers['x-actor']);
      audit(req.headers['x-actor'], 'add-line', 'quote', quoteId, { code: orderingCode, custom: true });
      return r.lastInsertRowid;
    })();
    return res.json(db.prepare('SELECT * FROM quote_lines WHERE id=?').get(newId));
  }

  // configured product line: re-evaluate server-side (NFR-3: server is the authority)
  const familyId = +req.body.family_id;
  const meta = loadFamilyMeta(db, familyId);
  if (!meta) return res.status(404).json({ error: 'family not found' });
  if (meta.family.status === 'archived') {
    return res.status(400).json({ error: `${meta.family.name} is archived — it cannot be added to new quotations. Existing quotations that reference it are unaffected.` });
  }
  if (meta.family.status !== 'published') {
    return res.status(400).json({ error: `${meta.family.name} is still in '${meta.family.status}' status — publish it from the Admin screen before quoting.` });
  }
  const result = evaluate(meta, req.body.selections || {});
  if (!result.complete) return res.status(400).json({ error: 'Configuration incomplete', violations: result.violations });
  if (result.violations.length) return res.status(400).json({ error: 'Configuration invalid', violations: result.violations });

  const priceList = db.prepare("SELECT * FROM price_lists WHERE status='published' ORDER BY id LIMIT 1").get();
  const price = priceList ? priceConfiguration(db, priceList.id, familyId, result.effective, meta.segments) : { poa: true, total: null, breakdown: [] };
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
  const newId = db.transaction(() => {
    const r = db.prepare(`INSERT INTO quote_lines(quote_id,line_no,kind,family_id,ordering_code,description,config_json,spec_summary,companions_json,qty,unit_price,price_breakdown,poa,availability)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(quoteId, lineNo, 'config', familyId, result.code, meta.family.name,
        JSON.stringify(result.effective), JSON.stringify(spec), JSON.stringify(companions),
        qty, price.total, JSON.stringify(price.breakdown), price.poa ? 1 : 0, result.availability);
    stampQuote(quoteId, req.headers['x-actor']);
    audit(req.headers['x-actor'], 'add-line', 'quote', quoteId, { code: result.code });
    return r.lastInsertRowid;
  })();
  res.json(db.prepare('SELECT * FROM quote_lines WHERE id=?').get(newId));
});

// Reconfigure an existing configured line: re-evaluate the new selections server-side
// and update the SAME line in place (code, spec snapshot, companions, price), keeping line_no.
app.patch('/api/lines/:id/reconfigure', (req, res) => {
  const line = db.prepare('SELECT * FROM quote_lines WHERE id=?').get(+req.params.id);
  if (!line) return res.status(404).json({ error: 'line not found' });
  if (line.kind !== 'config') return res.status(400).json({ error: 'Only configured product lines can be reconfigured.' });
  if (!requireDraftQuote(res, line.quote_id)) return;   // BUG-1
  const meta = loadFamilyMeta(db, line.family_id);
  if (!meta) return res.status(404).json({ error: 'family not found' });
  if (meta.family.status === 'archived') {
    return res.status(400).json({ error: `${meta.family.name} is archived — its quotation lines cannot be reconfigured.` });
  }
  const result = evaluate(meta, req.body.selections || {});
  if (!result.complete) return res.status(400).json({ error: 'Configuration incomplete', violations: result.violations });
  if (result.violations.length) return res.status(400).json({ error: 'Configuration invalid', violations: result.violations });

  const priceList = db.prepare("SELECT * FROM price_lists WHERE status='published' ORDER BY id LIMIT 1").get();
  const price = priceList ? priceConfiguration(db, priceList.id, line.family_id, result.effective, meta.segments) : { poa: true, total: null, breakdown: [] };
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
  db.prepare(`UPDATE quote_lines SET ordering_code=?, config_json=?, spec_summary=?, companions_json=?,
      qty=?, unit_price=?, price_breakdown=?, poa=?, availability=? WHERE id=?`)
    .run(result.code, JSON.stringify(result.effective), JSON.stringify(spec), JSON.stringify(companions),
      req.body.qty || line.qty, price.total, JSON.stringify(price.breakdown), price.poa ? 1 : 0, result.availability, line.id);
  stampQuote(line.quote_id, req.headers['x-actor']);
  audit(req.headers['x-actor'], 'reconfigure-line', 'quote', line.quote_id, { line: line.id, code: result.code, was: line.ordering_code });
  res.json(db.prepare('SELECT * FROM quote_lines WHERE id=?').get(line.id));
});

app.patch('/api/lines/:id', (req, res) => {
  const line = db.prepare('SELECT quote_id, ordering_code FROM quote_lines WHERE id=?').get(+req.params.id);
  if (!line) return res.status(404).json({ error: 'line not found' });
  if (!requireDraftQuote(res, line.quote_id)) return;   // BUG-1
  if ('qty' in req.body) req.body.qty = clampQty(req.body.qty);
  if ('discount_pct' in req.body) req.body.discount_pct = clampPct(req.body.discount_pct);
  if ('unit_price' in req.body) req.body.unit_price = Math.max(0, +req.body.unit_price || 0);
  const allowed = ['qty', 'discount_pct', 'unit_price'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in req.body) { sets.push(`${k}=?`); vals.push(req.body[k]); }
  if (sets.length) {
    db.transaction(() => {
      vals.push(+req.params.id); db.prepare(`UPDATE quote_lines SET ${sets.join(',')} WHERE id=?`).run(...vals);
      stampQuote(line.quote_id, req.headers['x-actor']);
      audit(req.headers['x-actor'], 'edit-line', 'quote', line.quote_id, { code: line.ordering_code, ...req.body });
    })();
  }
  res.json(db.prepare('SELECT * FROM quote_lines WHERE id=?').get(+req.params.id));
});
app.delete('/api/lines/:id', (req, res) => {
  const line = db.prepare('SELECT quote_id, ordering_code FROM quote_lines WHERE id=?').get(+req.params.id);
  if (!line) return res.status(404).json({ error: 'line not found' });
  if (!requireDraftQuote(res, line.quote_id)) return;   // BUG-1
  db.transaction(() => {
    db.prepare('DELETE FROM quote_lines WHERE id=?').run(+req.params.id);
    stampQuote(line.quote_id, req.headers['x-actor']);
    audit(req.headers['x-actor'], 'delete-line', 'quote', line.quote_id, { code: line.ordering_code });
  })();
  res.json({ ok: true });
});

// Reorder a quote's lines: body.order is line ids in the desired order; line_no is
// renumbered 1..n to match. Ids not in `order` (if any) keep their relative order after.
app.post('/api/quotes/:id/reorder', (req, res) => {
  const quoteId = +req.params.id;
  if (!requireDraftQuote(res, quoteId)) return;   // BUG-1
  const order = Array.isArray(req.body.order) ? req.body.order.map(Number) : null;
  if (!order) return res.status(400).json({ error: 'order (array of line ids) is required' });
  const own = new Set(db.prepare('SELECT id FROM quote_lines WHERE quote_id=?').all(quoteId).map((l) => l.id));
  const seq = [...order.filter((id) => own.has(id)), ...[...own].filter((id) => !order.includes(id))];
  db.transaction(() => {
    let n = 1;
    for (const id of seq) db.prepare('UPDATE quote_lines SET line_no=? WHERE id=? AND quote_id=?').run(n++, id, quoteId);
  })();
  stampQuote(quoteId, req.headers['x-actor']);
  audit(req.headers['x-actor'], 'reorder', 'quote', quoteId, { order: seq });
  res.json({ ok: true });
});

// ---------- Admin: product categories ----------
app.get('/api/admin/categories', (req, res) => {
  res.json(db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM families f WHERE f.category_id=c.id) AS family_count
    FROM categories c ORDER BY c.sort, c.name`).all());
});
app.post('/api/admin/categories', (req, res) => {
  const { code, name, sort } = req.body;
  if (!code || !code.trim() || !name || !name.trim()) return res.status(400).json({ error: 'code and name are required' });
  if (db.prepare('SELECT 1 FROM categories WHERE code=?').get(code.trim())) {
    return res.status(409).json({ error: `Category code '${code.trim()}' already exists` });
  }
  const nextSort = sort != null && sort !== '' ? +sort : (db.prepare('SELECT COALESCE(MAX(sort),0) m FROM categories').get().m + 1);
  const r = db.prepare('INSERT INTO categories(code, name, sort) VALUES (?,?,?)').run(code.trim(), name.trim(), nextSort);
  audit(req.headers['x-actor'], 'create', 'category', r.lastInsertRowid, { code: code.trim(), name: name.trim() });
  res.json(db.prepare('SELECT * FROM categories WHERE id=?').get(r.lastInsertRowid));
});
app.patch('/api/admin/categories/:id', (req, res) => {
  const id = +req.params.id;
  const existing = db.prepare('SELECT * FROM categories WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'category not found' });
  const { code, name, sort } = req.body;
  if (code != null && code.trim() && code.trim() !== existing.code && db.prepare('SELECT 1 FROM categories WHERE code=? AND id<>?').get(code.trim(), id)) {
    return res.status(409).json({ error: `Category code '${code.trim()}' already exists` });
  }
  const sets = [], vals = [];
  if (code != null && code.trim()) { sets.push('code=?'); vals.push(code.trim()); }
  if (name != null && name.trim()) { sets.push('name=?'); vals.push(name.trim()); }
  if (sort != null && sort !== '') { sets.push('sort=?'); vals.push(+sort); }
  if (sets.length) { vals.push(id); db.prepare(`UPDATE categories SET ${sets.join(',')} WHERE id=?`).run(...vals); }
  audit(req.headers['x-actor'], 'update', 'category', id, req.body);
  res.json(db.prepare('SELECT * FROM categories WHERE id=?').get(id));
});
app.delete('/api/admin/categories/:id', (req, res) => {
  const id = +req.params.id;
  const n = db.prepare('SELECT COUNT(*) n FROM families WHERE category_id=?').get(id).n;
  if (n > 0) return res.status(409).json({ error: `Cannot delete: ${n} product famil${n === 1 ? 'y' : 'ies'} still use this category. Reassign or archive them first.` });
  db.prepare('DELETE FROM categories WHERE id=?').run(id);
  audit(req.headers['x-actor'], 'delete', 'category', id);
  res.json({ ok: true });
});

// ---------- Admin: metadata CRUD ----------
app.get('/api/admin/families', (req, res) => {
  const rows = db.prepare(`SELECT f.*, c.name AS category_name,
     (SELECT COUNT(*) FROM segments s WHERE s.family_id=f.id) AS segment_count,
     (SELECT COUNT(*) FROM rules r WHERE r.family_id=f.id) AS rule_count
   FROM families f JOIN categories c ON c.id=f.category_id ORDER BY c.sort, f.sort, f.name`).all();
  res.json(rows);
});

app.patch('/api/admin/families/:id', (req, res) => {
  const allowed = ['name', 'description', 'datasheet_ref', 'status'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in req.body) { sets.push(`${k}=?`); vals.push(req.body[k]); }
  if (sets.length) { vals.push(+req.params.id); db.prepare(`UPDATE families SET ${sets.join(',')} WHERE id=?`).run(...vals); }
  touchFamily(+req.params.id);
  audit(req.headers['x-actor'], 'update', 'family', req.params.id, req.body);
  res.json(db.prepare('SELECT * FROM families WHERE id=?').get(+req.params.id));
});

// Create a new product family (admin). Starts with an empty segment list.
app.post('/api/admin/families', (req, res) => {
  const { category_id, code, name, description, datasheet_ref, separator } = req.body;
  if (!category_id || !code || !name) return res.status(400).json({ error: 'category_id, code and name are required' });
  if (db.prepare('SELECT 1 FROM families WHERE code=?').get(code)) return res.status(409).json({ error: `Family code '${code}' already exists` });
  // new families start as DRAFT: visible to admin only, not quotable, until published
  const r = db.prepare(`INSERT INTO families(category_id, code, name, description, datasheet_ref, kind, code_template, status, updated_at)
     VALUES (?,?,?,?,?,'configurable',?, 'draft', datetime('now'))`)
    .run(category_id, code.trim(), name.trim(), description || null, datasheet_ref || null,
      JSON.stringify({ separator: separator || '-' }));
  audit(req.headers['x-actor'], 'create', 'family', r.lastInsertRowid, req.body);
  res.json(db.prepare('SELECT * FROM families WHERE id=?').get(r.lastInsertRowid));
});

// Create a new specification segment for a family
app.post('/api/admin/segments', (req, res) => {
  const { family_id, key, name, selection_type, required, help, numeric_unit } = req.body;
  if (!family_id || !key || !name) return res.status(400).json({ error: 'family_id, key and name are required' });
  if (db.prepare('SELECT 1 FROM segments WHERE family_id=? AND key=?').get(family_id, key)) {
    return res.status(409).json({ error: `Segment key '${key}' already exists in this family` });
  }
  const pos = (db.prepare('SELECT COALESCE(MAX(position),0) m FROM segments WHERE family_id=?').get(family_id).m) + 1;
  const r = db.prepare(`INSERT INTO segments(family_id, key, name, position, selection_type, required, in_code, numeric_unit, help)
     VALUES (?,?,?,?,?,?,1,?,?)`)
    .run(family_id, key.trim(), name.trim(), pos, selection_type || 'single', required === false ? 0 : 1, numeric_unit || null, help || null);
  touchFamily(family_id);
  audit(req.headers['x-actor'], 'create', 'segment', r.lastInsertRowid, req.body);
  res.json(db.prepare('SELECT * FROM segments WHERE id=?').get(r.lastInsertRowid));
});

// Create / delete dependency rules (admin power users; rule body is validated JSON)
app.post('/api/admin/rules', (req, res) => {
  const { family_id, type, rule, note } = req.body;
  if (!family_id || !type || !rule) return res.status(400).json({ error: 'family_id, type and rule are required' });
  if (!['FILTER', 'DERIVE', 'DEFAULT', 'CONSTRAINT', 'COMPOSE'].includes(type)) return res.status(400).json({ error: 'invalid rule type' });
  let parsed;
  try { parsed = typeof rule === 'string' ? JSON.parse(rule) : rule; } catch { return res.status(400).json({ error: 'rule must be valid JSON' }); }
  const r = db.prepare('INSERT INTO rules(family_id, type, rule, note) VALUES (?,?,?,?)')
    .run(family_id, type, JSON.stringify(parsed), note || null);
  touchFamily(family_id);
  audit(req.headers['x-actor'], 'create', 'rule', r.lastInsertRowid, { type, rule: parsed });
  res.json(db.prepare('SELECT * FROM rules WHERE id=?').get(r.lastInsertRowid));
});
app.patch('/api/admin/rules/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM rules WHERE id=?').get(+req.params.id);
  if (!existing) return res.status(404).json({ error: 'rule not found' });
  const { type, rule, note } = req.body;
  const sets = [], vals = [];
  if (type) {
    if (!['FILTER', 'DERIVE', 'DEFAULT', 'CONSTRAINT', 'COMPOSE'].includes(type)) return res.status(400).json({ error: 'invalid rule type' });
    sets.push('type=?'); vals.push(type);
  }
  if (rule !== undefined) {
    let parsed;
    try { parsed = typeof rule === 'string' ? JSON.parse(rule) : rule; } catch { return res.status(400).json({ error: 'rule must be valid JSON' }); }
    sets.push('rule=?'); vals.push(JSON.stringify(parsed));
  }
  if ('note' in req.body) { sets.push('note=?'); vals.push(note || null); }
  if (sets.length) { vals.push(+req.params.id); db.prepare(`UPDATE rules SET ${sets.join(',')} WHERE id=?`).run(...vals); }
  touchFamily(existing.family_id);
  audit(req.headers['x-actor'], 'update', 'rule', req.params.id, req.body);
  res.json(db.prepare('SELECT * FROM rules WHERE id=?').get(+req.params.id));
});
app.delete('/api/admin/rules/:id', (req, res) => {
  const fid = db.prepare('SELECT family_id FROM rules WHERE id=?').get(+req.params.id)?.family_id;
  db.prepare('DELETE FROM rules WHERE id=?').run(+req.params.id);
  touchFamily(fid);
  audit(req.headers['x-actor'], 'delete', 'rule', req.params.id);
  res.json({ ok: true });
});

// Usage check: which quotations reference this family (for the archive confirmation)
app.get('/api/admin/families/:id/usage', (req, res) => {
  const quotes = db.prepare(`SELECT q.id, q.number, q.revision, q.status, COUNT(l.id) AS line_count
     FROM quotes q JOIN quote_lines l ON l.quote_id = q.id
     WHERE l.family_id = ? GROUP BY q.id ORDER BY q.id DESC`).all(+req.params.id);
  res.json({ quotes, total: quotes.length });
});

// Archive / unarchive. Archiving NEVER deletes: the family and all its metadata stay
// in the database so historical quotes remain fully reproducible.
app.post('/api/admin/families/:id/archive', (req, res) => {
  const fam = db.prepare('SELECT * FROM families WHERE id=?').get(+req.params.id);
  if (!fam) return res.status(404).json({ error: 'family not found' });
  db.prepare("UPDATE families SET status='archived' WHERE id=?").run(fam.id);
  const usage = db.prepare('SELECT COUNT(DISTINCT quote_id) n FROM quote_lines WHERE family_id=?').get(fam.id).n;
  audit(req.headers['x-actor'], 'archive', 'family', fam.id, { code: fam.code, referenced_in_quotes: usage });
  res.json(db.prepare('SELECT * FROM families WHERE id=?').get(fam.id));
});
app.post('/api/admin/families/:id/unarchive', (req, res) => {
  db.prepare("UPDATE families SET status='published' WHERE id=?").run(+req.params.id);
  audit(req.headers['x-actor'], 'unarchive', 'family', req.params.id);
  res.json(db.prepare('SELECT * FROM families WHERE id=?').get(+req.params.id));
});

// Publish a draft family — with a validation gate (FR-4.4 lite): it must have at least
// one segment, and every required selectable segment needs at least one active option.
app.post('/api/admin/families/:id/publish', (req, res) => {
  const meta = loadFamilyMeta(db, +req.params.id);
  if (!meta) return res.status(404).json({ error: 'family not found' });
  const problems = [];
  if (!meta.segments.length) problems.push('The family has no specification segments yet.');
  for (const seg of meta.segments) {
    if (seg.required && ['single', 'multi'].includes(seg.selection_type) && !seg.options.length) {
      problems.push(`Segment '${seg.name}' (${seg.key}) is required but has no options.`);
    }
  }
  if (problems.length) return res.status(400).json({ error: 'Cannot publish yet', problems });
  db.prepare("UPDATE families SET status='published' WHERE id=?").run(meta.family.id);
  audit(req.headers['x-actor'], 'publish', 'family', meta.family.id, { code: meta.family.code });
  res.json(db.prepare('SELECT * FROM families WHERE id=?').get(meta.family.id));
});

app.post('/api/admin/options', (req, res) => {
  const { segment_id, code, label, is_standard, on_request, price_on_application } = req.body;
  if (!segment_id || !code || !String(code).trim() || !label || !String(label).trim()) {
    return res.status(400).json({ error: 'segment_id, code and label are required' });
  }
  if (db.prepare('SELECT 1 FROM options WHERE segment_id=? AND code=?').get(segment_id, String(code).trim())) {
    return res.status(409).json({ error: `Option code '${String(code).trim()}' already exists in this segment` });
  }
  const r = db.prepare('INSERT INTO options(segment_id,code,label,is_standard,on_request,price_on_application) VALUES (?,?,?,?,?,?)')
    .run(segment_id, String(code).trim(), label, is_standard ? 1 : 0, on_request ? 1 : 0, price_on_application ? 1 : 0);
  touchFamily(segmentFamilyId(segment_id));
  audit(req.headers['x-actor'], 'create', 'option', r.lastInsertRowid, req.body);
  res.json(db.prepare('SELECT * FROM options WHERE id=?').get(r.lastInsertRowid));
});
app.patch('/api/admin/options/:id', (req, res) => {
  const allowed = ['code', 'label', 'is_standard', 'on_request', 'price_on_application', 'status'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in req.body) { sets.push(`${k}=?`); vals.push(req.body[k]); }
  if (sets.length) { vals.push(+req.params.id); db.prepare(`UPDATE options SET ${sets.join(',')} WHERE id=?`).run(...vals); }
  touchFamily(optionFamilyId(+req.params.id));
  audit(req.headers['x-actor'], 'update', 'option', req.params.id, req.body);
  res.json(db.prepare('SELECT * FROM options WHERE id=?').get(+req.params.id));
});

app.get('/api/admin/audit', (req, res) =>
  res.json(db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all()));

// Record counts for the top-level admin tabs
app.get('/api/admin/summary', (req, res) => res.json({
  families: db.prepare('SELECT COUNT(*) n FROM families').get().n,
  spares: db.prepare('SELECT COUNT(*) n FROM parts').get().n,
  audit: db.prepare('SELECT COUNT(*) n FROM audit_log').get().n,
}));

// ---------- Data safety: backups & export (NFR-4) ----------
app.get('/api/admin/backups', (req, res) => res.json(listBackups()));
app.post('/api/admin/backups', (req, res) => {
  const file = snapshotDb(db, 'manual');
  audit(req.headers['x-actor'], 'backup', 'database', '', { file: file ? file.split('/').pop() : null });
  if (!file) return res.status(500).json({ error: 'backup failed — check server logs' });
  res.json({ ok: true, file: file.split('/').pop() });
});
// Download a consistent copy of the whole database (no lock-in — export anytime).
app.get('/api/admin/export', (req, res) => {
  db.pragma('wal_checkpoint(TRUNCATE)');
  res.download(DB_PATH, `epe-quote.${new Date().toISOString().slice(0, 10)}.db`);
});

// ---------- Admin: pricing ----------
app.get('/api/admin/prices/:familyId', (req, res) => {
  const pl = db.prepare("SELECT * FROM price_lists WHERE status='published' ORDER BY id LIMIT 1").get();
  if (!pl) return res.json({ base: [], options: [] });
  res.json({
    priceList: pl,
    base: db.prepare('SELECT * FROM base_prices WHERE price_list_id=? AND family_id=?').all(pl.id, +req.params.familyId),
    options: db.prepare('SELECT * FROM option_prices WHERE price_list_id=? AND family_id=?').all(pl.id, +req.params.familyId),
  });
});
const activePriceList = () => db.prepare("SELECT * FROM price_lists WHERE status='published' ORDER BY id LIMIT 1").get();

// Create a base price row: match is {} (generic) or {segKey: optionCode} for a keyed price.
app.post('/api/admin/base-prices', (req, res) => {
  const pl = activePriceList();
  if (!pl) return res.status(400).json({ error: 'no published price list' });
  const { family_id, match, amount } = req.body;
  if (!family_id || amount == null || amount === '') return res.status(400).json({ error: 'family_id and amount are required' });
  let matchStr = typeof match === 'string' ? (match || '{}') : JSON.stringify(match || {});
  try { JSON.parse(matchStr); } catch { return res.status(400).json({ error: 'match must be valid JSON, e.g. {"size":"0013"}' }); }
  const r = db.prepare('INSERT INTO base_prices(price_list_id,family_id,match,amount) VALUES (?,?,?,?)')
    .run(pl.id, +family_id, matchStr, +amount);
  audit(req.headers['x-actor'], 'create', 'base_price', r.lastInsertRowid, { family_id, match: matchStr, amount });
  res.json(db.prepare('SELECT * FROM base_prices WHERE id=?').get(r.lastInsertRowid));
});
app.patch('/api/admin/base-prices/:id', (req, res) => {
  const amount = +req.body.amount;
  if (!Number.isFinite(amount)) return res.status(400).json({ error: 'amount must be a number' });
  db.prepare('UPDATE base_prices SET amount=? WHERE id=?').run(amount, +req.params.id);
  audit(req.headers['x-actor'], 'update', 'base_price', req.params.id, req.body);
  res.json({ ok: true });
});
app.delete('/api/admin/base-prices/:id', (req, res) => {
  db.prepare('DELETE FROM base_prices WHERE id=?').run(+req.params.id);
  audit(req.headers['x-actor'], 'delete', 'base_price', req.params.id);
  res.json({ ok: true });
});

// Create an option adder: kind 'abs' (₹) or 'pct' (% of base).
app.post('/api/admin/option-prices', (req, res) => {
  const pl = activePriceList();
  if (!pl) return res.status(400).json({ error: 'no published price list' });
  const { family_id, segment_key, option_code, kind, amount } = req.body;
  if (!family_id || !segment_key || !option_code || amount == null || amount === '') {
    return res.status(400).json({ error: 'family_id, segment_key, option_code and amount are required' });
  }
  const existing = db.prepare('SELECT id FROM option_prices WHERE price_list_id=? AND family_id=? AND segment_key=? AND option_code=?')
    .get(pl.id, +family_id, segment_key, option_code);
  if (existing) return res.status(409).json({ error: 'an adder already exists for this option' });
  const r = db.prepare('INSERT INTO option_prices(price_list_id,family_id,segment_key,option_code,kind,amount) VALUES (?,?,?,?,?,?)')
    .run(pl.id, +family_id, segment_key, option_code, kind === 'pct' ? 'pct' : 'abs', +amount);
  audit(req.headers['x-actor'], 'create', 'option_price', r.lastInsertRowid, req.body);
  res.json(db.prepare('SELECT * FROM option_prices WHERE id=?').get(r.lastInsertRowid));
});
app.patch('/api/admin/option-prices/:id', (req, res) => {
  const sets = [], vals = [];
  if ('amount' in req.body) { sets.push('amount=?'); vals.push(+req.body.amount); }
  if ('kind' in req.body) { sets.push('kind=?'); vals.push(req.body.kind === 'pct' ? 'pct' : 'abs'); }
  if (sets.length) { vals.push(+req.params.id); db.prepare(`UPDATE option_prices SET ${sets.join(',')} WHERE id=?`).run(...vals); }
  audit(req.headers['x-actor'], 'update', 'option_price', req.params.id, req.body);
  res.json({ ok: true });
});
app.delete('/api/admin/option-prices/:id', (req, res) => {
  db.prepare('DELETE FROM option_prices WHERE id=?').run(+req.params.id);
  audit(req.headers['x-actor'], 'delete', 'option_price', req.params.id);
  res.json({ ok: true });
});

// ---------- Admin: spare parts (many-to-many with families) ----------
// Rewrite a part's family links and keep parts.family_id (primary) in sync — one transaction.
const setPartFamilies = db.transaction((partId, familyIds) => {
  const ids = [...new Set((familyIds || []).map((x) => +x).filter(Boolean))];
  db.prepare('DELETE FROM part_families WHERE part_id=?').run(partId);
  const ins = db.prepare('INSERT OR IGNORE INTO part_families(part_id, family_id) VALUES (?,?)');
  for (const fid of ids) ins.run(partId, fid);
  db.prepare('UPDATE parts SET family_id=? WHERE id=?').run(ids[0] || null, partId);
  return ids;
});
const setPartPrice = (partId, price) => {
  const pl = activePriceList();
  if (!pl) return;
  db.prepare('DELETE FROM part_prices WHERE part_id=? AND price_list_id=?').run(partId, pl.id);
  if (price != null && price !== '') db.prepare('INSERT INTO part_prices(price_list_id, part_id, amount) VALUES (?,?,?)').run(pl.id, partId, +price);
};

app.get('/api/admin/parts', (req, res) => {
  const rows = db.prepare(`SELECT p.*, f.name AS family_name,
      (SELECT amount FROM part_prices pp JOIN price_lists pl ON pl.id=pp.price_list_id AND pl.status='published' WHERE pp.part_id=p.id LIMIT 1) AS price
    FROM parts p LEFT JOIN families f ON f.id=p.family_id ORDER BY p.part_number`).all();
  res.json(rows.map((r) => ({ ...r, family_ids: partFamilyIds(r.id) })));
});

app.post('/api/admin/parts', (req, res) => {
  const { part_number, name, description, family_ids, price } = req.body;
  if (!part_number || !part_number.trim() || !name || !name.trim()) {
    return res.status(400).json({ error: 'part_number and name are required' });
  }
  if (db.prepare('SELECT 1 FROM parts WHERE part_number=?').get(part_number.trim())) {
    return res.status(409).json({ error: `Part number '${part_number.trim()}' already exists` });
  }
  const r = db.prepare("INSERT INTO parts(part_number, name, description, status) VALUES (?,?,?,'active')")
    .run(part_number.trim(), name.trim(), description || null);
  const id = r.lastInsertRowid;
  setPartFamilies(id, family_ids);
  setPartPrice(id, price);
  audit(req.headers['x-actor'], 'create', 'part', id, { part_number: part_number.trim(), name: name.trim(), family_ids: partFamilyIds(id) });
  const row = db.prepare('SELECT * FROM parts WHERE id=?').get(id);
  res.json({ ...row, family_ids: partFamilyIds(id) });
});

app.patch('/api/admin/parts/:id', (req, res) => {
  const id = +req.params.id;
  const existing = db.prepare('SELECT * FROM parts WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'part not found' });
  const { part_number, name, description, status, family_ids, price } = req.body;
  if (part_number != null && part_number.trim() && part_number.trim() !== existing.part_number) {
    if (db.prepare('SELECT 1 FROM parts WHERE part_number=? AND id<>?').get(part_number.trim(), id)) {
      return res.status(409).json({ error: `Part number '${part_number.trim()}' already exists` });
    }
  }
  const sets = [], vals = [];
  if (part_number != null && part_number.trim()) { sets.push('part_number=?'); vals.push(part_number.trim()); }
  if (name != null && name.trim()) { sets.push('name=?'); vals.push(name.trim()); }
  if ('description' in req.body) { sets.push('description=?'); vals.push(description || null); }
  if (status && ['active', 'retired'].includes(status)) { sets.push('status=?'); vals.push(status); }
  if (sets.length) { vals.push(id); db.prepare(`UPDATE parts SET ${sets.join(',')} WHERE id=?`).run(...vals); }
  if ('family_ids' in req.body) setPartFamilies(id, family_ids);
  if ('price' in req.body) setPartPrice(id, price);
  audit(req.headers['x-actor'], 'update', 'part', id, req.body);
  const row = db.prepare('SELECT * FROM parts WHERE id=?').get(id);
  res.json({ ...row, family_ids: partFamilyIds(id) });
});

// ---------- Dashboard ----------
app.get('/api/dashboard', (req, res) => {
  const byStatus = db.prepare('SELECT status, COUNT(*) AS n FROM quotes GROUP BY status').all();
  const topFamilies = db.prepare(`SELECT f.name, COUNT(*) AS n FROM quote_lines l JOIN families f ON f.id=l.family_id GROUP BY f.id ORDER BY n DESC LIMIT 8`).all();
  const poaLines = db.prepare('SELECT COUNT(*) AS n FROM quote_lines WHERE poa=1').get().n;
  const totals = db.prepare(`SELECT COUNT(*) AS quotes, (SELECT COUNT(*) FROM quote_lines) AS lines FROM quotes`).get();
  const openClarifications = db.prepare("SELECT COUNT(*) AS n FROM clarifications WHERE status='open' AND archived=0").get().n;
  const avgResponseHours = db.prepare(
    "SELECT AVG((julianday(responded_at) - julianday(raised_at)) * 24) AS h FROM clarifications WHERE status='answered' AND archived=0"
  ).get().h;
  res.json({ byStatus, topFamilies, poaLines, totals, openClarifications, avgResponseHours });
});

// ---------- Global error handler (BUG-3): map DB/constraint errors to clean 4xx ----------
// Express forwards synchronous throws from route handlers here; better-sqlite3 is
// synchronous, so constraint violations land here instead of leaking as a raw 500.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(err);
  const code = err && err.code;
  if (err && err.httpStatus) return res.status(err.httpStatus).json({ error: err.message });
  if (code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: `File is too large — maximum is ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB.` });
  }
  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
    return res.status(409).json({ error: 'That record already exists (duplicate key).' });
  }
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(400).json({ error: 'A referenced record does not exist.' });
  }
  if (code === 'SQLITE_CONSTRAINT_NOTNULL' || code === 'SQLITE_CONSTRAINT_CHECK' || (code && code.startsWith('SQLITE_CONSTRAINT'))) {
    return res.status(400).json({ error: 'The request is missing or has an invalid required value.' });
  }
  console.error('[error]', req.method, req.path, '-', err && err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4780;
app.listen(PORT, () => console.log(`EPE Quote server on http://localhost:${PORT}`));
