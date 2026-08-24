# Temporary Email/Password Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add login-required access to the deployed EPE quote app (admin user `ramki@nexivo.co`), built so the credential-check layer can be swapped for Zoho OAuth without touching sessions, middleware, or the client.

**Architecture:** No new framework — Hono's own `jwt` + `cookie` helpers plus WebCrypto PBKDF2 (all built into Workers). A `users` table in D1 keyed by **email** (Zoho's identity key). One isolated `verifyCredentials(DB, email, password)` function is the ONLY thing Zoho later replaces; the session cookie, middleware, role gate, and client stay as-is. Server-derived actor identity replaces the client-chosen `X-Actor` header, making the audit log trustworthy.

**Tech Stack:** Hono 4 (`hono/jwt`, `hono/cookie`), WebCrypto PBKDF2-SHA256 (100,000 iterations), D1, HttpOnly session cookie (8h JWT).

## Global Constraints

- **Zero new npm dependencies** — hono is already installed; WebCrypto is native to Workers and Node ≥18.
- Identity key = **email** everywhere (`users.email` UNIQUE; JWT `sub` = email) — this is the Zoho-compat contract.
- `users` table is **excluded** from `export-data.sh` TABLES and from `/api/admin/export` EXPORT_TABLES — password hashes never enter git or data exports.
- Secrets: `SESSION_SECRET` via `wrangler secret put` (prod) and `worker/.dev.vars` (local, gitignored). Passwords are never committed, logged, or echoed into reports — the seed script prints the generated password to the terminal ONCE and the controller relays it to the user privately.
- Legacy compatibility: the Express server (`quote-app/server/`) gets NO auth changes. The client detects `GET /api/auth/me` → **404** as "legacy/no-auth mode" (Express) vs **401** as "not signed in" (worker) — so local Express dev and the parity harness keep working.
- All existing gates stay green: `test/run-all.sh` (parity + writes + admin-writes + new auth suite) after every task that touches the worker.
- Auth error messages (exact): login failure → 401 `{"error":"Invalid email or password"}`; missing session → 401 `{"error":"Not signed in"}`; role block → 403 `{"error":"Admin access required"}`.
- Cookie: name `epe_session`, HttpOnly, Secure, SameSite=Lax, Path=/, 8-hour JWT expiry.
- Branch: continue on `cloudflare-migration` (auth is part of the pre-cutover deployment).
- Accepted temporary limitations (documented, resolved by Zoho): no rate limiting, no password reset flow (admin reseeds via script), single admin-managed user list via seed script.

## Zoho swap contract (write into worker/README.md in Task 5)

When Zoho auth arrives: add `/api/auth/zoho/start` (redirect to Zoho OAuth) and `/api/auth/zoho/callback` (code→token→email lookup in `users` → same `createSession()`). Delete `verifyCredentials` + the login form. Everything else — cookie, middleware, roles, actor, client session handling — is untouched. `users.provider` column ('local' now, 'zoho' later) tracks the migration.

---

### Task 1: Auth core — users schema, crypto module, seed script

**Files:**
- Create: `quote-app/worker/auth-schema.sql`
- Create: `quote-app/worker/src/auth.js`
- Create: `quote-app/worker/seed-admin.mjs`
- Create: `quote-app/worker/test/auth-unit.mjs`
- Modify: `quote-app/worker/.gitignore` (add `.dev.vars`)
- Create: `quote-app/worker/.dev.vars` (local secret, NOT committed)

**Interfaces:**
- Produces: `hashPassword(password, saltHex?)` → `Promise<{hash, salt}>` (hex strings); `verifyPassword(password, saltHex, hashHex)` → `Promise<boolean>`; `verifyCredentials(DB, email, password)` → `Promise<user|null>` (the Zoho-swap seam); `createSession(c, user)` → sets cookie; `getSession(c)` → `Promise<payload|null>` (payload: `{sub, name, role}`); `clearSession(c)`; constants `COOKIE_NAME='epe_session'`, `PBKDF2_ITERATIONS=100000`.

- [ ] **Step 1: auth-schema.sql**

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'sales',
  provider TEXT NOT NULL DEFAULT 'local',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: src/auth.js**

