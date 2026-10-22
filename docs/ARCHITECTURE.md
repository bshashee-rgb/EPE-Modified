# Architecture — EPE Quote Builder

On-demand deep reference for the domain and system architecture: why the app is shaped this way,
the domain model and rule engine, and the API surface. Load this when a task touches the
configurator, the rule engine, the catalogue domain model, or the API. For the project map and
day-to-day rules, start at the root [README.md](../README.md) and [CLAUDE.md](../CLAUDE.md).

Not in scope here:
- Deployment, environments, CI/CD, releases, rollback → [docs/DEPLOYMENT.md](DEPLOYMENT.md).
- Local dev commands, database/seeding, data-safety mechanics → [quote-app/server/CLAUDE.md](../quote-app/server/CLAUDE.md).
- Test methodology and gates → [quote-app/TESTING.md](../quote-app/TESTING.md).
- The PRD and per-category spec hierarchies → [Quote-App-Requirements/](../Quote-App-Requirements/).

---

## 1. The company & its vertical (why the app is shaped this way)

**EPE Process Filters & Accumulators Pvt. Ltd.** — est. 1991, Techni Towers, Balanagar, Hyderabad
(the address printed on quotations). Manufacturer/exporter of **hydraulic & process filters, filter
elements, and hydro-pneumatic accumulators** (bladder, diaphragm, piston). ISO 9001 / ISO 14001 /
OHSAS 18001 accredited; holds **CE (PED)** and **ASME U-Stamp** certifications; national MSME awards;
customers include BHEL and other heavy-industry OEMs (the seed's demo customers — BHEL, L&T — are
their real customer profile).

The vertical is **engineer-to-order industrial equipment sold to OEMs**, and it drives concrete
design decisions in this codebase — keep them intact:

- **Accumulators are regulated pressure vessels** (ASME BPVC VIII-1, PED 2014/68/EU, CRN for
  Canada). Certification choices are literally ordering-code options with prerequisite rules
  (e.g. `CRN ⇒ 7U + NB` in the D6 COMPOSE rules). These rules encode *regulatory* constraints —
  a bug there is a compliance problem, not a UX nit. Treat certification/pressure-rating rules as
  the highest-severity part of the rule base.
- **The datasheet is the contract.** Every product family mirrors a published datasheet (PDF in
  `Filters/`, `Accumulators/`, `Switches/`, `Valves/`; ref + revision stored on the family, e.g.
  "EPE/05.001/LD Rev.9/09-2024"). When authoring or changing a family, read the PDF — segment
  names, option meanings, and violation messages must use the datasheet's own vocabulary. Every
  datasheet says "check availability before ordering" → the `on_request` flag / `to_confirm`
  availability on quote lines.
- **ISO 9001 traceability** → archive-never-delete, full audit trail, immutable finalized
  quotations, revision letters (Q-2026-0001 Rev A/B/…). Don't weaken these for convenience.
- **Engineered specials exist** → unmapped or special options price as **PoA** (Price on
  Application) and flag the line for commercial review — never silently ₹0.
- **Commercials are Indian B2B**: INR, GST, quote validity days, discounts at line and header level.
- Market frame: this app is EPE's in-house equivalent of industrial CPQ suites (Tacton, Infor,
  Cincom) — purpose-built around EPE's positional ordering-code system instead of a generic
  configurator.

**Domain vocabulary** (used throughout code/UI): *ordering code* — the positional product code a
customer orders by; *segment/position* — one slot in that code; *family* — a product series (LD, AS,
AP…); *PoA* — price on application; *on-request* — availability to confirm; *companion* — related
product auto-proposed with a config (element, seal kit, safety block, clamps); *spare/part* — fixed
part number, not configured; *revision* — letter suffix of a re-issued quote number.

---

## 2. Domain model & rule engine (the heart of the app)

Each product **family** has ordered **segments** (positions of the ordering code), each with
**options**. Dependencies are **rules** (JSON in the `rules` table), types **D1–D7**:

| Type | Meaning |
|------|---------|
| `FILTER` (D1/D2) | limit which options a segment offers based on other selections (invalid options are **disabled, not hidden**) |
| `DEFAULT` (D4)   | conditional default value (recomputed as parents change; most-specific match wins) |
| `DERIVE` (D3)    | read-only derived facts (e.g. "Max system pressure = 40 bar") |
| `CONSTRAINT` (D5)| require / forbid / numeric bounds, with a datasheet-grounded violation message |
| `COMPOSE` (D6)   | multi-select rules: mutually-exclusive pairs, prerequisite chains |
| companion (D7)   | cross-product companions (element + seal kit, safety block, clamps…) resolved with codes |

`engine.js` key functions:
- `evaluate(meta, selections)` — **two-pass, fixpoint** eval: resolves effective config (user
  choices + auto defaults), re-applies rules so defaulted parents filter children, resets stale
  child choices with a non-blocking warning. Returns `{effective, segments (with enabled flags),
  code, complete, violations, facts, price, companions, availability, warnings}`.
