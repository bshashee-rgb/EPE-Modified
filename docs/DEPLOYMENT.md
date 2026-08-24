# Deployment, Releases & CI/CD

On-demand operational reference for the EPE Quote Builder. This is the deep source of truth for
environments, branch model, CI/CD workflows, releases, secrets, manual ops, backups, and rollback.
`CLAUDE.md` §9 keeps only a one-line pointer to this file plus the two-runtime rule agents must
never violate.

**Legend used throughout:** 🟢 **LIVE** = exists today and is in active use. 🔵 **PLANNED** = approved
in `docs/superpowers/plans/2026-07-24-docs-and-branching-strategy.md` (Part C), not yet provisioned.
Nothing in a 🔵 section is safe to assume exists until it's been executed and this doc is updated.

See also: root [`README.md`](../README.md) · [`CLAUDE.md`](../CLAUDE.md) ·
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md) · [`quote-app/worker/CLAUDE.md`](../quote-app/worker/CLAUDE.md) ·
[`quote-app/worker/README.md`](../quote-app/worker/README.md).

---

## 1. Two runtimes — don't confuse them

| | Local dev / tests | Production 🟢 |
|---|---|---|
| Server | Express `quote-app/server/index.js` (better-sqlite3, sync) | Worker `quote-app/worker/src/index.js` (Hono + D1, async) |
| Data | `quote-app/server/epe-quote.db` file | Cloudflare D1 |
| Auth | none (legacy `X-Actor` header mode) | email/password sessions — see `worker/README.md` |
| Port | API 4780, client 5178 | served from the Worker itself (assets + `/api/*`) |

**The rule/pricing engine (`quote-app/server/engine.js`) is shared, unchanged, by both runtimes.**
The worker imports it straight from `../server/engine.js` — it is not copied or forked. Edit engine
logic exactly once, gate it with `node quote-app/server/sweep.js` (36 families / 37,045 checks / 0
failures), and let both runtimes pick up the change. **Never fork `engine.js` into the worker** —
that would let configurator/pricing behavior between local dev and production silently diverge.

The local Express app + its `.db` file are now a **historical dev seed only** — production D1 has
diverged ahead of it since going live. To inspect or recover current production data, use
`wrangler d1 export`/`execute`, never the repo's `.db` file (§7).

---

## 2. Environments

### Production 🟢 LIVE
- **URL**: https://epe-quote.ramki-461.workers.dev (login-gated — see `worker/README.md` §Authentication).
- **Worker**: `epe-quote` (top-level config in `quote-app/worker/wrangler.jsonc`).
- **Database**: D1 `epe-quote` (`database_id: b34a06ce-1726-4a7d-adc3-6f7b1974a37e`).
- **Cloudflare account**: `461c12ef6bd4431ec4cff01c3ea09335`.
- **System of record**: production D1. The repo's `server/epe-quote.db` is not kept in sync with it.

### Staging 🟢 LIVE
Purpose: client testing/review on a URL that can never read or write production quotes.
- **URL**: https://epe-quote-staging.ramki-461.workers.dev (login-gated; admin `ramki@nexivo.co`).
- **Worker**: `epe-quote-staging` (`env.staging` block in `wrangler.jsonc`, see §4).
- **Database**: D1 `epe-quote-staging` (`database_id: 3f7bbd89-ca09-4d3f-9332-928a6d86688b`), seeded
  with throwaway data — refreshable and disposable, never the source of truth.
- **Trigger**: every push to `develop` auto-deploys here (via `deploy-staging.yml`, §4) — this needs
  the `CLOUDFLARE_API_TOKEN` secret to be set; until then, deploy staging manually with
  `npx wrangler deploy --env staging`.
- **Data flow**: prod → staging refresh is one-directional and documented (§6). The reverse
  (staging → prod) never happens except a deliberate, backed-up migration.

---

## 3. Branch model

```
feature/<slug>  →  develop  →  main
   (per task)      (staging)   (production)
```

- **`feature/<slug>`** — one branch per client request/task, cut off `develop`.
- **`develop`** — integration branch. 🟢 Every push auto-deploys to the staging Worker.
- **`main`** — production branch. Convention: merge only via PR with green `CI`; tag `v*` to deploy.

