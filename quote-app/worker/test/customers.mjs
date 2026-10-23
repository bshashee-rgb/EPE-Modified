// Self-cleaning functional suite for the customer module (code generation, GST fields, GST-type
// derivation), against the Worker (localhost:8787).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WK = 'http://localhost:8787';
const WORKER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function login(email, password) {
  const res = await fetch(`${WK}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (res.status !== 200) { console.error(`FATAL: login failed for ${email}`); process.exit(1); }
  return (res.headers.get('set-cookie') || '').split(';')[0];
}
const SALES_COOKIE = await login('sales@test.local', 'test-sales-pw');
const ADMIN_COOKIE = await login('admin@test.local', 'test-admin-pw');
const H = { 'Content-Type': 'application/json', Cookie: SALES_COOKIE };
const HA = { 'Content-Type': 'application/json', Cookie: ADMIN_COOKIE };

const req = async (method, p, body, headers = H) => {
  const res = await fetch(WK + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
};
const get = (p, headers) => req('GET', p, undefined, headers);
const post = (p, b) => req('POST', p, b ?? {});
const patch = (p, b) => req('PATCH', p, b ?? {});

const d1exec = (sql) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'epe-quote', '--local', '--command', sql], { cwd: WORKER_DIR, encoding: 'utf8' });

let failures = 0;
const assert = (cond, label, detail) => {
  if (cond) console.log(`ok - ${label}`);
  else { failures++; console.log(`FAIL - ${label}` + (detail !== undefined ? `\n  ${JSON.stringify(detail)}` : '')); }
};

async function main() {
  // ---- create: minimal (name only) ----
  const minimal = await post('/api/customers', { name: '__test_customer_minimal__' });
  assert(minimal.status === 200, 'POST /api/customers (name only) → 200', minimal);
  assert(/^CUST-\d{4}$/.test(minimal.json.code), 'generated code matches CUST-#### format', minimal.json.code);
  assert(minimal.json.source_state === 'Telangana', 'source_state defaults to Telangana', minimal.json);
  assert(minimal.json.place_of_supply_state === null, 'place_of_supply_state defaults to null', minimal.json);
  const minimalId = minimal.json.id;

  // ---- create: full fields, different code sequence ----
  const full = await post('/api/customers', {
    name: '__test_customer_full__', contact: 'Jane Doe', phone: '9876543210', email: 'jane@test.com',
    gstin: '27ABCDE1234F1Z5', address: '123 Test St', place_of_supply_state: 'Maharashtra',
  });
  assert(full.status === 200, 'POST /api/customers (full fields) → 200', full);
  assert(full.json.code !== minimal.json.code, 'second customer gets a distinct sequential code', [minimal.json.code, full.json.code]);
  assert(full.json.place_of_supply_state === 'Maharashtra', 'place_of_supply_state stored', full.json);
  const fullId = full.json.id;

  // ---- GET single ----
  const got = await get(`/api/customers/${fullId}`);
  assert(got.status === 200 && got.json.name === '__test_customer_full__', 'GET /api/customers/:id → 200, correct row', got);
  const notFound = await get('/api/customers/999999');
  assert(notFound.status === 404, 'GET nonexistent customer → 404', notFound);

  // ---- PATCH ----
  const patched = await patch(`/api/customers/${fullId}`, { phone: '9999999999', place_of_supply_state: 'Telangana' });
  assert(patched.status === 200 && patched.json.phone === '9999999999', 'PATCH /api/customers/:id updates phone', patched.json);
  assert(patched.json.place_of_supply_state === 'Telangana', 'PATCH updates place_of_supply_state', patched.json);
  const patchNotFound = await patch('/api/customers/999999', { phone: '1' });
  assert(patchNotFound.status === 404, 'PATCH nonexistent customer → 404', patchNotFound);

  // ---- GST type derivation (pure logic, mirrors client-side gstType in indianStates.js) ----
  const gstType = (src, place) => (!src || !place) ? 'unknown' : (src === place ? 'intra' : 'inter');
  assert(gstType('Telangana', 'Telangana') === 'intra', 'gstType: same state → intra');
  assert(gstType('Telangana', 'Maharashtra') === 'inter', 'gstType: different state → inter');
  assert(gstType('Telangana', null) === 'unknown', 'gstType: missing place → unknown');
  assert(gstType(null, null) === 'unknown', 'gstType: both missing → unknown');

  // ---- admin summary includes customers count (admin-only route) ----
  const summary = await get('/api/admin/summary', HA);
  assert(summary.status === 200 && typeof summary.json.customers === 'number', 'GET /api/admin/summary exposes customers count', summary.json);

  // ---- audit trail (admin-only route) ----
  const audit = await get('/api/admin/audit', HA);
  const custAudits = audit.json.filter((r) => r.entity === 'customer' && [String(minimalId), String(fullId)].includes(r.entity_id));
  assert(custAudits.some((r) => r.action === 'create' && r.entity_id === String(fullId)), 'audit log has create entry for full customer', custAudits);
  assert(custAudits.some((r) => r.action === 'update' && r.entity_id === String(fullId)), 'audit log has update entry for full customer', custAudits);

  // ---- cleanup: customers have no DELETE route (same as before this feature) — remove via D1 ----
  d1exec(`DELETE FROM customers WHERE id IN (${minimalId},${fullId})`);
  d1exec(`DELETE FROM audit_log WHERE entity='customer' AND entity_id IN ('${minimalId}','${fullId}')`);
  const afterCleanup = await get(`/api/customers/${fullId}`);
  assert(afterCleanup.status === 404, 'cleanup: test customers removed', afterCleanup);

  console.log(`\ncustomers.mjs: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
  process.exit(failures ? 1 : 0);
}

main();
