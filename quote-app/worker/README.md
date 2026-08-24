# EPE Quote Worker (Cloudflare)

A single Cloudflare Worker (Hono) that serves the API and the built client (`../client/dist`) from
one deployment, backed by D1. It imports the rule engine (`evaluate`/`renderCode`/`parseCode`/
`resolveCompanions`/`priceRows`) straight from `../server/engine.js`, unchanged — configurator and
pricing behavior are identical to the Express app. `../server/` remains the local dev system of
record until cutover (Task 13).

## Architecture

| Piece | Where | Notes |
|---|---|---|
| API + routing | `src/index.js` | Hono app; every route is `async (c) => ...`, errors propagate to `app.onError` (maps SQLite constraint violations to 409/400) |
| D1 helpers | `src/data.js` | family-meta loading, price list lookup, audit writes |
| Config | `wrangler.jsonc` | `DB` (D1, database_name `epe-quote`), `ASSETS` (static assets from `../client/dist`), SPA fallback (`not_found_handling: single-page-application`), `run_worker_first: ["/api/*"]` so `/api/*` always hits the Worker instead of falling through to a static file |
| Schema / seed | `schema.sql`, `data.sql` (generated), `export-data.sh` | 16 tables: `categories families segments options rules companion_links parts part_families price_lists base_prices option_prices part_prices customers quotes quote_lines audit_log` |
| Tests | `test/*.mjs`, `test/run-all.sh` | parity vs Express, write-path correctness, admin write-path correctness |

## Local development

**Always use `npx wrangler`**, not a bare `wrangler`. This repo pins wrangler 4.114 in
`devDependencies`; a stale global install (e.g. 4.98) rejects this project's `compatibility_date`.
`npm run dev` / `npm run deploy` already resolve the pinned version via `node_modules/.bin` and are
safe as-is — the `npx` reminder is for every other ad-hoc `wrangler ...` invocation below.

```bash
cd worker && npm install
```

Reset and seed local D1 from a fresh export of the Express dev database:

```bash
rm -rf .wrangler/state
npx wrangler d1 execute epe-quote --local --file=./schema.sql
./export-data.sh                                            # dumps ../server/epe-quote.db → data.sql
npx wrangler d1 execute epe-quote --local --file=./data.sql
```

Build the client (the Worker serves its output as static assets — do this before `dev`/`deploy`,
and after any client change):

```bash
npm run build --prefix ../client
```

Start the dev server:

```bash
npm run dev   # http://localhost:8787
```

## Tests

