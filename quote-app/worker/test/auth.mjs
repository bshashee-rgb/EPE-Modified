const BASE = 'http://localhost:8787';
let failures = 0;
const t = (c, m) => { console.log((c ? 'ok:' : 'FAIL:'), m); if (!c) failures++; };
const login = async (email, password) => {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return { status: r.status, cookie: (r.headers.get('set-cookie') || '').split(';')[0], body: await r.json() };
};
t((await fetch(BASE + '/api/catalog')).status === 401, 'no session -> 401');
t((await fetch(BASE + '/api/ping')).status === 200, 'ping exempt');
t((await login('admin@test.local', 'nope')).status === 401, 'bad password -> 401');
t((await login('ghost@test.local', 'x')).status === 401, 'unknown email -> 401');
const admin = await login('admin@test.local', 'test-admin-pw');
t(admin.status === 200 && admin.body.role === 'admin', 'admin login ok');
const H = { Cookie: admin.cookie };
t((await fetch(BASE + '/api/catalog', { headers: H })).status === 200, 'session grants access');
const me = await (await fetch(BASE + '/api/auth/me', { headers: H })).json();
t(me.email === 'admin@test.local' && me.role === 'admin', '/me shape');
const sales = await login('sales@test.local', 'test-sales-pw');
t(sales.status === 200, 'sales login ok');
t((await fetch(BASE + '/api/admin/summary', { headers: { Cookie: sales.cookie } })).status === 403, 'sales blocked from admin');
t((await fetch(BASE + '/api/admin/summary', { headers: H })).status === 200, 'admin allowed');
// percent-encoding bypass regression: middleware must match on the DECODED path
// (Hono dispatches on decoded path too, so an undecoded pathname check would let
// a non-admin session reach the real admin handler via /api/%61dmin/...).
t((await fetch(BASE + '/api/%61dmin/summary', { headers: { Cookie: sales.cookie } })).status === 403, 'sales blocked from percent-encoded admin path');
t((await fetch(BASE + '/api/%61dmin/summary')).status === 401, 'no session -> 401 on percent-encoded admin path');
t((await fetch(BASE + '/api/%63atalog', { headers: { Cookie: sales.cookie } })).status === 200, 'percent-encoded non-admin path still resolves normally');
// audit actor comes from the session, not X-Actor spoofing
const q = await (await fetch(BASE + '/api/quotes', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', 'X-Actor': 'spoofed' }, body: '{}' })).json();
const audit = await (await fetch(BASE + `/api/quotes/${q.id}/audit`, { headers: H })).json();
t(audit[0].actor === 'Test Admin', 'audit actor = session name, spoof ignored');
await fetch(BASE + `/api/quotes/${q.id}`, { method: 'DELETE', headers: H });   // self-clean
const cp = await fetch(BASE + '/api/auth/change-password', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ current: 'test-admin-pw', next: 'test-admin-pw2' }) });
t(cp.status === 200, 'change-password ok');
t((await login('admin@test.local', 'test-admin-pw2')).status === 200, 'new password works');
// restore for idempotency
await fetch(BASE + '/api/auth/change-password', { method: 'POST', headers: { Cookie: (await login('admin@test.local', 'test-admin-pw2')).cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ current: 'test-admin-pw2', next: 'test-admin-pw' }) });
t((await login('admin@test.local', 'test-admin-pw')).status === 200, 'password restored');
console.log(failures ? `${failures} AUTH FAILURES` : 'ALL AUTH TESTS PASSED');
process.exit(failures ? 1 : 0);
