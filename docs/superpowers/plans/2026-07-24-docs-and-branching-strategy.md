# Documentation Architecture & Branching Strategy — Implementation Plan

> Status: **EXECUTED 2026-07-24** (PR #1, merged to `main`). Docs restructure, staging env + `develop` branch, and `deploy-staging.yml` are all live. Remaining: set `CLOUDFLARE_API_TOKEN` (enables automated deploys) and — if wanted — GitHub Pro for enforced branch protection.

**Goal:** Restructure the repo's documentation for token/memory-optimized agent context (one source of truth per topic, minimal always-loaded footprint), add a complete human-facing README, and stand up a dev → testing → production branch + environment strategy where client testing can never touch production data.

**Decisions locked in:**
- Docs: full tiered restructure (lean CLAUDE.md map + path-scoped subfolder CLAUDE.md + split reference docs + new root README).
- Branching: `feature/*` → `develop` (auto-deploys to staging) → `main` (tag → prod). Separate staging Worker + staging D1.
- Execution: on a `chore/docs-and-cicd` branch → PR → review → merge (models the new workflow). Docs/config only; no app-code changes.

**Recommended execution method:** run this through the existing `update-agent-instructions` skill / instruction-maintenance gate agents (context-economist, instruction-architect, dependency-cartographer), because it edits agent-instruction files (CLAUDE.md tiering, cross-references). That pipeline validates the reference graph and token budget.

---

## Part A — Documentation architecture (tiered by load frequency)

**Principle:** split by audience × load-frequency. Always-loaded context stays tiny and pointer-based; detail loads only when a task touches the relevant subtree; each topic has exactly one home (no duplication → no contradictions → higher agent accuracy).

### Target file map

| Tier | File | Loaded | Content (and where it comes from) |
|---|---|---|---|
| Always | `CLAUDE.md` (trim 337 → ~130 lines) | every session | App one-liner; the **two-runtime warning** (Express-local vs Worker-prod); ~6 golden rules (data-safety, shared engine, cert-rules-are-compliance-not-UX, PoA-never-₹0, archive-never-delete, immutable finalized quotes); **pointer index** to every doc below. Nothing else. |
| Path-scoped | `quote-app/worker/CLAUDE.md` (new; absorbs worker/README.md agent bits) | touching `worker/` | Hono/D1 idioms, auth model, `actor(c)`, deploy/secrets, D1 Time Travel, "never `--remote` schema-reset on prod". |
| Path-scoped | `quote-app/server/CLAUDE.md` (new) | touching `server/` | Express, the **shared** `engine.js` (D1–D7), `db.js` migrations + data-safety layer, seeding (DESTRUCTIVE), sweep/test-migrations gates. |
| Path-scoped | `quote-app/client/CLAUDE.md` (new) | touching `client/` | React/Vite, `api.js` (relative `/api`, X-Actor legacy, 401 handling), styles conventions, legacy-mode (404) contract. |
| On-demand | `README.md` (root, **new**) | humans / GitHub landing | Complete overview (Part B). |
| On-demand | `docs/ARCHITECTURE.md` (**new**) | when needed | Company/vertical context (from CLAUDE.md §0), domain model & rule engine D1–D7 (§4), API surface (§5), data model. The deep reference. |
| On-demand | `docs/DEPLOYMENT.md` (**new**) | when needed | Environments, CI/CD workflows, release/tag flow, secrets, rollback, staging (Part C). Supersedes CLAUDE.md §9 detail. |
| On-demand | `quote-app/TESTING.md` | when testing | Keep; add a short "CI runs this" note + staging test guidance. |
| On-demand | `Quote-App-Requirements/*` | when authoring catalogue | Keep as-is (PRD + spec appendices). |
| Archive | `docs/superpowers/plans/*` | rarely | Historical plans; keep. |

### What moves out of the 337-line CLAUDE.md
- §0 company/vertical → `docs/ARCHITECTURE.md` (keep a 2-line essence + pointer in CLAUDE.md).
- §3 data safety detail → `server/CLAUDE.md` (keep the one-line rule + pointer).
- §4 domain model / rule engine → `docs/ARCHITECTURE.md`.
- §5 API surface → `docs/ARCHITECTURE.md`.
- §9 deployment → `docs/DEPLOYMENT.md` (already partly written; move + expand).
- §2/§10 dev commands → split: local-Express commands to `server/CLAUDE.md`, release/deploy to `DEPLOYMENT.md`, keep a tiny quick-ref in root README.
- **Stays in CLAUDE.md:** the golden rules, the two-runtime table, and the pointer index.

### Acceptance
- `CLAUDE.md` ≤ ~130 lines, every section either a rule or a pointer.
- Each moved topic exists in exactly one file (grep for duplication).
- Every pointer resolves (no dead links); every subfolder CLAUDE.md is a valid dynamic-load stub.
- Reference graph validated (dependency-cartographer) — no orphaned/broken cross-scope links.

---

## Part B — Root `README.md` (complete, human/client-facing)

Outline:
1. **What it is** — EPE Quote Builder: CPQ for a hydraulics manufacturer; configure→price→quote against positional ordering codes.
2. **Live app** — production URL, auth note, "system of record = Cloudflare D1".
3. **Architecture at a glance** — one diagram: React client + Hono Worker + D1; the shared rule engine; local-Express-vs-prod-Worker split.
4. **Quickstart** — local dev (client+server), run the worker locally, run the test suite.
5. **Deploy & releases** — the branch model + tag-to-deploy in 5 lines, linking `docs/DEPLOYMENT.md`.
6. **Repo layout** — short tree with one-line purpose each.
7. **Docs index** — links to ARCHITECTURE, DEPLOYMENT, TESTING, Requirements, and the CLAUDE.md note ("agents: start at CLAUDE.md").
8. **Status & roadmap** — deployed; next: Zoho auth.

Constraints: no secrets, no real customer data, no internal credentials. Written for a human (client/new dev), not an agent.

---

## Part C — Dev / Testing / Production strategy

**Safety-critical invariant:** client testing on staging must never read or write production quotes.

### Branches
- `feature/<slug>` — one per client request, off `develop`.
- `develop` — integration; every push auto-deploys to **staging**.
- `main` — production; protected (require PR + green CI + 1 review); tag `v*` → prod deploy.

Flow: `feature/*` → PR → CI → merge `develop` → staging deploy → client reviews on staging URL → when a release is signed off, PR `develop` → `main` → tag `vX.Y.Z` → prod deploy.

### Cloudflare environments (wrangler named environments)
Keep the current top-level config as **production** (unchanged, already deployed). Add a `staging` env:

```jsonc
// wrangler.jsonc — add alongside existing top-level (production) config
"env": {
  "staging": {
    "name": "epe-quote-staging",
    "d1_databases": [
      { "binding": "DB", "database_name": "epe-quote-staging", "database_id": "<set after create>" }
    ]
    // assets + main inherit; SESSION_SECRET set per-env via `wrangler secret put --env staging`
  }
}
```

Setup steps (executed at implementation, needs `wrangler login`):
1. `npx wrangler d1 create epe-quote-staging` → paste id into the staging block.
2. `npx wrangler d1 execute epe-quote-staging --remote --file=./schema.sql` then `auth-schema.sql`.
3. Seed staging **data** from a prod snapshot OR the repo seed (throwaway): `wrangler d1 export` prod → import to staging, or apply `data.sql`. Document that staging data is refreshable and disposable.
4. `openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET --env staging`.
5. Seed a staging admin: `node seed-admin.mjs --email ramki@nexivo.co --name Ramki --role admin --remote --env staging` (extend seed-admin.mjs to accept `--env`).

### Workflows
- `ci.yml` — unchanged (PR + push; local D1 only).
- `deploy-staging.yml` (**new**) — on push to `develop`: build client + `npx wrangler deploy --env staging`. Uses the same `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets.
- `deploy.yml` — unchanged (tag `v*` → prod, default env). Add a guard note that it targets production.

### Branch protection (GitHub settings, via `gh` or UI)
- `main`: require PR, require `CI` status check to pass, require 1 approving review, no direct pushes, no force-push.
- `develop`: require `CI` to pass (lighter; allow self-merge).

### Data management across envs
- Prod → staging refresh is a documented one-liner (`wrangler d1 export` prod, import to staging) so clients test against realistic data without risk.
- **Never** the reverse (staging → prod) except a deliberate, backed-up migration.
- Both keep the `users` table out of exports (already enforced).

---

## Part D — Hygiene (fold in during execution)
- `git rm --cached quote-app/server/epe-quote.db-wal quote-app/server/epe-quote.db-shm` and add `*.db-wal` / `*.db-shm` (and `quote-app/worker/data.sql`, already ignored, keep) to `.gitignore`. These SQLite runtime files must never be tracked.
- Verify `.dev.vars`, `data.sql` remain ignored.

---

## Execution sequence (when approved)
1. Branch `chore/docs-and-cicd` off `main`.
2. Part D hygiene (untrack wal/shm) — 1 commit.
3. Part A: create `docs/ARCHITECTURE.md` + `docs/DEPLOYMENT.md` (move content), then trim `CLAUDE.md`, then add the three subfolder `CLAUDE.md` files — commit per file group; validate reference graph + CLAUDE.md line budget.
4. Part B: root `README.md` — 1 commit.
5. Part C: `wrangler.jsonc` staging env + `deploy-staging.yml` + `seed-admin.mjs --env` support — 1 commit (Cloudflare resource creation + secrets happen live, logged, no secrets committed).
6. Create `develop` branch; set branch protection on `main`/`develop`.
7. Open PR `chore/docs-and-cicd` → `main`; CI must pass; Ramki reviews; merge.
8. Cut `v1.1.0`? No — docs/infra only; tag only if a prod deploy is desired. Staging comes up on first push to `develop`.

## Risks / rollback
- Docs restructure is reversible (git). The only runtime change is adding a staging env — additive, cannot affect production (`epe-quote` config untouched).
- Trimming CLAUDE.md risks dropping a rule agents rely on → mitigated by moving (not deleting) content and keeping pointers; verify with a grep that each rule survives somewhere.
- Staging D1 creation is new spend but minimal (D1 free tier covers it).
