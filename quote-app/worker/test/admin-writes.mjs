// Self-cleaning functional suite for the admin write routes, against the Worker (localhost:8787).
// Creates its own category/family/segment/options/rule/prices/part, exercises every admin write
// route added in Task 8, then deletes everything it created (via the API where a DELETE route
// exists, via direct local-D1 `wrangler d1 execute` statements for the rows that have none) so
// the DB is restored to baseline. Plain fetch + assert, no deps.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WK = 'http://localhost:8787';
const WORKER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // .../quote-app/worker

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Worker requires a session (admin role, for the /api/admin/* routes below) on all /api/*
// (except /api/auth/login and /api/ping). Log in once as the seeded test admin and attach
// the cookie to every request below.
const _login = await fetch('http://localhost:8787/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@test.local', password: 'test-admin-pw' }) });
if (_login.status !== 200) { console.error('FATAL: test admin login failed'); process.exit(1); }
const COOKIE = (_login.headers.get('set-cookie') || '').split(';')[0];
const H = { 'X-Actor': 'admin', 'Content-Type': 'application/json', Cookie: COOKIE };

// Retries on a transient network-level failure only (e.g. ECONNRESET), never on an HTTP
// status — those are real assertions. This guards against the brief exchange right after a
// direct `wrangler d1 execute --local` write below, where the standalone CLI process and the
// running `wrangler dev` miniflare instance briefly contend for the same local D1 sqlite file.
const req = async (method, path_, body, attempt = 0) => {
  try {
    const res = await fetch(WK + path_, { method, headers: H, body: body !== undefined ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await res.json(); } catch { /* no body */ }
    return { status: res.status, json };
  } catch (err) {
    if (attempt < 2) { await sleep(250); return req(method, path_, body, attempt + 1); }
    throw err;
  }
};
const get = (p) => req('GET', p);
const post = (p, b) => req('POST', p, b ?? {});
const patch = (p, b) => req('PATCH', p, b ?? {});
const del = (p) => req('DELETE', p);

let failures = 0;
const assert = (cond, label, detail) => {
  if (cond) { console.log(`ok - ${label}`); }
  else { failures++; console.log(`FAIL - ${label}` + (detail !== undefined ? `\n  ${JSON.stringify(detail)}` : '')); }
};

// Direct local-D1 statement(s) (semicolon-joined for a single `--command` is fine), for the
// handful of admin rows that have no DELETE route (segments, options, families, parts).
const d1exec = (sql) => {
  console.log(`  [d1] ${sql}`);
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'epe-quote', '--local', '--command', sql], {
    cwd: WORKER_DIR, encoding: 'utf8',
  });
  return out;
};