```js
// Temporary local-credential auth. Zoho swap contract: only verifyCredentials
// (and the login form) get replaced by the Zoho OAuth exchange; sessions,
// middleware, and roles stay. Identity key is EMAIL throughout.
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

export const COOKIE_NAME = 'epe_session';
export const PBKDF2_ITERATIONS = 100000;
const SESSION_HOURS = 8;

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return { hash: toHex(bits), salt: toHex(salt.buffer ?? salt) };
}

export async function verifyPassword(password, saltHex, hashHex) {
  const { hash } = await hashPassword(password, saltHex);
  // constant-time compare
  if (hash.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

// THE ZOHO SEAM: everything above/below this function survives the swap.
export async function verifyCredentials(DB, email, password) {
  const user = await DB.prepare("SELECT * FROM users WHERE email=? AND status='active'").bind(String(email || '').trim().toLowerCase()).first();
  if (!user) return null;
  const ok = await verifyPassword(String(password || ''), user.password_salt, user.password_hash);
  return ok ? user : null;
}

export async function createSession(c, user) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600;
  const token = await sign({ sub: user.email, name: user.name, role: user.role, exp }, c.env.SESSION_SECRET);
  setCookie(c, COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: SESSION_HOURS * 3600 });
}

export async function getSession(c) {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return null;
  try { return await verify(token, c.env.SESSION_SECRET); } catch { return null; }
}

export function clearSession(c) {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}
```

- [ ] **Step 3: seed-admin.mjs** (node script; same PBKDF2 via node's webcrypto so hashes are interchangeable)

```js
// Seed (or reset) a user. Usage:
//   node seed-admin.mjs --email ramki@nexivo.co --name "Ramki" --role admin [--remote] [--password 'x']
// Generates a strong password when --password is omitted, prints it ONCE, and
// upserts the user via wrangler d1 execute (--local default, --remote for prod).
import { execFileSync } from 'node:child_process';
import { webcrypto as crypto } from 'node:crypto';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const email = String(arg('email', '')).trim().toLowerCase();
const name = arg('name', email.split('@')[0]);
const role = arg('role', 'sales');
if (!email || !['admin', 'sales'].includes(role)) { console.error('need --email and role admin|sales'); process.exit(1); }

const password = arg('password') || [...crypto.getRandomValues(new Uint8Array(18))].map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'.charAt(b % 56)).join('');
const salt = crypto.getRandomValues(new Uint8Array(16));
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);

const sql = `INSERT INTO users(email,name,password_hash,password_salt,role,provider,status) VALUES ('${email}','${name.replace(/'/g, "''")}','${toHex(bits)}','${toHex(salt.buffer)}','${role}','local','active')
ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash, password_salt=excluded.password_salt, name=excluded.name, role=excluded.role, status='active'`;
execFileSync('npx', ['wrangler', 'd1', 'execute', 'epe-quote', flag('remote') ? '--remote' : '--local', '--command', sql], { stdio: ['inherit', 'inherit', 'inherit'] });
console.log(`\nUser ${email} (${role}) seeded. PASSWORD (shown once): ${password}\n`);
```

- [ ] **Step 4: test/auth-unit.mjs** — pure-node roundtrip tests (no server needed)

```js
import { hashPassword, verifyPassword } from '../src/auth.js';
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('ok:', m); };
const a = await hashPassword('s3cret');
assert(a.hash.length === 64 && a.salt.length === 32, 'hash/salt hex lengths');
assert(await verifyPassword('s3cret', a.salt, a.hash), 'correct password verifies');
assert(!(await verifyPassword('wrong', a.salt, a.hash)), 'wrong password rejected');
const b = await hashPassword('s3cret', a.salt);
assert(b.hash === a.hash, 'deterministic given same salt');
const c2 = await hashPassword('s3cret');
assert(c2.hash !== a.hash, 'new salt -> new hash');
console.log('AUTH UNIT TESTS PASSED');
```