Flow: `feature/*` → PR → CI → merge to `develop` → 🟢 staging deploy → client reviews on the staging
URL → when a release is signed off, PR `develop` → `main` → tag `vX.Y.Z` → `deploy.yml` ships prod.

### `develop` and branch protection — status
🟢 **`develop` branch exists** and every push to it runs `deploy-staging.yml`.
⚠️ **Branch protection is NOT enforced** — GitHub's branch-protection and rulesets require **GitHub
Pro** for **private** repos, and this repo is private (holds real pricing/quote data, so it must stay
private). Until the account is on Pro, the flow is **convention-based**: always PR into `main`, never
push to it directly, and let CI go green before merging. CI still runs on every PR — it just isn't a
hard merge gate. To enforce it later: upgrade to GitHub Pro, then Settings → Branches (or Rules) →
require PR + the `test` status check on `main`.

### Staging Worker config (wrangler.jsonc) 🟢 LIVE
The `env.staging` block below is in `wrangler.jsonc`. Staging is provisioned and live at
**https://epe-quote-staging.ramki-461.workers.dev** (separate worker `epe-quote-staging` + separate
D1 `epe-quote-staging` + its own `SESSION_SECRET`; seeded with throwaway data + an admin). It is
additive and does not touch the
`epe-quote` production block:

```jsonc
// quote-app/worker/wrangler.jsonc
"env": {
  "staging": {
    "name": "epe-quote-staging",
    "d1_databases": [
      { "binding": "DB", "database_name": "epe-quote-staging", "database_id": "<set after create>" }
    ]
    // assets + main inherit from the top-level config;
    // SESSION_SECRET is set per-env via `wrangler secret put --env staging`
  }
}
```

