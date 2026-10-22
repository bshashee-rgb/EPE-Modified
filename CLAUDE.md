# EPE Quote Builder — Agent Guide (CLAUDE.md)

CPQ (Configure / Price / Quote) web app for **EPE Process Filters & Accumulators Pvt. Ltd.**
(Hyderabad hydraulics manufacturer). Sales configure products against positional **ordering codes**
with parent→child dependencies, price them, and produce quotations; Admins maintain the whole
catalogue (families, options, rules, prices, spares) as **metadata — no code changes**. The runnable
app is in `quote-app/`. Humans start at [`README.md`](README.md); agents start here.

> This is the lean, always-loaded map. Detail lives in the docs indexed below and in **path-scoped
> `CLAUDE.md` files that load automatically when you touch a subfolder** (`quote-app/worker/`,
> `quote-app/server/`, `quote-app/client/`). Don't duplicate their content here.

---

## Two runtimes — never confuse them

| | Local dev / tests | **Production** |
|---|---|---|
| Server | Express `server/index.js` (better-sqlite3, **sync**) | Worker `worker/src/index.js` (Hono + D1, **async**) |
| Data | `server/epe-quote.db` file | **Cloudflare D1** (system of record) |
| Auth | none (legacy `X-Actor`) | email/password sessions |
| URL | localhost:4780 / :5178 (or worker :8787) | https://epe-quote.ramki-461.workers.dev |

The rule/pricing engine (`server/engine.js`) is **shared unchanged** by both. The API surface is
mirrored (~57 routes) between Express and the Worker. Local Express is now a **dev seed only** —
production D1 has diverged ahead of it.

---

## Golden rules (non-negotiable — these encode compliance & data safety)

1. **`engine.js` is shared — edit it once, never fork it into the worker.** Gate every engine change
   with `node quote-app/server/sweep.js` (expect `36 families, 37045 checks, 0 failures`).
2. **Certification / pressure-rating rules are regulatory** (ASME, PED, CRN). A bug there is a
   compliance defect, not a UX nit — highest severity in the rule base. See [ARCHITECTURE](docs/ARCHITECTURE.md).
3. **The datasheet is the contract.** Segment names, option meanings, and violation messages must use
   the source datasheet's vocabulary (PDFs in `Filters/ Accumulators/ Switches/ Valves/`).
4. **Never silently ₹0.** Unmapped / special options price as **PoA** (Price on Application).
5. **Traceability**: archive-never-delete, full audit trail, immutable finalized (non-Draft) quotes,
   revision letters. Don't weaken these. Every mutation calls `audit(...)`. Attachments are
   **archived, never hard-deleted**, same as every other entity here.
6. **Server is the authority.** Every add-line/reconfigure re-evaluates server-side and rejects
   incomplete/invalid configs — the client never persists a code the server didn't validate.
7. **Data safety**: schema changes are additive-only versioned migrations; never edit an old one; run
   `node quote-app/server/test-migrations.mjs` (`6 passed, 0 failed`). See [`server/CLAUDE.md`](quote-app/server/CLAUDE.md).
8. **NEVER run a `--remote` schema-reset or data-import against production D1** — it wipes live quotes.
   See [`worker/CLAUDE.md`](quote-app/worker/CLAUDE.md) and [DEPLOYMENT](docs/DEPLOYMENT.md).
9. **Match the surrounding code**: plain React + hooks, hand-written CSS (no TS, no CSS/state
   framework), existing conventions. See [`client/CLAUDE.md`](quote-app/client/CLAUDE.md).

---

## Where things live (pointer index)

| Need | Read |
|---|---|
| Human/client overview, quickstart | [`README.md`](README.md) |
| Domain model, rule engine (D1–D7), API surface, roadmap | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Environments, CI/CD, releases, secrets, rollback, staging | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) |
| Working in the **Worker** (Hono/D1, auth, deploy safety) | [`quote-app/worker/CLAUDE.md`](quote-app/worker/CLAUDE.md) + [`worker/README.md`](quote-app/worker/README.md) |
| Working in the **Express server** (engine, db, seeding, data safety) | [`quote-app/server/CLAUDE.md`](quote-app/server/CLAUDE.md) |
| Working in the **client** (React/Vite, api.js, styles, auth UI) | [`quote-app/client/CLAUDE.md`](quote-app/client/CLAUDE.md) |
| How to test (layers, gates, checklists, DoD) | [`quote-app/TESTING.md`](quote-app/TESTING.md) |
| Feature changelog (FR-A# entries) | [`quote-app/README.md`](quote-app/README.md) |
| The PRD + product spec appendices | [`Quote-App-Requirements/`](Quote-App-Requirements/) |

---

## Branch & release model (see [DEPLOYMENT](docs/DEPLOYMENT.md) for full detail)

`feature/*` → **`develop`** (auto-deploys to **staging**) → **`main`** (tag `v*` → **production**).
Cut tags only from CI-green `main`. Client-facing testing happens on **staging** (separate Worker +
D1 — never touches production data). CI (`ci.yml`) runs the full worker suite on every PR.

## Conventions

- Add a feature → add an `FR-A#` entry to the PRD **and** `quote-app/README.md` (addendum ends at
  **FR-A30**; next is FR-A31). Keep both in sync with the code.
- When you add or change a route in one runtime, mirror it in the other (Express ↔ Worker) — the
  frozen client calls both; a missing route is a production 404.