Note: `hono/jwt` and `hono/cookie` imports make auth.js importable only where hono resolves — run this test from `quote-app/worker/` (hono is in node_modules). If node complains about the hono imports at parse time, split the two pure functions into the top of the file so the import of the module still works under node (hono's jwt/cookie are plain ESM, they parse fine under node — expected to just work).

- [ ] **Step 5: .dev.vars + gitignore**

`.dev.vars`: `SESSION_SECRET=<64 random hex chars, generate with openssl rand -hex 32>` — add `.dev.vars` to `quote-app/worker/.gitignore`.

- [ ] **Step 6: Run tests + apply schema locally**

```bash
cd quote-app/worker && node test/auth-unit.mjs        # AUTH UNIT TESTS PASSED
npx wrangler d1 execute epe-quote --local --file=./auth-schema.sql
node seed-admin.mjs --email admin@test.local --name "Test Admin" --role admin --password 'test-admin-pw'
npx wrangler d1 execute epe-quote --local --command "SELECT email, role, provider FROM users"
```
Expected: the seeded row. (`admin@test.local`/`test-admin-pw` is the LOCAL TEST admin — prod gets a real seed in Task 5.)

- [ ] **Step 7: Commit** — `git add worker/auth-schema.sql worker/src/auth.js worker/seed-admin.mjs worker/test/auth-unit.mjs worker/.gitignore && git commit -m "feat(auth): PBKDF2 credential core, users schema, seed script"` (verify `.dev.vars` is NOT in the commit).

---

### Task 2: Auth routes, middleware, server-derived actor

**Files:**
- Modify: `quote-app/worker/src/index.js`
- Create: `quote-app/worker/test/auth.mjs`
- Modify: `quote-app/worker/test/run-all.sh` (apply auth-schema + seed test users after data import; run auth.mjs first among suites)

**Interfaces:**
- Consumes: everything from Task 1's `auth.js`.
- Produces: routes `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`; middleware gating all `/api/*` except `/api/auth/login` and `/api/ping`; `/api/admin/*` requires role `admin`; helper `actor(c)` returning the session's `name` — replaces every `c.req.header('x-actor')` in the file.

- [ ] **Step 1: Add imports + middleware + routes to src/index.js** (middleware registered BEFORE all existing routes; auth routes right after it)

```js
import { verifyCredentials, createSession, getSession, clearSession, hashPassword, verifyPassword } from './auth.js';

// ---- auth gate: everything under /api/* needs a session except login + ping.
const AUTH_EXEMPT = new Set(['/api/auth/login', '/api/ping']);
app.use('/api/*', async (c, next) => {
  if (AUTH_EXEMPT.has(new URL(c.req.url).pathname)) return next();
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Not signed in' }, 401);
  if (new URL(c.req.url).pathname.startsWith('/api/admin/') && session.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  c.set('session', session);
  return next();
});
// Server-derived actor for the audit trail (client X-Actor header is ignored).
const actor = (c) => c.get('session')?.name || c.get('session')?.sub || 'system';

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
```

- [ ] **Step 2: Replace actor reads.** `grep -c "c.req.header('x-actor')" src/index.js` (record N), then replace ALL occurrences with `actor(c)` (sed or editor). Re-grep → 0 left; `grep -c "actor(c)" src/index.js` ≥ N. The `d.audit(DB(c), actor(c), ...)` call shape stays otherwise identical.

- [ ] **Step 3: test/auth.mjs** — functional suite vs worker on 8787 (assumes run-all's seeding; standalone: seed `admin@test.local`/`test-admin-pw` admin + `sales@test.local`/`test-sales-pw` sales first). Node fetch, manual cookie capture from `set-cookie`:

```js
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
```

- [ ] **Step 4: run-all.sh** — after the data.sql import add:

```bash
npx wrangler d1 execute epe-quote --local --file=./auth-schema.sql
node seed-admin.mjs --email admin@test.local --name "Test Admin" --role admin --password 'test-admin-pw'
node seed-admin.mjs --email sales@test.local --name "Test Sales" --role sales --password 'test-sales-pw'
```
and run `node test/auth.mjs` as the first suite (capture `R_AUTH` like the others, include in the exit aggregation).

- [ ] **Step 5: Run auth suite** (fresh D1 + seeding + wrangler dev) → `ALL AUTH TESTS PASSED`. (Other suites are now failing with 401 — expected; Task 3 fixes them. Do NOT run full run-all yet.)

- [ ] **Step 6: Commit** — `feat(auth): login/logout/me/change-password, session middleware, server-derived audit actor`

---

### Task 3: Make existing suites authenticate

**Files:**
- Modify: `quote-app/worker/test/parity.mjs` (login as admin, attach cookie to WORKER requests only — Express side stays cookie-less)
- Modify: `quote-app/worker/test/writes.mjs`, `quote-app/worker/test/admin-writes.mjs` (login as admin at start; add cookie to every request's headers)

**Interfaces:**
- Consumes: seeded `admin@test.local`/`test-admin-pw` (run-all provides it).

- [ ] **Step 1:** Add to each suite a login preamble:

```js
const _login = await fetch('http://localhost:8787/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@test.local', password: 'test-admin-pw' }) });
if (_login.status !== 200) { console.error('FATAL: test admin login failed'); process.exit(1); }
const COOKIE = (_login.headers.get('set-cookie') || '').split(';')[0];
```
In parity.mjs: worker-bound fetches get `Cookie: COOKIE`; Express fetches unchanged. In writes/admin-writes: every fetch gets the cookie header merged in.

- [ ] **Step 2: Audit-actor parity caveat.** Two known, sanctioned differences now exist between Express and worker responses: (a) worker audit rows created during auth-era tests carry the session actor name. Parity compares PRE-EXISTING data (fresh import on both sides) and GET-only requests, so no drift is expected — but `/api/quotes/:id/audit` rows and `/api/admin/audit` all predate the run and remain identical. If parity flags an actor mismatch, that indicates a test-order bug (a write happened before parity) — fix ordering, don't loosen the diff. (b) `/api/auth/*` routes exist only on the worker — parity never queries them.

- [ ] **Step 3:** `./test/run-all.sh` → auth + parity + writes + admin-writes ALL green, run twice.

- [ ] **Step 4: Commit** — `test(worker): authenticate all suites via test admin session`

---

### Task 4: Client login screen + session wiring

**Files:**
- Create: `quote-app/client/src/pages/Login.jsx`
- Modify: `quote-app/client/src/App.jsx` (session bootstrap, logout, user badge)
- Modify: `quote-app/client/src/api.js` (401 → surface login; keep X-Actor for legacy Express mode)

**Interfaces:**
- Consumes: `/api/auth/me` (404 = legacy Express → behave exactly as today, actor picker stays; 401 = show Login; 200 = signed in), `/api/auth/login`, `/api/auth/logout`.

- [ ] **Step 1: Login.jsx** — minimal form matching the app's existing styles (read `styles.css` + a page like `Dashboard.jsx` first for class conventions):

```jsx
import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { onLogin(await api.post('/api/auth/login', { email, password }, { quiet: true })); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  }
  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <h1>EPE Quote Builder</h1>
        <p className="muted">Sign in to continue</p>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
```
(Adjust class names to the real conventions found in styles.css; add a small `.login-wrap/.login-card` block to styles.css centered on the page.)

- [ ] **Step 2: App.jsx wiring** — on mount `api.get('/api/auth/me', {quiet:true})`: 200 → `setUser(payload)` and `setActor(payload.name)`; error with `status===404` → `setUser({legacy:true})` (render exactly today's UI incl. actor picker); `status===401` → render `<Login onLogin={(u)=>{setUser(u); setActor(u.name);}} />`. When a real user is set: hide the actor picker, show `user.name` + role and a Sign out button calling `/api/auth/logout` then resetting state. Also register a global 401 handler in api.js (set a callback from App) so a mid-session expiry flips back to the Login screen.

- [ ] **Step 3: Build + E2E on wrangler dev (8787):** login screen appears; bad password shows toast/error; `admin@test.local` login lands on dashboard; user badge + Sign out visible; actor picker gone; create+delete a quote and check its audit shows "Test Admin"; sign out returns to login. ALSO verify legacy mode: run the client against Express (`npm run dev` in client/ with Express on 4780? NO — use PORT=4781 Express + `npm run dev -- --port 5183` with proxy target overridden via env if simple, otherwise curl-verify that /api/auth/me on Express returns 404 and note that legacy mode is exercised by the unchanged Express deployment). Keep it practical: the state-machine branch for 404 is small — verify by curl + code read if a full legacy run is awkward.

- [ ] **Step 4:** `./test/run-all.sh` still green (client build is part of it).

- [ ] **Step 5: Commit** — `feat(client): login screen + session-derived identity (legacy-mode compatible)`

---

### Task 5: Production rollout + docs

**Files:**
- Modify: `quote-app/worker/README.md` (+auth section incl. Zoho swap contract), `quote-app/README.md` (auth note)

- [ ] **Step 1:** `openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET` (from worker/).
- [ ] **Step 2:** `npx wrangler d1 execute epe-quote --remote --file=./auth-schema.sql`
- [ ] **Step 3:** Seed the real admin — run `node seed-admin.mjs --email ramki@nexivo.co --name "Ramki" --role admin --remote`. The password prints ONCE in the terminal; the controller relays it to the user privately and it must appear in no report/commit/log.
- [ ] **Step 4:** `npm run build --prefix ../client && npx wrangler deploy`
- [ ] **Step 5: Verify deployed:** `/api/catalog` → 401; `/api/ping` → 200; UI shows login screen; wrong password → error; `ramki@nexivo.co` + printed password → dashboard loads, admin tab accessible; audit rows show "Ramki". (The verifier does read-only checks + one login; no data writes.)
- [ ] **Step 6:** Docs: worker/README.md gains "Authentication (temporary)" — user management via seed-admin.mjs (both envs), password policy, cookie/session facts, the exact Zoho swap contract from the plan header, and the accepted limitations list. quote-app/README.md gets a 3-line pointer.
- [ ] **Step 7: Commit** — `feat(auth): production rollout — admin seeded, docs, Zoho swap contract`

---

## Testing strategy summary

| Gate | Proves |
|---|---|
| auth-unit.mjs | PBKDF2 roundtrip, determinism, salt uniqueness (pure node, no server) |
| auth.mjs | 401 gate, exemptions, role gate, spoof-proof audit actor, change-password, idempotent |
| run-all.sh (auth+parity+writes+admin-writes ×2) | auth didn't break any existing contract; parity intact with cookie on worker side only |
| Client E2E | login/logout/badge/actor-picker-removal on the real UI |
| Deployed verification | 401 wall live, real admin works, session actor in audit |

## Rollback

Auth is additive on the worker: reverting the two worker commits and redeploying restores the pre-auth app. The users table is inert without the middleware. Express/local system of record: never touched.