- `renderCode` / `parseCode` — generate the ordering code / reverse-parse a code back to a config
  (reports invalid positions in `issues[]`).
- `priceConfiguration` — most-specific base price + option adders (abs/pct); unmapped → **PoA**.

**Server is the authority (NFR-3):** every add-line/reconfigure re-evaluates server-side and rejects
incomplete/invalid configs. The client never persists a code the server didn't validate.

**The engine is shared, not duplicated.** `server/engine.js` is loaded **unchanged by both
runtimes** — the local Express server (`server/index.js`, better-sqlite3, sync) and the production
Cloudflare Worker (`worker/src/index.js`, Hono + D1, async). There is exactly one copy of the rule
and pricing logic in the repo. Edit engine behavior once, gated by `node server/sweep.js`
(37,045 checks across the full catalogue) — never fork it into the worker. See
[quote-app/server/CLAUDE.md](../quote-app/server/CLAUDE.md) for how the Express side runs it and
`quote-app/worker/CLAUDE.md` for the Worker/D1 side.

---

## 3. API surface

All routes live under `/api`, and the surface is **mirrored across both runtimes**: `server/index.js`
(Express) and `worker/src/index.js` (Hono) each expose the same ~57 routes against the same rule
engine, differing only in transport (sync better-sqlite3 vs async D1) and auth (see
[docs/DEPLOYMENT.md](DEPLOYMENT.md) for the auth/session model in production; the legacy Express
path identifies the actor via the **`X-Actor`** header, the role dropdown: `sales` / `admin`).

Route groups:
- **Catalogue/config**: `GET /api/catalog`, `GET /api/families/:id/meta`,
  `POST /api/families/:id/evaluate`, `POST /api/families/:id/parse-code`, `GET /api/parts`,
  `GET /api/popularity`.
- **Quotes**: `GET/POST /api/quotes` (`?customer_id=` filters to one customer's quotes for the
  Customer History comparison view, FR-A31 — always includes archived in that case),
  `GET/PATCH/DELETE /api/quotes/:id`, `/archive`, `/unarchive`,
  `/revise` (same number, next revision), `/clone` (new number), `/reorder`, `/audit` (history),
  lines via `POST /api/quotes/:id/lines`, `PATCH/DELETE /api/lines/:id`,
  `PATCH /api/lines/:id/reconfigure`.
- **Admin**: `/api/admin/categories`, `/api/admin/families`, `/api/admin/segments`,
  `/api/admin/options`, `/api/admin/rules`, base/option prices, `/api/admin/parts`,
  `/api/admin/summary`, `/api/admin/audit`, `/api/admin/backups`, `/api/admin/export`.

**Integrity guards** (FR-A29): finalized (non-Draft) quotes are **locked server-side** —
content/line mutations return `409`, but status transitions and archive/unarchive stay allowed
(`requireDraftQuote`). A global error middleware maps SQLite/D1 constraint errors → `409`/`400`.
Multi-write ops (clone/revise, line ops) are transactional.

---

## 4. Product roadmap

**Done & verified** — the full FR-A1..A29 addendum: configurator (D1–D7), quoting lifecycle
(create/revise/clone/archive/delete, drag+keyboard reorder, history timeline, status pipeline),
Admin (tabbed editor, accordion segments, guided rule builder, category/spare-parts CRUD, pricing
authoring), dashboard, popularity ranking, data-safety layer, the server/client hardening from the
QA review, and — as of the Cloudflare Worker rollout — **email/password authentication with
server-side sessions in production**. Sweep and migration tests green.

**NOT built yet — Tier-4 product roadmap** (these are milestones, not bugs; scope before building):
1. ~~Authentication + server-side RBAC~~ — **DONE.** Production runs on email/password sessions
   (see `worker/README.md`); the legacy `X-Actor`-header/role-dropdown mode remains only for the
   local Express dev server (no auth there — see [docs/DEPLOYMENT.md](DEPLOYMENT.md) for the
   two-runtime split). (FR-5.1/5.2, NFR-5)
2. **Pricing operations** — multiple price lists (currency/region/tier), effective dates,
   draft→published lifecycle, spreadsheet import/export. (FR-2.2/2.7)
3. **Discount governance** — role-based discount limits, approval workflow, quantity tier breaks. (FR-2.4)
4. **Outbound flows** — email dispatch of quotes, ERP/CRM (Zoho) handoff on Won. (FR-3.3/3.5/5.3)
5. **Global option dictionaries** as shared entities (rename propagates across families). (FR-4.2)
6. **Metadata versioning / impact preview / bulk import** of segments-options-rules. (FR-4.4/4.6/4.9)
7. Sales-efficiency: templates/favourites, one-click companion→line, fixed-BOM (NFF2) systems.

A full E2E test + review report for this app was produced as an artifact during development; the
findings from it are all fixed (see `quote-app/README.md` FR-A28/A29).
