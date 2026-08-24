// Parity: identical requests to Express (4781) and Worker (8787); deep-diff JSON.
// Prereq: both running against THE SAME data snapshot (fresh data.sql import).
const EX = 'http://localhost:4781', WK = 'http://localhost:8787';

// Worker requires a session on all /api/* (except /api/auth/login and /api/ping); Express
// has no auth at all. Log in once as the seeded test admin and attach the cookie only to
// WORKER-bound requests — Express-bound requests must stay cookie-less.
const _login = await fetch('http://localhost:8787/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@test.local', password: 'test-admin-pw' }) });
if (_login.status !== 200) { console.error('FATAL: test admin login failed'); process.exit(1); }
const COOKIE = (_login.headers.get('set-cookie') || '').split(';')[0];

const H = { 'X-Actor': 'sales', 'Content-Type': 'application/json' };
const hdrs = (base) => (base === WK ? { ...H, Cookie: COOKIE } : H);
const get = async (base, p) => (await fetch(base + p, { headers: hdrs(base) })).json();
// eslint-disable-next-line no-unused-vars
const post = async (base, p, body) => (await fetch(base + p, { method: 'POST', headers: hdrs(base), body: JSON.stringify(body) })).json();

const diff = (a, b, path = '') => {
  if (typeof a !== typeof b) return [`${path}: type ${typeof a} vs ${typeof b}`];
  if (a === null || typeof a !== 'object') {
    // Time-decayed popularity scores are computed from Date.now() at request time;
    // sub-second skew between the two servers shifts the ~9th digit, so `.score` fields
    // use a relative tolerance instead of exact equality — everything else stays exact.
    if (path.endsWith('.score') && typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
      return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)) ? [] : [`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
    }
    return Object.is(a, b) ? [] : [`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys.flatMap((k) => diff(a?.[k], b?.[k], `${path}.${k}`));
};

let failures = 0;
const check = (name, d) => { if (d.length) { failures++; console.log(`✗ ${name}\n  ` + d.slice(0, 5).join('\n  ')); } else console.log(`✓ ${name}`); };

const cat = await get(EX, '/api/catalog');
check('catalog', diff(cat, await get(WK, '/api/catalog')));
for (const f of cat.families) {
  check(`meta ${f.code}`, diff(await get(EX, `/api/families/${f.id}/meta`), await get(WK, `/api/families/${f.id}/meta`)));
  if (f.kind === 'configurable' && f.status === 'published') {
    check(`evaluate-default ${f.code}`, diff(
      await post(EX, `/api/families/${f.id}/evaluate`, { selections: {} }),
      await post(WK, `/api/families/${f.id}/evaluate`, { selections: {} })));
  }
}
for (const p of ['/api/popularity', '/api/parts', '/api/customers', '/api/quotes', '/api/quotes?archived=1',
  '/api/search?q=LD', '/api/admin/categories', '/api/admin/families', '/api/admin/parts', '/api/admin/audit',
  '/api/admin/summary', '/api/dashboard']) {
  check(p, diff(await get(EX, p), await get(WK, p)));
}
const quotes = await get(EX, '/api/quotes');
for (const q of quotes.slice(0, 5)) {
  check(`quote ${q.number}-${q.revision}`, diff(await get(EX, `/api/quotes/${q.id}`), await get(WK, `/api/quotes/${q.id}`)));
  check(`quote-audit ${q.id}`, diff(await get(EX, `/api/quotes/${q.id}/audit`), await get(WK, `/api/quotes/${q.id}/audit`)));
}
for (const f of cat.families.slice(0, 5)) {
  check('usage ' + f.code, diff(await get(EX, '/api/admin/families/' + f.id + '/usage'), await get(WK, '/api/admin/families/' + f.id + '/usage')));
}
console.log(failures ? `\n${failures} PARITY FAILURES` : '\nALL PARITY CHECKS PASSED');
process.exit(failures ? 1 : 0);
