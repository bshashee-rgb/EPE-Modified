// Self-cleaning functional suite for the write routes, against the Worker (localhost:8787).
// Creates its own quotes (and revise/clone copies), asserts behavior, then deletes
// everything it created so the DB is restored to baseline. Plain fetch + assert, no deps.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WK = 'http://localhost:8787';
const WORKER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // .../quote-app/worker
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Worker requires a session on all /api/* (except /api/auth/login and /api/ping). Log in
// once as the seeded test admin and attach the cookie to every request below.
const _login = await fetch('http://localhost:8787/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@test.local', password: 'test-admin-pw' }) });
if (_login.status !== 200) { console.error('FATAL: test admin login failed'); process.exit(1); }
const COOKIE = (_login.headers.get('set-cookie') || '').split(';')[0];
const H = { 'X-Actor': 'sales', 'Content-Type': 'application/json', Cookie: COOKIE };

// customers have no DELETE route (Express nor worker) — the test customer this suite
// creates is removed directly via local D1, same pattern as admin-writes.mjs.
const d1exec = (sql) => {
  console.log(`  [d1] ${sql}`);
  return execFileSync('npx', ['wrangler', 'd1', 'execute', 'epe-quote', '--local', '--command', sql], {
    cwd: WORKER_DIR, encoding: 'utf8',
  });
};

const req = async (method, path, body) => {
  const res = await fetch(WK + path, { method, headers: H, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
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

const createdQuoteIds = [];

async function main() {
  // ---- baseline ----
  const baseline = await get('/api/quotes?archived=1');
  assert(baseline.status === 200, 'baseline GET /api/quotes?archived=1 → 200', baseline);
  const startCount = baseline.json.length;

  // ---- POST /api/quotes with NO body at all (Express's json() treats an empty body as
  // {}; Hono's c.req.json() throws unless caught — this must still succeed) ----
  const noBodyRes = await fetch(`${WK}/api/quotes`, { method: 'POST', headers: H });
  const noBodyJson = await noBodyRes.json().catch(() => null);
  assert(noBodyRes.status === 200, 'POST /api/quotes with no body → 200', { status: noBodyRes.status, json: noBodyJson });
  assert(typeof noBodyJson?.number === 'string' && noBodyJson.number.length > 0, 'no-body quote has a number', noBodyJson);
  const noBodyDel = await del(`/api/quotes/${noBodyJson.id}`);
  assert(noBodyDel.status === 200 && noBodyDel.json.ok === true, 'DELETE no-body quote → 200', noBodyDel);

  // ---- create quote ----
  const created = await post('/api/quotes', { notes: 'writes.mjs test quote' });
  assert(created.status === 200, 'POST /api/quotes → 200', created);
  const quote = created.json;
  createdQuoteIds.push(quote.id);
  assert(quote.status === 'Draft', 'new quote starts Draft', quote);

  // ---- add config line #1 (LD, connection G06) ----
  const line1 = await post(`/api/quotes/${quote.id}/lines`, { kind: 'config', family_id: 1, selections: { connection: 'G06' } });
  assert(line1.status === 200, 'POST add config line #1 → 200', line1);
  assert(line1.json.ordering_code === '160-LD-0013-H10XP-A-0P-0-9-0-G06-P-0-0', 'line #1 golden ordering_code', line1.json.ordering_code);
  assert(line1.json.unit_price === 49100, 'line #1 unit_price === 49100', line1.json.unit_price);
  const line1Id = line1.json.id;

  // ---- add config line #2 (same config, for reorder test) ----
  const line2 = await post(`/api/quotes/${quote.id}/lines`, { kind: 'config', family_id: 1, selections: { connection: 'G06' } });
  assert(line2.status === 200, 'POST add config line #2 → 200', line2);
  const line2Id = line2.json.id;

  // ---- reorder: reverse the two line ids → 200, line_no renumbered ----
  const reordered = await post(`/api/quotes/${quote.id}/reorder`, { order: [line2Id, line1Id] });
  assert(reordered.status === 200, 'POST reorder (reversed) → 200', reordered);
  const afterReorder = await get(`/api/quotes/${quote.id}`);
  const l2 = afterReorder.json.lines.find((l) => l.id === line2Id);
  const l1 = afterReorder.json.lines.find((l) => l.id === line1Id);
  assert(l2.line_no === 1 && l1.line_no === 2, 'reorder renumbered line_no (line2→1, line1→2)', afterReorder.json.lines);

  // ---- patch qty on line #1 to 3 ----
  const qtyPatch = await patch(`/api/lines/${line1Id}`, { qty: 3 });
  assert(qtyPatch.status === 200, 'PATCH line qty → 200', qtyPatch);
  assert(qtyPatch.json.qty === 3, 'line qty updated to 3', qtyPatch.json.qty);

  // ---- customers: POST /api/customers (BUG: missing route ported from Express), then
  // wire the created customer onto this still-Draft quote and verify it round-trips ----
  const customersBaseline = await get('/api/customers');
  assert(customersBaseline.status === 200, 'baseline GET /api/customers → 200', customersBaseline);
  const custStartCount = customersBaseline.json.length;

  const custCreated = await post('/api/customers', { name: '__test_customer__', contact: 't', email: 't@t.t' });
  assert(custCreated.status === 200, 'POST /api/customers → 200', custCreated);
  assert(typeof custCreated.json.id === 'number', 'created customer has an id', custCreated.json);
  assert(custCreated.json.name === '__test_customer__', 'created customer name matches', custCreated.json);
  const custId = custCreated.json.id;

  const custPatch = await patch(`/api/quotes/${quote.id}`, { customer_id: custId });
  assert(custPatch.status === 200, 'PATCH quote customer_id → 200', custPatch);
  assert(custPatch.json.customer_id === custId, 'quote customer_id updated', custPatch.json);

  const quoteWithCustomer = await get(`/api/quotes/${quote.id}`);
  assert(quoteWithCustomer.status === 200, 'GET quote after customer PATCH → 200', quoteWithCustomer);
  assert(quoteWithCustomer.json.quote.customer_name === '__test_customer__', 'GET quote shows customer_name __test_customer__', quoteWithCustomer.json.quote);

  // ---- invalid status PATCH → 400 ----
  const badStatus = await patch(`/api/quotes/${quote.id}`, { status: 'Bogus' });
  assert(badStatus.status === 400, 'PATCH invalid status → 400', badStatus);

  // ---- mark Sent ----
  const sent = await patch(`/api/quotes/${quote.id}`, { status: 'Sent' });
  assert(sent.status === 200, 'PATCH status → Sent → 200', sent);
  assert(sent.json.status === 'Sent', 'quote status is Sent', sent.json);

  // ---- content edit on non-Draft quote → 409 ----
  const contentEdit = await patch(`/api/quotes/${quote.id}`, { notes: 'should be blocked' });
  assert(contentEdit.status === 409, 'PATCH content field on Sent quote → 409', contentEdit);

  // ---- add-line on non-Draft quote → 409 ----
  const addLineBlocked = await post(`/api/quotes/${quote.id}/lines`, { kind: 'config', family_id: 1, selections: { connection: 'G06' } });
  assert(addLineBlocked.status === 409, 'POST add-line on Sent quote → 409', addLineBlocked);

  // ---- revise: same number, next revision letter, Draft, same line count ----
  const revised = await post(`/api/quotes/${quote.id}/revise`);
  assert(revised.status === 200, 'POST revise → 200', revised);
  const revB = revised.json;
  createdQuoteIds.push(revB.id);
  assert(revB.number === quote.number, 'revision keeps same number', revB);
  assert(revB.revision === 'B', 'revision letter is B', revB);
  assert(revB.status === 'Draft', 'revision starts Draft', revB);
  const revBFull = await get(`/api/quotes/${revB.id}`);
  assert(revBFull.json.lines.length === 2, 'revision B has same line count (2)', revBFull.json.lines);

  // ---- clone: new number, revision A ----
  const cloned = await post(`/api/quotes/${quote.id}/clone`);
  assert(cloned.status === 200, 'POST clone → 200', cloned);
  const clone = cloned.json;
  createdQuoteIds.push(clone.id);
  assert(clone.number !== quote.number, 'clone has a new number', clone);
  assert(clone.revision === 'A', 'clone revision is A', clone);

  // ---- archive / unarchive ----
  const archived = await post(`/api/quotes/${quote.id}/archive`);
  assert(archived.status === 200, 'POST archive → 200', archived);
  assert(archived.json.archived === 1, 'quote is archived', archived.json);
  const unarchived = await post(`/api/quotes/${quote.id}/unarchive`);
  assert(unarchived.status === 200, 'POST unarchive → 200', unarchived);
  assert(unarchived.json.archived === 0, 'quote is unarchived', unarchived.json);

  // ---- DELETE nonexistent quote → 404 ----
  const missingDelete = await del('/api/quotes/999999999');
  assert(missingDelete.status === 404, 'DELETE nonexistent quote → 404', missingDelete);

  // ---- cleanup: delete every quote this run created ----
  for (const id of createdQuoteIds) {
    const d = await del(`/api/quotes/${id}`);
    assert(d.status === 200 && d.json.ok === true, `DELETE cleanup quote ${id} → 200`, d);
  }

  // ---- final count matches baseline ----
  const final = await get('/api/quotes?archived=1');
  assert(final.status === 200, 'final GET /api/quotes?archived=1 → 200', final);
  assert(final.json.length === startCount, `final count (${final.json.length}) equals starting count (${startCount})`, { startCount, finalCount: final.json.length });

  // ---- cleanup: remove the test customer directly via local D1 (no DELETE route exists) ----
  try {
    d1exec("DELETE FROM customers WHERE name='__test_customer__'");
    assert(true, 'direct-D1 cleanup of test customer succeeded');
  } catch (err) {
    assert(false, 'direct-D1 cleanup of test customer succeeded', String(err));
  }
  // let the standalone `wrangler d1 execute` process's file handle fully release before the
  // next request against the running dev server's local D1 binding.
  await sleep(300);

  const customersFinal = await get('/api/customers');
  assert(customersFinal.status === 200, 'final GET /api/customers → 200', customersFinal);
  assert(customersFinal.json.length === custStartCount, `final customers count (${customersFinal.json.length}) equals starting count (${custStartCount})`, { custStartCount, finalCount: customersFinal.json.length });

  if (failures) {
    console.log(`\n${failures} WRITE TEST FAILURE(S)`);
    process.exit(1);
  } else {
    console.log('\nALL WRITE TESTS PASSED, db restored to baseline');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
