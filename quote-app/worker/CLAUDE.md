# quote-app/worker/ — the production Cloudflare Worker

Scope: this file loads when you touch `quote-app/worker/**`. Root guide: `../../CLAUDE.md`.
Auth depth + the Zoho swap contract: `./README.md`. Deploy/release/staging: `../../docs/DEPLOYMENT.md`.

## What this is

The single Cloudflare Worker (Hono + D1) that serves both the API and the built client
(`../client/dist`) in one deployment. It imports the rule engine
(`evaluate`/`renderCode`/`parseCode`/`resolveCompanions`/`priceRows`) straight from
`../server/engine.js`, **unchanged** — see `../server/CLAUDE.md` for the shared-engine rule.
This IS production: live at https://epe-quote.ramki-461.workers.dev, system of record is D1.

## Hono + D1 idioms (async — this is not better-sqlite3)

- D1 calls are all async: `.bind(...).first()`, `.bind(...).all()` → `.results`,
  `.bind(...).run()` → `.meta.last_row_id`.
- Every route is `async (c) => ...`; errors propagate to `app.onError`, which maps SQLite
  constraint violations to `409`/`400` (same contract as the Express error middleware).
- D1 helpers (family-meta loading, price-list lookup, audit writes) live in `src/data.js`.

## R2 (attachments)

- Binding `ATTACHMENTS` (see `wrangler.jsonc`) — one bucket per environment, same isolation rule as
  D1: `epe-quote-attachments-sandbox` is provisioned; production/staging buckets are a deliberate
  later step requiring R2 to be enabled on that Cloudflare account first (don't assume they exist
  yet — see `docs/DEPLOYMENT.md`).
- Metadata lives in D1 (`attachments` table); R2 holds only the bytes, keyed `q<quoteId>/<uuid>-<name>`.

## Migrations directory

`migrations/` holds additive-only SQL files for patching an **already-live** D1 database (a fresh
database already has the current shape via `schema.sql`). D1 has no `_migrations` tracking table —
these files are **not idempotent** and must be applied by hand, exactly once, per environment, in
numeric order (`001-attachments.sql`, `002-clarifications.sql`, …; same manual-op discipline as the
existing `schema.sql`/`data.sql` warnings below). `schema.sql` is kept in sync so a fresh local/CI
D1 already has the current shape with no separate migration step needed.

## Auth model

- Sessions, not the legacy `X-Actor` header. A `users` table (`auth-schema.sql`) holds
  `email` (identity key), `password_hash`/`password_salt` (PBKDF2-SHA256), `role`
  (`admin`|`sales`), `provider` (`local` now, `zoho` later), `status`.
- Login sets `epe_session` — HttpOnly, Secure, SameSite=Lax, 8-hour JWT (`hono/jwt`, signed with
  `SESSION_SECRET`). `GET /api/auth/me`: `200` signed-in, `401` not signed in.
- **The audit-log actor is derived from the session (`actor(c)` helper in `src/index.js`, reading
  `c.get('session')`), never from a client-sent header.** Don't reintroduce `X-Actor` trust here —
  that model is Express-only and explicitly not secure enough for the Worker.
- `/api/admin/*` additionally requires `role=admin` (403 `Admin access required` otherwise).
- User management is `seed-admin.mjs` only (no in-app UI yet) — upserts by email, `--remote`
  targets production. Full depth (password policy, error bodies, limitations, Zoho swap
  contract): `./README.md`.

## Local dev

- Needs `.dev.vars` with `SESSION_SECRET` set (and any other worker secrets) — without it,
  sessions won't sign/verify locally.
- **Always use `npx wrangler`, never a bare `wrangler`.** This repo pins wrangler 4.114 in
  `devDependencies`; a stale global install (e.g. 4.98) rejects this project's
  `compatibility_date`. `npm run dev` / `npm run deploy` already resolve the pinned version.
- Build the client before `dev`/`deploy` and after any client change:
  `npm run build --prefix ../client`.
- Dev server: `npm run dev` → `http://localhost:8787`.

## Test suites

```bash
./test/run-all.sh
```

One-shot gate: resets local D1 from a fresh snapshot, builds the client, boots Express on port
**4781** and `wrangler dev` on **8787** against identical data (never touches 4780 — the
production Express port), runs `test/parity.mjs` + `test/writes.mjs` + `test/admin-writes.mjs` +
`test/attachments.mjs` + `test/clarifications.mjs` + `test/customers.mjs` in order, tears down both
servers regardless of outcome. This is the CI gate (`ci.yml`). `attachments.mjs` relies on local
`wrangler dev`'s built-in R2 emulation (Miniflare) — no real Cloudflare account/bucket is touched.

## THE MOST IMPORTANT RULE

**Never run a `--remote` schema-reset or data-import against production D1.** It wipes live
quotes. Commands like `npx wrangler d1 execute epe-quote --remote --file=...` against
`schema.sql`/`schema-reset.sql`/`data.sql` are for **local** setup or a deliberate,
explicitly-approved, backed-up restore only — never a routine op.

- The `users` table is excluded from `export-data.sh` and `/api/admin/export` so password hashes
  never leak — a normal data restore still preserves accounts.
- Reading/inspecting prod is safe: `npx wrangler d1 execute epe-quote --remote --command "SELECT ..."`.
- Backups: D1 Time Travel gives 30-day point-in-time restore
  (`npx wrangler d1 time-travel restore epe-quote --timestamp=<ISO-8601>`) — no snapshot job to
  run or maintain.
