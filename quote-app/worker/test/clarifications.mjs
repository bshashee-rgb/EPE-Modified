// Self-cleaning functional suite for the post-offer clarifications + TAT routes, against the
// Worker (localhost:8787). Creates its own quote, logs/responds/removes clarifications, checks
// the Dashboard TAT aggregate, then deletes the quote it created.
const WK = 'http://localhost:8787';

async function login(email, password) {
  const res = await fetch(`${WK}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (res.status !== 200) { console.error(`FATAL: login failed for ${email}`); process.exit(1); }
  return (res.headers.get('set-cookie') || '').split(';')[0];
}
const COOKIE = await login('sales@test.local', 'test-sales-pw');
const H = { 'Content-Type': 'application/json', Cookie: COOKIE };

const req = async (method, p, body) => {
  const res = await fetch(WK + p, { method, headers: H, body: body !== undefined ? JSON.stringify(body) : undefined });
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
  if (cond) console.log(`ok - ${label}`);
  else { failures++; console.log(`FAIL - ${label}` + (detail !== undefined ? `\n  ${JSON.stringify(detail)}` : '')); }
};

async function main() {
  const created = await post('/api/quotes', { notes: 'clarifications.mjs test quote' });
  assert(created.status === 200, 'POST /api/quotes → 200', created);
  const quoteId = created.json.id;

  // ---- post-offer gating: Draft quote rejects a clarification ----
  const draftBlocked = await post(`/api/quotes/${quoteId}/clarifications`, { query_type: 'technical', question: 'too early' });
  assert(draftBlocked.status === 409, 'POST clarification on Draft quote → 409', draftBlocked);

  const sent = await patch(`/api/quotes/${quoteId}`, { status: 'Sent' });
  assert(sent.status === 200 && sent.json.status === 'Sent', 'PATCH status → Sent → 200', sent);

  // ---- invalid query_type ----
  const badType = await post(`/api/quotes/${quoteId}/clarifications`, { query_type: 'bogus', question: 'x' });
  assert(badType.status === 400, 'POST clarification invalid query_type → 400', badType);

  // ---- missing question ----
  const noQuestion = await post(`/api/quotes/${quoteId}/clarifications`, { query_type: 'technical', question: '  ' });
  assert(noQuestion.status === 400, 'POST clarification blank question → 400', noQuestion);

  // ---- log technical + commercial ----
  const tech = await post(`/api/quotes/${quoteId}/clarifications`, { query_type: 'technical', question: 'Is the gasket NBR or Viton?' });
  assert(tech.status === 200 && tech.json.status === 'open', 'log technical clarification → 200, open', tech);
  assert(tech.json.raised_by === 'Test Sales', 'raised_by is the server-derived session name', tech.json);
  const techId = tech.json.id;

  const comm = await post(`/api/quotes/${quoteId}/clarifications`, { query_type: 'commercial', question: 'Can payment terms be 60 days?' });
  assert(comm.status === 200, 'log commercial clarification → 200', comm);
  const commId = comm.json.id;

  // ---- list ----
  const list = await get(`/api/quotes/${quoteId}/clarifications`);
  assert(list.status === 200, 'list clarifications → 200', list);
  assert(list.json.length === 2, 'list has 2 clarifications', list.json);

  // ---- respond: missing response ----
  const emptyResp = await patch(`/api/clarifications/${techId}/respond`, { response: '' });
  assert(emptyResp.status === 400, 'PATCH respond blank response → 400', emptyResp);

  // ---- respond for real ----
  const responded = await patch(`/api/clarifications/${techId}/respond`, { response: 'NBR standard, Viton on request.' });
  assert(responded.status === 200 && responded.json.status === 'answered', 'PATCH respond → 200, answered', responded);
  assert(responded.json.responded_by && responded.json.responded_at, 'responded_by/responded_at set', responded.json);

  // ---- TAT: respond is near-instant in this test, so avgResponseHours should be a small
  // non-negative number once at least one clarification anywhere is answered ----
  const dash = await get('/api/dashboard');
  assert(dash.status === 200, 'GET /api/dashboard → 200', dash);
  assert(typeof dash.json.openClarifications === 'number', 'dashboard exposes openClarifications', dash.json.openClarifications);
  assert(dash.json.avgResponseHours == null || dash.json.avgResponseHours >= 0, 'dashboard avgResponseHours is null or >= 0', dash.json.avgResponseHours);

  // ---- soft-remove the still-open commercial one ----
  const removed = await del(`/api/clarifications/${commId}`);
  assert(removed.status === 200, 'DELETE clarification → 200', removed);
  const listAfterRemove = await get(`/api/quotes/${quoteId}/clarifications`);
  assert(listAfterRemove.json.length === 1, 'removed clarification no longer listed', listAfterRemove.json);

  // ---- audit trail ----
  const audit = await get(`/api/quotes/${quoteId}/audit`);
  const actions = audit.json.map((r) => r.action);
  assert(actions.includes('raise-clarification'), 'audit log has raise-clarification entries', actions);
  assert(actions.includes('respond-clarification'), 'audit log has respond-clarification entry', actions);
  assert(actions.includes('remove-clarification'), 'audit log has remove-clarification entry', actions);

  // ---- cleanup ----
  const deleted = await del(`/api/quotes/${quoteId}`);
  assert(deleted.status === 200, 'cleanup: DELETE test quote → 200', deleted);

  console.log(`\nclarifications.mjs: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
  process.exit(failures ? 1 : 0);
}

main();