Provisioning steps (run once, live, when the plan is executed):
```bash
cd quote-app/worker
npx wrangler d1 create epe-quote-staging          # paste the returned id into the block above
npx wrangler d1 execute epe-quote-staging --remote --file=./schema.sql
npx wrangler d1 execute epe-quote-staging --remote --file=./auth-schema.sql
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET --env staging
node seed-admin.mjs --email ramki@nexivo.co --name Ramki --role admin --remote --env staging
```
(`seed-admin.mjs --env` support is itself part of the planned change — see the plan's Part C step 5.)

---

## 4. CI/CD workflows

Three workflows in `.github/workflows/`. Two exist today; the third is planned.

### `ci.yml` 🟢 LIVE — quality gate
- **Trigger**: every pull request, and every push to `main`.
- **What it does**: `actions/setup-node@v4` pinned to **Node 22**, installs client/server/worker deps,
  runs the auth unit tests, provisions a throwaway `SESSION_SECRET` into `.dev.vars` (CI-only, unrelated
  to the real production secret), then runs the full worker suite `worker/test/run-all.sh` (auth +
  parity + writes + admin-writes) against a **fresh local D1**.
- **Never contacts production** — no `CLOUDFLARE_API_TOKEN` is used in this workflow at all.

### `deploy.yml` 🟢 LIVE — production release
- **Trigger**: pushing a `v*` tag, or manual dispatch from the Actions tab.
- **What it does**: Node 22 setup → `npm ci` + `npm run build` for the client → `npm ci` for the
  worker → `cloudflare/wrangler-action@v3` runs `wrangler deploy` in `quote-app/worker`, authenticated
  with `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`.
- **Safety property**: it ships **code + built assets only**. It never runs a schema/data/migration
  command against D1 — production data is never touched by a deploy. This is enforced by the workflow
  simply not containing any `d1 execute`/import step, not by a runtime guard.
- One deploy at a time (`concurrency: cloudflare-deploy`, `cancel-in-progress: false`) — a deploy is
  never cancelled mid-flight.

### `deploy-staging.yml` 🟢 LIVE (needs the API-token secret to succeed)
- **Trigger (intended)**: every push to `develop`.
- **What it will do**: build the client, then `npx wrangler deploy --env staging`, using the same
  `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets as `deploy.yml` (no new secrets needed —
  the `--env staging` flag targets the staging Worker/D1 defined in `wrangler.jsonc`).
- Same safety property as `deploy.yml`: code + assets only, no data operations.

---

## 5. Release flow & semver

Deployment is driven by GitHub Actions, never by a manual `wrangler deploy` from a laptop (that's the
break-glass fallback in §7).

```
merge green PRs into main
  → tag main:  git tag -a v1.1.0 -m "…" && git push origin v1.1.0
  → deploy.yml ships it
```

- **Cut tags only from CI-green `main`.**
- Semver: **patch** = fixes, **minor** = features (e.g. the Zoho auth swap), **major** = breaking
  changes.
- Watch a running deploy: `gh run watch` or the repo's Actions tab.

---

## 6. Required GitHub secrets

Settings → Secrets and variables → Actions:

| Secret | Value / how to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | A token with **Workers Scripts: Edit** + **D1: Edit** on the account. Cloudflare dashboard → My Profile → API Tokens → start from the *Edit Cloudflare Workers* template, then add D1 permission. |
| `CLOUDFLARE_ACCOUNT_ID` | `461c12ef6bd4431ec4cff01c3ea09335` |

Set once via:
```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```
(or the Settings UI). `deploy-staging.yml` reuses these same two secrets — no additional
secret is required to add staging.

---

## 7. Manual worker ops

All run from `quote-app/worker/`, and all need `npx wrangler login` first. **Always use `npx wrangler`**,
never a bare global `wrangler` — this repo pins wrangler `4.114`, and a stale global install rejects
this project's `compatibility_date`.

```bash
# Deploy by hand (rarely — prefer cutting a tag)
npx wrangler deploy

# Seed or reset a user (the only way to add/reset auth users)
node seed-admin.mjs --email <e> --name "<n>" --role admin|sales --remote

# Inspect production data
npx wrangler d1 execute epe-quote --remote --command "SELECT COUNT(*) FROM quotes"

# Rotate the session secret (invalidates ALL active sessions)
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
```

### Safety rule — read before running anything with `--remote`
**Never run `--remote` schema-reset or bulk data-import against `epe-quote` (production) except a
deliberate, backed-up restore.** It wipes live quotes. The staging equivalents (`--env staging`) are
safe to reset freely since staging data is disposable by design (§2). The `users` table is excluded
from both `export-data.sh` and `GET /api/admin/export` so password hashes never leak; a normal data
restore still preserves accounts.

---

## 8. Backups

- **D1 Time Travel** — automatic point-in-time recovery, 30-day window, no snapshot job to run or
  maintain:
  ```bash
  npx wrangler d1 time-travel restore epe-quote --timestamp=<ISO-8601>
  ```
- **In-app JSON export** — `GET /api/admin/export` (Admin screen) downloads a full JSON dump of all
  16 tables. No lock-in.
- The old file-snapshot layer described in `CLAUDE.md` §3 (`server/backups/`, daily + pre-migration
  snapshots) applies **only** to the local Express app, not to production.

---

## 9. Rollback

- **Code**: re-deploy an older tag — Actions tab → *Deploy to Cloudflare* → Run workflow, choose the
  earlier `vX.Y.Z` ref (the existing tag; `deploy.yml` never touches data, so re-running it is safe).
- **Data**: D1 Time Travel (§8) for point-in-time restore within 30 days, or reload from the last
  `GET /api/admin/export` JSON dump.
- Because `deploy.yml` and (once live) `deploy-staging.yml` only ever ship code + assets, a code
  rollback and a data rollback are independent operations — you can roll back one without the other.

---

## 10. Runtime requirements

- **Node ≥ 22** across CI and deploy (`actions/setup-node@v4`, `node-version: 22` in both `ci.yml`
  and `deploy.yml`). This is a real CI finding: `wrangler 4.114` (pinned in `quote-app/worker`'s
  devDependencies) requires Node 22. **This supersedes the `Node ≥ 18` line still in `CLAUDE.md` §9**
  — that line predates this finding and needs to be corrected when §9 is trimmed as part of this
  restructure (see Concerns in the task report).
- Local Express (`quote-app/server`) uses native `better-sqlite3` (rebuilds per platform on
  `npm install`). The Worker is pure JS with no native dependencies, which is exactly why it can run
  on Cloudflare's runtime.