async function main() {
  // ---- baseline ----
  const summary0 = await get('/api/admin/summary');
  assert(summary0.status === 200, 'baseline GET /api/admin/summary → 200', summary0);
  const catalog0 = await get('/api/catalog');
  assert(catalog0.status === 200, 'baseline GET /api/catalog → 200', catalog0);
  const startFamilies = summary0.json.families;
  const startParts = summary0.json.spares;
  const startCategories = catalog0.json.categories.length;

  // ---- create category ----
  const catCode = `ZT8${Date.now() % 100000}`;
  const cat = await post('/api/admin/categories', { code: catCode, name: 'Admin Writes Test Category' });
  assert(cat.status === 200, 'POST /api/admin/categories → 200', cat);
  const catId = cat.json.id;

  // ---- duplicate code → 409 ----
  const catDup = await post('/api/admin/categories', { code: catCode, name: 'dup' });
  assert(catDup.status === 409, 'POST /api/admin/categories duplicate code → 409', catDup);

  // ---- create draft family in it ----
  const famCode = `ZT8FAM${Date.now() % 100000}`;
  const fam = await post('/api/admin/families', { category_id: catId, code: famCode, name: 'Admin Writes Test Family' });
  assert(fam.status === 200, 'POST /api/admin/families → 200', fam);
  assert(fam.json.status === 'draft', 'new family starts draft', fam.json);
  const famId = fam.json.id;

  // ---- publish with no segments → 400, problems ----
  const publishEmpty = await post(`/api/admin/families/${famId}/publish`);
  assert(publishEmpty.status === 400, 'POST publish (no segments) → 400', publishEmpty);
  assert(Array.isArray(publishEmpty.json.problems) && publishEmpty.json.problems.some((p) => p.includes('no specification segments')),
    'publish problems mention missing segments', publishEmpty.json);

  // ---- add segment + 2 options (one standard: default configuration must be complete) ----
  const seg = await post('/api/admin/segments', { family_id: famId, key: 'size', name: 'Size', selection_type: 'single', required: true });
  assert(seg.status === 200, 'POST /api/admin/segments → 200', seg);
  const segId = seg.json.id;

  const opt10 = await post('/api/admin/options', { segment_id: segId, code: '10', label: '10mm', is_standard: true });
  assert(opt10.status === 200, 'POST /api/admin/options (10, standard) → 200', opt10);
  const opt20 = await post('/api/admin/options', { segment_id: segId, code: '20', label: '20mm' });
  assert(opt20.status === 200, 'POST /api/admin/options (20) → 200', opt20);

  // ---- rules CRUD (inert CONSTRAINT rule, exercises create/patch/delete) ----
  const rule = await post('/api/admin/rules', { family_id: famId, type: 'CONSTRAINT', rule: {} });
  assert(rule.status === 200, 'POST /api/admin/rules → 200', rule);
  const ruleId = rule.json.id;
  const ruleBadType = await post('/api/admin/rules', { family_id: famId, type: 'BOGUS', rule: {} });
  assert(ruleBadType.status === 400, 'POST /api/admin/rules invalid type → 400', ruleBadType);
  const ruleUpdated = await patch(`/api/admin/rules/${ruleId}`, { note: 'admin-writes test rule' });
  assert(ruleUpdated.status === 200 && ruleUpdated.json.note === 'admin-writes test rule', 'PATCH /api/admin/rules/:id → 200', ruleUpdated);

  // ---- constraint-mapped error handler (Task 9): FK violation thrown by D1, mapped by
  // app.onError. /api/admin/rules has no pre-check for family_id (unlike categories/options/
  // parts, which reject duplicates before hitting the DB), so this is the route that actually
  // exercises the onError FOREIGN KEY mapping rather than a route's own guard clause.
  const ruleBadFK = await post('/api/admin/rules', { family_id: 999999, type: 'CONSTRAINT', rule: {} });
  assert(ruleBadFK.status === 400, 'POST /api/admin/rules non-existent family_id (FK) → 400', ruleBadFK);
  assert(ruleBadFK.json && ruleBadFK.json.error === 'A referenced record does not exist.',
    'FK violation mapped to onError message', ruleBadFK.json);
  // Safety net, not a silent pass: if D1 does NOT enforce the FK (statement succeeds instead of
  // throwing), the assertions above already FAIL loudly — but a bogus family_id=999999 row would
  // otherwise be left behind and accumulate across repeated runs. Clean it up regardless.
  if (ruleBadFK.status === 200 && ruleBadFK.json && ruleBadFK.json.id) {
    await del(`/api/admin/rules/${ruleBadFK.json.id}`);
  }

  // ---- publish → 200 ----
  const published = await post(`/api/admin/families/${famId}/publish`);
  assert(published.status === 200, 'POST publish (with segment+options) → 200', published);
  assert(published.json.status === 'published', 'family status is published', published.json);

  // ---- base price (match {} = generic) + option adder ----
  const basePrice = await post('/api/admin/base-prices', { family_id: famId, match: {}, amount: 1000 });
  assert(basePrice.status === 200, 'POST /api/admin/base-prices → 200', basePrice);
  const basePriceId = basePrice.json.id;

  // adder on the NON-default option ('20'), so it doesn't perturb the evaluate() total below
  const optionPrice = await post('/api/admin/option-prices', { family_id: famId, segment_key: 'size', option_code: '20', kind: 'abs', amount: 500 });
  assert(optionPrice.status === 200, 'POST /api/admin/option-prices → 200', optionPrice);
  const optionPriceId = optionPrice.json.id;
  const optionPriceDup = await post('/api/admin/option-prices', { family_id: famId, segment_key: 'size', option_code: '20', kind: 'abs', amount: 999 });
  assert(optionPriceDup.status === 409, 'POST /api/admin/option-prices duplicate adder → 409', optionPriceDup);

  // ---- evaluate: no selections → auto-defaults to the standard option '10', complete + priced ----
  const evaluated = await post(`/api/families/${famId}/evaluate`, {});
  assert(evaluated.status === 200, 'POST /api/families/:id/evaluate → 200', evaluated);
  assert(evaluated.json.complete === true, 'evaluate result is complete', evaluated.json);
  assert(evaluated.json.effective && evaluated.json.effective.size === '10', 'evaluate defaulted size to standard option 10', evaluated.json.effective);
  assert(evaluated.json.price && evaluated.json.price.total === 1000, 'evaluate priced result total === 1000', evaluated.json.price);

  // ---- create part linked to the family ----
  const partNumber = `ZT8-PART-${Date.now() % 100000}`;
  const part = await post('/api/admin/parts', { part_number: partNumber, name: 'Admin Writes Test Part', family_ids: [famId], price: 250 });
  assert(part.status === 200, 'POST /api/admin/parts → 200', part);
  assert(Array.isArray(part.json.family_ids) && part.json.family_ids.includes(famId), 'new part linked to test family', part.json);
  const partId = part.json.id;

  // ---- duplicate part_number → 409 via the route's own explicit pre-check (not onError —
  // /api/admin/parts guards this before the INSERT, so the UNIQUE constraint in D1 is never
  // actually hit; the message below is the route's own, not onError's duplicate-key text) ----
  const partDup = await post('/api/admin/parts', { part_number: partNumber, name: 'Admin Writes Test Part Dup' });
  assert(partDup.status === 409, 'POST /api/admin/parts duplicate part_number → 409', partDup);
  assert(partDup.json && partDup.json.error === `Part number '${partNumber}' already exists`,
    'duplicate part_number error message (route pre-check path)', partDup.json);

  // ---- patch part price ----
  const partPatch = await patch(`/api/admin/parts/${partId}`, { price: 300 });
  assert(partPatch.status === 200, 'PATCH /api/admin/parts/:id (price) → 200', partPatch);
  const partsList = await get('/api/admin/parts');
  assert(partsList.status === 200, 'GET /api/admin/parts (post-patch check) → 200', partsList);
  const patchedPart = partsList.json.find((p) => p.id === partId);
  assert(patchedPart && patchedPart.price === 300, 'part price updated to 300 (via GET /api/admin/parts)', patchedPart);

  // ---- delete category while family still uses it → 409 ----
  const catDeleteBlocked = await del(`/api/admin/categories/${catId}`);
  assert(catDeleteBlocked.status === 409, 'DELETE category with family still in it → 409', catDeleteBlocked);

  // ================= cleanup =================
  // 1. rows with a DELETE route: rule, option-price, base-price
  const ruleDeleted = await del(`/api/admin/rules/${ruleId}`);
  assert(ruleDeleted.status === 200 && ruleDeleted.json.ok === true, 'DELETE cleanup rule → 200', ruleDeleted);
  const optionPriceDeleted = await del(`/api/admin/option-prices/${optionPriceId}`);
  assert(optionPriceDeleted.status === 200 && optionPriceDeleted.json.ok === true, 'DELETE cleanup option-price → 200', optionPriceDeleted);
  const basePriceDeleted = await del(`/api/admin/base-prices/${basePriceId}`);
  assert(basePriceDeleted.status === 200 && basePriceDeleted.json.ok === true, 'DELETE cleanup base-price → 200', basePriceDeleted);

  // 2. archive the family (exercises the archive route; archiving never deletes)
  const archived = await post(`/api/admin/families/${famId}/archive`);
  assert(archived.status === 200 && archived.json.status === 'archived', 'POST cleanup archive family → 200', archived);

  // 3. rows with NO DELETE route (segments, options, families, parts): direct local-D1 execute,
  // as ONE invocation (one process spawn = one narrow contention window with the running
  // `wrangler dev` miniflare instance, instead of six). Order respects FKs (children before
  // parents) even though D1/sqlite ON DELETE CASCADE would also handle it, to keep this
  // cleanup correct regardless of the FK pragma state.
  try {
    d1exec([
      `DELETE FROM options WHERE segment_id=${segId}`, // removes options '10' and '20'
      `DELETE FROM segments WHERE id=${segId}`,
      `DELETE FROM part_families WHERE part_id=${partId}`,
      `DELETE FROM part_prices WHERE part_id=${partId}`,
      `DELETE FROM parts WHERE id=${partId}`,
      `DELETE FROM families WHERE id=${famId}`,
    ].join('; '));
    assert(true, 'direct-D1 cleanup of segments/options/part/family rows succeeded');
  } catch (err) {
    assert(false, 'direct-D1 cleanup of segments/options/part/family rows succeeded', String(err));
  }
  // let the standalone `wrangler d1 execute` process's file handle fully release before the
  // next request against the running dev server's local D1 binding.
  await sleep(300);

  // 4. now the category has 0 families → DELETE via API succeeds
  const catDeleted = await del(`/api/admin/categories/${catId}`);
  assert(catDeleted.status === 200 && catDeleted.json.ok === true, 'DELETE cleanup category → 200', catDeleted);

  // ---- final counts match baseline ----
  const summaryFinal = await get('/api/admin/summary');
  assert(summaryFinal.status === 200, 'final GET /api/admin/summary → 200', summaryFinal);
  const catalogFinal = await get('/api/catalog');
  assert(catalogFinal.status === 200, 'final GET /api/catalog → 200', catalogFinal);
  assert(summaryFinal.json.families === startFamilies, `final families count (${summaryFinal.json.families}) equals starting (${startFamilies})`, summaryFinal.json);
  assert(summaryFinal.json.spares === startParts, `final parts count (${summaryFinal.json.spares}) equals starting (${startParts})`, summaryFinal.json);
  assert(catalogFinal.json.categories.length === startCategories, `final categories count (${catalogFinal.json.categories.length}) equals starting (${startCategories})`, catalogFinal.json.categories.length);

  // ==================== Task 9: D1-native backups / export ====================
  // ---- backups: D1 Time Travel replaces file snapshots — the list is always empty, and
  // triggering one is just an audit-logged no-op acknowledging Time Travel is already on ----
  const backupsList = await get('/api/admin/backups');
  assert(backupsList.status === 200 && Array.isArray(backupsList.json) && backupsList.json.length === 0,
    'GET /api/admin/backups → 200 []', backupsList);
  const backupTrigger = await post('/api/admin/backups');
  assert(backupTrigger.status === 200 && backupTrigger.json &&
    backupTrigger.json.ok === true && backupTrigger.json.file === null &&
    backupTrigger.json.note === 'Backups are automatic on Cloudflare D1 (Time Travel, 30-day point-in-time restore).',
    'POST /api/admin/backups → 200 {ok:true, file:null, note:…}', backupTrigger);

  // ---- export: full-database JSON dump, downloadable, all 18 tables, row counts sane ----
  const EXPORT_TABLE_KEYS = ['categories', 'families', 'segments', 'options', 'rules', 'companion_links',
    'parts', 'part_families', 'price_lists', 'base_prices', 'option_prices', 'part_prices',
    'customers', 'quotes', 'quote_lines', 'audit_log', 'attachments', 'clarifications'];
  const exportRes = await fetch(`${WK}/api/admin/export`, { headers: H });
  const exportJson = await exportRes.json();
  assert(exportRes.status === 200, 'GET /api/admin/export → 200', exportRes.status);
  const cd = exportRes.headers.get('content-disposition') || '';
  assert(cd.includes('epe-quote.'), 'export Content-Disposition contains "epe-quote."', cd);
  const exportKeys = Object.keys(exportJson);
  assert(exportKeys.length === EXPORT_TABLE_KEYS.length && EXPORT_TABLE_KEYS.every((t) => exportKeys.includes(t)),
    'export body has exactly the 18 table keys', exportKeys);
  // spot-check row counts for 3 tables against other already-verified endpoints (DB is back at
  // baseline here, so these are also the steady-state counts)
  const dashboardForExport = await get('/api/dashboard');
  assert(exportJson.quotes.length === dashboardForExport.json.totals.quotes,
    `export quotes row count (${exportJson.quotes.length}) matches /api/dashboard totals.quotes (${dashboardForExport.json.totals.quotes})`,
    { export: exportJson.quotes.length, dashboard: dashboardForExport.json.totals.quotes });
  assert(exportJson.families.length === summaryFinal.json.families,
    `export families row count (${exportJson.families.length}) matches /api/admin/summary (${summaryFinal.json.families})`,
    { export: exportJson.families.length, summary: summaryFinal.json.families });
  assert(exportJson.categories.length === catalogFinal.json.categories.length,
    `export categories row count (${exportJson.categories.length}) matches /api/catalog (${catalogFinal.json.categories.length})`,
    { export: exportJson.categories.length, catalog: catalogFinal.json.categories.length });

  if (failures) {
    console.log(`\n${failures} ADMIN-WRITES TEST FAILURE(S)`);
    process.exit(1);
  } else {
    console.log('\nALL ADMIN-WRITES TESTS PASSED, db restored to baseline');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