`test/run-all.sh` is the one-shot gate: it resets local D1 from a fresh snapshot, builds the client,
boots Express on port **4781** and `wrangler dev` on port **8787** against identical data (never
touches 4780 — that's the production Express port), then runs the three suites in order and tears
down both servers regardless of outcome.

```bash
./test/run-all.sh
```

| Suite | Checks |
|---|---|
| `test/parity.mjs` | Worker returns byte-identical JSON to Express for every read endpoint and every published family's default `evaluate` |
| `test/writes.mjs` | write-path correctness (create/reconfigure/revise/clone/archive/delete), self-cleaning |
| `test/admin-writes.mjs` | admin write-path correctness (categories/families/segments/options/rules/prices/parts), self-cleaning |

To run an individual suite outside `run-all.sh`, repeat the fresh-import procedure above first (reset
D1 → build client → start Express on 4781 and `npx wrangler dev` on 8787), then `node
test/<suite>.mjs`.

Reference numbers a green run should reproduce: the catalogue sweep is 36 families / 37,045 checks /
0 failures (`node ../server/sweep.js`); the LD family's default `evaluate` returns
`160-LD-0013-H10XP-A-0P-0-9-0-_-P-0-0`; selecting connection `G06` prices the line at **₹49,100**.

## Authentication (temporary)

The worker requires sign-in: a `users` table in D1 (`auth-schema.sql`) holds
`email` (unique identity key), `name`, `password_hash`/`password_salt` (PBKDF2-SHA256,
100,000 iterations, WebCrypto), `role` (`admin`|`sales`), `provider` (`local` now,
`zoho` later), `status`. Auth logic lives in `src/auth.js`.

**Session & cookie:** on login the worker sets `epe_session` — HttpOnly, Secure,
SameSite=Lax, Path=/, an 8-hour JWT (Hono's `hono/jwt`, signed with the
`SESSION_SECRET` secret). `GET /api/auth/me` reads it back; the client treats a
**404** on that route as legacy/no-auth mode (Express) and a **401** as "not signed
in" (worker). All `/api/*` routes require a session except `/api/auth/login` and
`/api/ping`; `/api/admin/*` additionally requires `role=admin`. The audit-log actor
is derived from the session (`name`), not the client-sent `X-Actor` header, so it
can't be spoofed. Exact error bodies: login failure → 401
`{"error":"Invalid email or password"}`; missing session → 401
`{"error":"Not signed in"}`; role block → 403 `{"error":"Admin access required"}`.

**Password policy:** `POST /api/auth/change-password` requires the current password
and rejects a new password under 8 characters (400 `New password must be at least 8
characters`). There is no self-serve reset — see limitations below.

**User management (`seed-admin.mjs`)** — the only way to add/reset a user; upserts by
email (create if absent, reset password + role/name if present):

```bash
# Local (targets .wrangler/state via --local, the default)
node seed-admin.mjs --email someone@nexivo.co --name "Someone" --role sales

# Production (--remote targets the live D1 database)
node seed-admin.mjs --email someone@nexivo.co --name "Someone" --role admin --remote

# Fixed password instead of a generated one (e.g. for test fixtures)
node seed-admin.mjs --email test@local --name "Test" --role admin --password 'fixed-pw'
```

Omitting `--password` generates an 18-character random password and prints it to the
terminal **once** — it is never logged, committed, or written to any file. Roles are
`admin` or `sales`; there is no in-app user-management UI in this temporary system —
adding, removing, or role-changing a user is always an admin running this script
against the target environment.

**Zoho swap contract** (the seam this whole design was built around — see
`docs/superpowers/plans/2026-07-24-temporary-auth.md`): when Zoho auth arrives, add
`/api/auth/zoho/start` (redirect to Zoho OAuth) and `/api/auth/zoho/callback`
(code→token→email lookup in `users` → same `createSession()`). Delete
`verifyCredentials` (in `src/auth.js`) and the login form
(`client/src/pages/Login.jsx`). Everything else — the session cookie, the auth
middleware, the role gate, the server-derived audit actor, and the client's session
handling — is untouched. The `users.provider` column (`'local'` now, `'zoho'` later)
tracks which users have migrated; `email` stays the identity key throughout, matching
Zoho's own identity key, so no user-record remapping is needed at cutover.

**Accepted temporary limitations** (by design, resolved when Zoho lands): no rate
limiting on login attempts; no self-serve password reset (admin re-seeds via
`seed-admin.mjs`); no user-management UI — the user list is admin-managed entirely
through the seed script.

## Backups & restore

D1 has automatic point-in-time recovery — no snapshot job to run or maintain:

```bash
npx wrangler d1 time-travel restore epe-quote --timestamp=<ISO-8601>   # 30-day PITR
```

For an app-level, no-lock-in copy, `GET /api/admin/export` (Admin screen) downloads a full JSON dump
of all 16 tables. The old fs-snapshot endpoints (`GET/POST /api/admin/backups`) return empty/
informational responses by design — they're kept for API compatibility, not for restore.

## Deploy (Task 12 — not yet executed)

```bash
npx wrangler login                        # interactive, opens a browser
npx wrangler d1 create epe-quote          # copy the returned database_id into wrangler.jsonc
./export-data.sh
npx wrangler d1 execute epe-quote --remote --file=./schema.sql
npx wrangler d1 execute epe-quote --remote --file=./data.sql
npm run build --prefix ../client
npx wrangler deploy
```

**Auth status:** the worker now has its own login (see "Authentication (temporary)" above) — every
`/api/*` route except `/api/auth/login` and `/api/ping` requires a session, and `/api/admin/*`
requires the `admin` role. This supersedes the original plan to rely solely on Cloudflare Access;
Access can still be layered on top later as defense-in-depth, but it is not required for the app to
be safe to share.

## Cutover runbook (Task 13 — only when explicitly told to go)

1. Stop the Desktop Express server: `kill <pid of node server/index.js>`.
2. Copy the final production database into the repo **with `sqlite3`, never `cp`** — a plain file
   copy of a live WAL-mode SQLite database produces a torn snapshot (this happened once and
   corrupted catalog flags):
   ```bash
   sqlite3 ~/Desktop/Nexivo-India/EPE/quote-app/server/epe-quote.db \
     ".backup /Users/ramki/Developer/EPE/quote-app/server/epe-quote.db"
   ```
3. Wipe and reload production D1 with the final data. Generate a drop+recreate script for the same
   16 tables `export-data.sh` uses, then apply it, then re-export and reload the data:
   ```bash
   {
     for t in audit_log quote_lines quotes customers part_prices option_prices base_prices \
              price_lists part_families parts companion_links rules options segments \
              families categories; do
       echo "DROP TABLE IF EXISTS $t;"
     done
     cat schema.sql
   } > schema-reset.sql
   npx wrangler d1 execute epe-quote --remote --file=./schema-reset.sql
   ./export-data.sh
   npx wrangler d1 execute epe-quote --remote --file=./data.sql
   ```
4. Verify: compare row counts against `GET /api/admin/summary` and spot-check the latest quote in the
   deployed UI.
5. Users switch to the Workers URL. Archive the Desktop folder — don't delete it.
6. Merge `cloudflare-migration` → `main`, push, commit the final state.

**Rollback:** at any point before cutover, there's nothing to roll back — the Express/Desktop
deployment was never touched. After cutover, the final database copy lives in both the repo and the
archived Desktop folder; restarting the Desktop server restores the old world instantly. D1 Time
Travel gives 30-day point-in-time restore on the cloud side.
