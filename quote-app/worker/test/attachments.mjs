// Self-cleaning functional suite for the attachments + manager-approval routes, against the
// Worker (localhost:8787). Creates its own quote, uploads/downloads/removes attachments,
// exercises the approval decision as both roles, then deletes the quote it created (cascades
// the attachment rows; the R2 objects/local files themselves are left behind — acceptable for a
// disposable local/CI D1 + Miniflare-emulated R2, per the feature's documented scope).
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WK = 'http://localhost:8787';

async function login(email, password) {
  const res = await fetch(`${WK}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (res.status !== 200) { console.error(`FATAL: login failed for ${email}`); process.exit(1); }
  return (res.headers.get('set-cookie') || '').split(';')[0];
}
const ADMIN_COOKIE = await login('admin@test.local', 'test-admin-pw');
const SALES_COOKIE = await login('sales@test.local', 'test-sales-pw');

const req = async (method, p, { body, cookie = SALES_COOKIE, json = true } = {}) => {
  const headers = { Cookie: cookie };
  if (json) headers['Content-Type'] = 'application/json';
  const res = await fetch(WK + p, { method, headers, body: body !== undefined ? (json ? JSON.stringify(body) : body) : undefined });
  let out = null;
  try { out = json || res.headers.get('content-type')?.includes('json') ? await res.json() : await res.arrayBuffer(); } catch { /* no body */ }
  return { status: res.status, headers: res.headers, body: out };
};
const get = (p, opts) => req('GET', p, opts);
const post = (p, opts) => req('POST', p, opts);
const patch = (p, opts) => req('PATCH', p, opts);
const del = (p, opts) => req('DELETE', p, opts);

let failures = 0;
const assert = (cond, label, detail) => {
  if (cond) console.log(`ok - ${label}`);
  else { failures++; console.log(`FAIL - ${label}` + (detail !== undefined ? `\n  ${JSON.stringify(detail)}` : '')); }
};

function upload(quoteId, { name, type, content, category }, cookie = SALES_COOKIE) {
  const fd = new FormData();
  fd.append('file', new Blob([content], { type }), name);
  if (category) fd.append('category', category);
  return fetch(`${WK}/api/quotes/${quoteId}/attachments`, { method: 'POST', headers: { Cookie: cookie }, body: fd })
    .then(async (res) => ({ status: res.status, json: await res.json().catch(() => null) }));
}

async function main() {
  const created = await post('/api/quotes', { body: { notes: 'attachments.mjs test quote' } });
  assert(created.status === 200, 'POST /api/quotes → 200', created);
  const quoteId = created.body.id;

  // ---- upload a PDF and a PNG ----
  const pdf = await upload(quoteId, { name: 'costing.pdf', type: 'application/pdf', content: '%PDF-1.4 fake', category: 'costing' });
  assert(pdf.status === 200, 'upload PDF → 200', pdf);
  assert(pdf.json.category === 'costing', 'upload PDF category=costing', pdf.json);
  const pdfId = pdf.json.id;

  const png = await upload(quoteId, { name: 'scan.png', type: 'image/png', content: 'fake-png-bytes' });
  assert(png.status === 200, 'upload PNG → 200', png);
  assert(png.json.category === 'other', 'upload PNG defaults category=other', png.json);
  const pngId = png.json.id;

  // ---- blocked extension ----
  const exe = await upload(quoteId, { name: 'virus.exe', type: 'application/octet-stream', content: 'MZ' });
  assert(exe.status === 400, 'upload .exe → 400 (blocked extension)', exe);

  // ---- list ----
  const list = await get(`/api/quotes/${quoteId}/attachments`);
  assert(list.status === 200 && list.body.length === 2, 'list has 2 attachments', list.body);

  // ---- download ----
  const dl = await fetch(`${WK}/api/attachments/${pdfId}`, { headers: { Cookie: SALES_COOKIE } });
  assert(dl.status === 200, 'download attachment → 200', dl.status);
  assert(dl.headers.get('content-type') === 'application/pdf', 'download has correct content-type', dl.headers.get('content-type'));
  assert(dl.headers.get('content-disposition')?.startsWith('inline'), 'PDF served inline by default', dl.headers.get('content-disposition'));
  const dlForced = await fetch(`${WK}/api/attachments/${pdfId}?download=1`, { headers: { Cookie: SALES_COOKIE } });
  assert(dlForced.headers.get('content-disposition')?.startsWith('attachment'), '?download=1 forces attachment disposition', dlForced.headers.get('content-disposition'));

  // ---- approval: sales forbidden, admin allowed ----
  const salesApprove = await patch(`/api/quotes/${quoteId}/approval`, { body: { decision: 'approved' }, cookie: SALES_COOKIE });
  assert(salesApprove.status === 403, 'sales PATCH approval → 403', salesApprove);

  const adminReject = await patch(`/api/quotes/${quoteId}/approval`, { body: { decision: 'rejected', notes: 'needs rework' }, cookie: ADMIN_COOKIE });
  assert(adminReject.status === 200 && adminReject.body.approval_status === 'rejected', 'admin PATCH approval rejected → 200', adminReject);
  assert(adminReject.body.approval_notes === 'needs rework', 'approval_notes stored', adminReject.body);

  const afterReject = await get(`/api/quotes/${quoteId}`);
  assert(afterReject.body.quote.approval_status === 'rejected', 'GET quote reflects rejected approval_status', afterReject.body.quote);

  const adminApprove = await patch(`/api/quotes/${quoteId}/approval`, { body: { decision: 'approved' }, cookie: ADMIN_COOKIE });
  assert(adminApprove.status === 200 && adminApprove.body.approval_status === 'approved', 'admin PATCH approval approved → 200', adminApprove);

  // ---- soft-remove ----
  const removed = await del(`/api/attachments/${pngId}`);
  assert(removed.status === 200, 'DELETE attachment → 200', removed);
  const listAfterRemove = await get(`/api/quotes/${quoteId}/attachments`);
  assert(listAfterRemove.body.length === 1, 'removed attachment no longer listed', listAfterRemove.body);
  const dlRemoved = await fetch(`${WK}/api/attachments/${pngId}`, { headers: { Cookie: SALES_COOKIE } });
  assert(dlRemoved.status === 404, 'removed attachment 404s on download (soft-remove, not hard delete)', dlRemoved.status);

  // ---- audit trail ----
  const audit = await get(`/api/quotes/${quoteId}/audit`);
  const actions = audit.body.map((r) => r.action);
  assert(actions.includes('upload-attachment'), 'audit log has upload-attachment entries', actions);
  assert(actions.includes('reject'), 'audit log has reject entry', actions);
  assert(actions.includes('approve'), 'audit log has approve entry', actions);
  assert(actions.includes('remove-attachment'), 'audit log has remove-attachment entry', actions);

  // ---- cleanup ----
  const deleted = await del(`/api/quotes/${quoteId}`);
  assert(deleted.status === 200, 'cleanup: DELETE test quote → 200', deleted);

  console.log(`\nattachments.mjs: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
  process.exit(failures ? 1 : 0);
}

main();
