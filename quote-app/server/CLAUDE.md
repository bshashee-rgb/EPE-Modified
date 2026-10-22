# quote-app/server/ — local Express dev + the shared rule engine

Scope: this file loads when you touch `quote-app/server/**`. Root guide: `../../CLAUDE.md`.
Deep reference: `../../docs/ARCHITECTURE.md` (rule-engine D1–D7 semantics, API surface, data model).
Full test methodology: `../TESTING.md`.

## What lives here

Node + Express + better-sqlite3 (synchronous). `index.js` (REST endpoints, guards, error
middleware), `engine.js` (rule engine), `db.js` (schema + data-safety/migrations), `sweep.js`
(catalogue verification), `test-migrations.mjs` (data-safety regression), `seed/` (catalogue
source data + DB rebuild).

This is the **local dev system** — production runs on the Cloudflare Worker + D1
(`../worker/`), not this Express app. See `../../docs/DEPLOYMENT.md` for how the two relate.

## Run it

```bash
npm install --prefix .          # first-time only (from quote-app/server)
npm run dev --prefix .          # = node index.js, API on port 4780
```

The client (`../client`) proxies `/api` to `http://localhost:4780`.

**The server does NOT auto-reload.** `dev` is literally `node index.js`. After editing anything
in `server/`, kill and restart it (`pkill -f "node server/index.js"` then relaunch) before
testing — otherwise you're testing stale code.

## CRITICAL: engine.js is shared, unchanged, with production

`engine.js` is imported **as-is** by the production Worker (`../worker/src/index.js`) — it is
not forked or duplicated. Configurator and pricing behavior must stay identical between Express
and the Worker.

- Edit rule/pricing logic **once, here**.
- Gate every change with `node sweep.js` (expect **36 families, 37,045 checks, 0 failures**)
  before considering it done.
- Never copy engine logic into `../worker/` — import it, as the Worker already does.

## Data safety — read before touching schema or data

- DB file: `epe-quote.db` (WAL mode). On startup, `createSchema(db, {backup:true})` takes a
  daily backup and runs versioned migrations — data persists across restarts.
- **Migrations are versioned and additive-only.** Never edit an existing entry in the
  `MIGRATIONS` array in `db.js` — **add a new migration** (guarded, idempotent `up(db)`) that
  only adds columns/tables/indexes.
- After any schema change, run `node test-migrations.mjs` and confirm **6 passed, 0 failed**.
  It round-trips the real DB and a synthetic legacy-schema DB, asserting every row/column
  survives.
- Backups live in `backups/` (retention 40): before every migration, daily on startup, and on
  demand (`POST /api/admin/backups`). `GET /api/admin/export` downloads the whole DB.

## Seeding is DESTRUCTIVE

```bash
npm run seed --prefix .    # = node seed/run.js
```

This **deletes `epe-quote.db` and rebuilds the entire catalogue** from `seed/*.js`. **It wipes
all quotations.** Only for initial setup or a deliberate clean catalogue reset — never to
"update" a running system. Catalogue edits belong in the Admin UI, not re-seeding.

## Attachments storage (local dev)

`uploads/` (gitignored) is the local filesystem stand-in for the Worker's R2 bucket — same
`q<quoteId>/<uuid>-<name>` key scheme, referenced by `attachments.r2_key`. Requires `multer`
(a regular dependency here, even though it's dev-only — this app never deploys as a server).

## Regression gates (run before declaring any server change done)

```bash
node sweep.js            # expect: 36 families, 37045 checks, 0 failures
node test-migrations.mjs # expect: 5 passed, 0 failed (after any schema change)
```

DB baseline to restore after testing: **16 quotes · 39 families · 61 parts · 5 categories**.

Full test layers, conventions, and per-area checklists: `../TESTING.md`.
