# Project State — pick up here

Living snapshot of where the EPE Quote Builder stands, so work can resume from GitHub on any machine.
Canonical detail lives in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and [`CLAUDE.md`](CLAUDE.md) — this file is the quick "where are we / what's next".

**Last updated:** 2026-08-08 — paused, no work in flight.

## Status: LIVE, healthy, nothing half-finished

| Thing | State |
|---|---|
| Production | 🟢 https://epe-quote.ramki-461.workers.dev (auth-gated) — Worker `epe-quote` + D1 `epe-quote`, **system of record** |
| Staging | 🟢 https://epe-quote-staging.ramki-461.workers.dev — Worker `epe-quote-staging` + D1 `epe-quote-staging` (throwaway data) |
| Git | `main` = `develop`, clean & pushed; release **`v1.0.0`** |
| CI/CD | `ci.yml` (PR/main), `deploy.yml` (tag `v*`→prod), `deploy-staging.yml` (push `develop`→staging) |
| Auth | temporary email/password (PBKDF2 sessions); built for a drop-in **Zoho OAuth** swap |
| Cloudflare account | `461c12ef6bd4431ec4cff01c3ea09335` (needs local `wrangler login` to deploy by hand) |

## Architecture (one line)
React/Vite client + **Hono Worker + D1** in prod; a local **Express + SQLite** app is dev-only (now a historical seed). The rule engine `quote-app/server/engine.js` is **shared unchanged** by both — never fork it; gate edits with `node quote-app/server/sweep.js`. Full map: [`CLAUDE.md`](CLAUDE.md).

## Branch / release flow
`feature/* → develop (→ staging) → main (tag v* → prod)`. Cut tags only from CI-green `main`.

## PENDING — 3 external actions (no code work)
1. **Set `CLOUDFLARE_API_TOKEN` GitHub secret** (only `CLOUDFLARE_ACCOUNT_ID` is set). Until then the deploy workflows fail at auth — the recurring red "Deploy to Staging" runs are expected; manual `npx wrangler deploy` / `--env staging` still works. Create a Cloudflare token ("Edit Workers" + D1 Edit), then `gh secret set CLOUDFLARE_API_TOKEN`.
2. **Rotate the prod admin password** — `ramki@nexivo.co` still on the temporary password set during setup. Change in-app, or `node quote-app/worker/seed-admin.mjs --email ramki@nexivo.co --name Ramki --role admin --remote --password '<new>'`.
3. **Branch protection not enforced** — GitHub gates it behind Pro for private repos (repo must stay private). Convention-based for now; upgrade to Pro to enforce PR + green CI on `main`.

## Next feature
**Zoho OAuth auth = `v1.1.0`** — the first change to run through the `develop` pipeline. Swap contract in [`quote-app/worker/README.md`](quote-app/worker/README.md); only `verifyCredentials()` + the login form change.

> Do NOT commit real secrets or the `.db` file's live data beyond what's already tracked. Never run a `--remote` schema-reset/data-import against production D1 — it wipes live quotes.
