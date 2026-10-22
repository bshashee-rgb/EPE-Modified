# EPE Quote Builder

CPQ (Configure-Price-Quote) application for EPE Process Filters & Accumulators, built from the
requirements in [`../Quote-App-Requirements/`](../Quote-App-Requirements/EPE-Quote-Application-Requirements.md).

**Stack:** Node.js + Express + SQLite (better-sqlite3) · React (Vite) · no auth (demo role switcher).

## Run

```bash
# 1. Server (API + SQLite) — http://localhost:4780
cd server && npm install && npm run seed && npm start

# 2. Client — http://localhost:5178 (proxies /api to the server)
cd client && npm install && npm run dev
```

`npm run seed` rebuilds `server/epe-quote.db` from scratch (36 product families, 350 spec segments,
2,000+ options, 319 dependency rules, 71 companion links, 61 fixed parts, demo price list).

## Cloudflare deployment & releases

The app is **live in production** as a single Cloudflare Worker (Hono, in `worker/`) that serves the
API and the built client from one deployment, backed by D1. It imports the same rule engine
(`server/engine.js`) unchanged. Local run: `cd worker && npm install && npm run build --prefix ../client && npm run dev` (→ http://localhost:8787).

Canonical docs (single source of truth — this changelog does not repeat them):
- Environments, CI/CD, the `feature → develop → main` release flow, secrets, rollback: [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)
- Worker internals, auth model, the Zoho swap contract: [`worker/CLAUDE.md`](worker/CLAUDE.md) and [`worker/README.md`](worker/README.md)

## What's inside

| Area | Where | Notes |
|---|---|---|
| SQLite schema | `server/db.js` | metadata (families/segments/options/rules/links/parts), pricing, quotes, audit log |
| Rule engine | `server/engine.js` | implements dependency types D1–D7 from the spec: option filtering (single & multi-parent), derived facts, conditional defaults, cross-segment constraints, composition rules, companion resolution; ordering-code render + reverse parse (incl. joined positions like `0P`, `A5.0`) |
| Seed data | `server/seed/*.js` | full catalogue from datasheet Appendices A–C; shared option dictionaries; placeholder demo prices (INR) |
| API | `server/index.js` | catalogue, evaluate/parse-code, quotes & lines (server-side re-validation — invalid codes cannot be quoted), customers, admin CRUD, prices, dashboard, audit |
| UI | `client/src/pages/` | Catalogue, Configurator (progressive enablement, live code, price breakdown, companions, decode-a-code), Quotes (+ printable quotation), Parts & Spares, Dashboard, Admin (metadata + price editing, audit trail) |

## Verified against the datasheets

- `160-LD-0013-H10XP-A-0P-0-9-A5.0-G06-P-0-0` (LD duplex filter) — regenerates byte-for-byte and reverse-parses.
- `AS 35 P 360 C G 09 F 0 C C V / PO:10` (bladder accumulator) — regenerates byte-for-byte.
- `PST3-002-G02M-C-P-NO`, `PSBM-300-G02F-A-P-COD-A`, `TST1-060-G04M-B-T-NOD-A` — regenerate with correct derived facts.
- 22-check API sweep: size↔type filtering, port↔size filtering, ASWD 15-bar precharge limit, AMW capacity×pressure matrix, sealed-gas-side restriction, AP piston-ø cascades, FRD N/B↔bypass consistency, PRV series/set-pressure constraints, DK pressure↔size and bypass↔cracking defaults, TLF II size restriction, CRN/NB certification prerequisites.

## v1.1 changes (customer review feedback)

- **Prevent-not-reject configurator:** rules are evaluated against the *effective* configuration
  (including auto-applied defaults), so options invalid under a defaulted parent are disabled
  immediately; multi-select prerequisites (NB needs 7U, CRN needs 7U+NB) disable until met;
  changing a parent auto-resets stale child selections with a non-blocking "please choose again"
  notice instead of an error.
- **Admin product management:** create new families, specification segments, options and
  dependency rules from the Admin screen. New families start in **draft** (admin-only, not
  quotable); a publish gate blocks publishing until every required segment has options.
- **Archive workflow:** archiving asks for confirmation and first shows every quotation that
  references the product; archived products are hidden from sales and blocked for new quote
  lines but **never deleted** — historical quotations stay reproducible; unarchive any time.
  Option retirement also asks for confirmation (soft status, kept in DB).
- **Print format:** the printed quotation shows each line's complete specification table and
  companion products inline (collapsible sections are screen-only).
- **Quote-centric add-item drawer (FR-A7):** on a quotation, "➕ Add item" opens the catalogue
  in a wide right-side panel with Products and Parts & Spares tabs; configuring streams a live
  pending line (description, ordering code, price) into the quote table, committed on
  "Add to quote" (`client/src/components/AddItemDrawer.jsx`).
- **Guided rule builder (FR-A16):** admins add dependency rules through a fill-in-the-blank form
  (plain-language type names + help tips, segment/option dropdowns and chip-pickers, live
  plain-English preview) instead of hand-writing JSON; existing rules render in plain English with
  JSON on expand; an Advanced (JSON) toggle remains for power users (`client/src/pages/Admin.jsx`
  `RuleBuilder` + `describeRule`). **Existing rules are editable**: an ✎ action loads a rule back
  into the builder (decomposed to its dropdowns; non-representable shapes open prefilled in Advanced
  JSON) and Save updates it in place via `PATCH /api/admin/rules/:id`. The builder handles
  **multiple facts** (DERIVE) and **multiple exclusive pairs / prerequisites** (COMPOSE), so every
  such rule preloads into the guided form; a data-loss guard sends genuinely compound constraints
  (multi-key require/forbid, or numeric bound tied to a field) to the JSON editor instead of
  silently truncating. Round-trip verified lossless across all 367 catalogue rules.
- **Searchable metadata admin (FR-A17):** the Families & Specifications list has a search box
  (code / name / category / datasheet) and a status filter (All / Published / Draft / Archived)
  with a live match counter (`client/src/pages/Admin.jsx`).
- **Pricing & flags authoring (FR-A15):** the Admin option table sets per-option flags
  (std / on-request / PoA) on create and via toggles; a Base Prices card adds a Generic + per-value
  base prices; and any option takes an ₹/% adder — all create/edit/delete
  (`POST/PATCH/DELETE /api/admin/base-prices` & `/option-prices`). A new family is fully quotable
  once published, with pricing = most-specific base + adders (PoA options → line PoA).
- **Dashboard home + merged quotes + freshness + lifecycle (FR-A13):** the Dashboard is the landing
  page (Quotes tab removed); KPI widgets sit above the full quotes table with search (by
  ordering-code/item or customer), status filter, and sort. Each family carries `updated_at`
  (bumped on any admin metadata change) shown in the catalogue and configurator. Quote row actions:
  Clone (`/clone`), Archive (`/archive` soft-hide, `?archived=1` to list, `/unarchive`), and
  permanent Delete (`DELETE /api/quotes/:id`, confirmation dialog).
- **Reorderable line items (FR-A18):** each quote line has a ⠿ drag handle at the start of the row
  (left of the line number) — drag-and-drop to reorder; the dragged row is colour-highlighted (`row-dragging`) until dropped and the drop target
  is indicated (`row-dragover`). On drop it calls `POST /api/quotes/:id/reorder` (line_no
  renumbered); the new order shows on screen and in print. Disabled on finalized quotes (locked).
  Also fixed `nextQuoteNumber` to use max-sequence+1 (was COUNT+1, which collided after deletes /
  across revisions).
- **Audit trail & change history (FR-A19):** the quote page has a **History** tab rendering a
  timeline of every change (most recent first) — create, line add/edit/delete, reconfigure, reorder,
  date/discount/GST edits, status changes, archive/unarchive, clone. Each entry shows an action icon,
  a plain-English description, the acting user, and a timestamp. Every quote mutation stamps
  `updated_at`/`updated_by` (via `stampQuote`); `created_by` is set on create/clone. The printed doc
  header shows "Prepared by … · Last modified by …" (missing legacy values render as `—`). Backed by
  the `audit_log` table and `GET /api/quotes/:id/audit`; hard-deleting a quote purges its per-quote
  timeline while keeping a `quote-deleted` record in the global admin audit. Until user authentication
  exists, the "user" is the acting role (Sales / Product Admin) sent via the `X-Actor` header.
- **Linear status pipeline + nav fix (FR-A20):** the quote status is a Blueprint-style coloured
  stepper — `Draft → Sent → Won` as a connected chevron flow (current stage carries its tone,
  passed stages show ✓ and mute, upcoming stages mute) plus `Lost` / `Expired` outcome chips.
  Clicking a stage sets that status inline (`PATCH /api/quotes/:id`); the printed-doc status pill
  uses the same tone (`.pill.st-*`). Also fixed the quote page's back button, which pointed at a
  non-existent `#/quotes` route (blank screen) — it now returns to the Dashboard (`#/dashboard`),
  where quotes are listed.
- **Spare-parts administration + one-or-many family links (FR-A21):** Admin now has a **Spare Parts**
  tab (list / search / add / inline-edit / retire every spare) and a **"Spare parts for this family"
  card** inside each family editor (pre-linked to that family). A spare relates to a product family
  through a new `part_families` **many-to-many** junction — the add/edit form has a checkbox
  multi-select so a spare can belong to **one or several** related products. `parts.family_id` is kept
  as the primary (display) family, synced to `family_ids[0]` on every write. Endpoints:
  `GET/POST /api/admin/parts`, `PATCH /api/admin/parts/:id` (duplicate part numbers → `409`);
  `GET /api/parts` now returns a `family_ids` array. The quote drawer's related-spares filter matches
  on **any** associated family (`family_ids.some(...)`), so a spare surfaces whenever any of its
  products is quoted — not just its primary. Existing single-family parts are auto-migrated into the
  junction on startup.
- **Tabbed product editor + floating rule builder (FR-A22):** opening a product in Admin no longer
  shows one long scroll — the editor now has sub-tabs **Segments & Options / Pricing / Spare Parts /
  Rules (n)**. The Rules tab docks the guided **"Add a rule"** builder in a **sticky panel at the top**
  (`.rule-add-dock`, `position: sticky`) that stays in view while the rules list scrolls; it's a
  compact button by default and unfolds on click. Editing a rule (✎) jumps to the Rules tab and opens
  that same dock preloaded in edit mode (amber); Cancel collapses it. Pure client-side restructure of
  `FamilyEditor` — no API or data changes.
- **Collapsible segments + record counts (FR-A23):** on the Segments & Options tab each segment is now
  an **accordion** (`.seg.accordion`) — a clickable header (rotating caret) that expands/collapses its
  options table; **collapsed by default** with **Expand all / Collapse all**. Counts are surfaced
  everywhere: the tab reads **Segments & Options (n)**, a **Specification segments (n) · m options
  across all positions** header sits above the list, and each accordion header carries a
  **`n options`** badge (plus a retired count when any). Keeps big products (e.g. 18 segments / 115
  options) scannable without a long scroll. Client-only.
- **Record counts on all editor tabs + Base Price variants rename (FR-A24):** every product-editor tab
  now shows its record count (**0 when empty**) — **Segments & Options (n)**, **Base Price variants (n)**,
  **Spare Parts (n)**, **Rules (n)**. The **Pricing** tab is renamed **Base Price variants** (count =
  `prices.base.length`; each generic/per-value base row is a variant). The **Spare Parts** count comes
  from a new `spare_count` field on `GET /api/families/:id/meta` (`COUNT(*)` over `part_families` for
  the family) and **updates live** — the scoped `SparePartsManager` fires an `onChanged` callback that
  re-fetches the family meta after any add/edit/unlink.
- **Product category administration (FR-A25):** categories are no longer fixed seed data — **Product
  Categories** is now the **first top-level Admin tab** (`CategoriesManager`), listing each category
  with code / name / sort / family-count and supporting **add, rename, reorder, delete**. New endpoints
  `GET/POST /api/admin/categories`, `PATCH/DELETE /api/admin/categories/:id`: create/rename reject
  duplicate codes (`409`); **delete is blocked while any family uses the category** (`409` with the
  count) so nothing is orphaned. New categories are immediately selectable in the New-family form; the
  admin now loads categories from `/api/admin/categories` (with counts) instead of `/api/catalog`.
- **Top-level admin tab counts (FR-A26):** the three top tabs now show record counts —
  **Families & Specifications (n)** (`families.length`), **Spare Parts (n)**, **Audit Trail (n)** —
  fed by a new `GET /api/admin/summary` (`{families, spares, audit}` COUNTs). Refreshed on mount, on
  tab switch, and after spare add/edit (global `SparePartsManager` `onChanged`). Complements the
  per-product editor-tab counts (FR-A24).
- **Data-safety architecture (FR-A28):** existing data is never lost across updates. `server/db.js`
  now runs a **versioned, additive-only migration framework**: a `_migrations` table records each
  named migration (runs once), migrations only **ADD** columns/tables/indexes, and the one unavoidable
  table rebuild (`quotes` composite-unique) is column-parity-checked — it asserts every existing column
  and the row count are preserved before dropping the old table (this fixes the historical bug where a
  rebuild silently dropped `archived`/`created_by`/`updated_by`). **Automatic backups**: a snapshot is
  taken before any migration and once per day on startup (`server/backups/`, retention 40, WAL
  checkpointed for consistency). Admin endpoints `GET/POST /api/admin/backups` and `GET /api/admin/export`
  (download the whole DB — no lock-in). Proven by `node server/test-migrations.mjs` — a real-DB
  round-trip test and a synthetic legacy-schema test that assert every row/column survives.
- **Server integrity hardening (FR-A29):** finalized quotes are now **locked server-side** — line
  add/edit/reconfigure/delete/reorder and commercial-field edits return `409` on any non-Draft quote,
  while status changes and archive/unarchive stay allowed (field-aware guard `requireDraftQuote`).
  Revising derives the next letter from `MAX(revision)` (double-revise no longer 500s); a global Express
  error middleware maps SQLite constraint errors to `409`/`400`; clone/revise + line ops are
  transactional; qty/discount/status are validated. Engine: DEFAULT rules apply most-specific-last
  (deterministic), rule matching is string-normalized, and documented `min/maxFrom(Selection)` bounds
  are implemented. Sweep stays green (37,045 checks, 0 failures).
- **Client robustness (FR-A29):** a global **toast** layer (`src/toast.js`) surfaces every API failure
  (no more silent/invisible failures); line & header commercial fields commit **on blur/Enter** via
  `CommitInput` (no per-keystroke PATCH storms) with a reload sequence-guard; a **NotFound** route +
  NaN/`decodeURIComponent` guards replace blank screens; delete-line and un-finalize now confirm;
  modals are Escape-closable with dialog semantics; render-time `JSON.parse` is guarded; empty-search
  states added. Line reordering is now **keyboard-accessible** (focus the ⠿ handle, ↑/↓ to move) with a
  visible focus ring and the drop-highlight clears on drag-leave; the add-item drawer's search resets
  when switching the Products / Parts sub-tabs.
- **Attachments & manager approval (FR-A30):** a new **Attachments** tab on the quote page lets any
  user upload any file type to a quote (a small executable/script denylist is rejected), preview
  PDF/image attachments inline, download any attachment, and remove one (soft-removed, never hard
  deleted). The same tab shows the quote's **approval status** (Pending/Approved/Rejected + note),
  settable only by the `admin` role. New `attachments` table + four `approval_*` columns on `quotes`
  (additive migration — `quote-app/worker/migrations/001-attachments.sql`); files live in a
  Cloudflare R2 bucket in production/staging/sandbox, a local `server/uploads/` directory in Express
  dev. New routes mirrored in both runtimes: `GET/POST /api/quotes/:id/attachments`,
  `GET/DELETE /api/attachments/:id`, `PATCH /api/quotes/:id/approval`. Every action audits via the
  existing `audit_log`.
- **Choose target quote from Parts & Spares (FR-A27):** the per-part button is now **Add to Quote**
  (was "Add to draft quote", which silently used the first draft). It opens a **quote-picker modal**
  (`.modal-overlay`) listing open **Draft** quotes — number/rev, customer, line count, date — plus a
  **＋ New quote** option; choosing one posts the part line to that quote and navigates to it. Only
  Draft (editable) quotes are offered. Client-only (`client/src/pages/Parts.jsx`).
- **Line-level add, dates & version control (FR-A12):** "+ Add item" is a row at the bottom of the
  line-items table; quote date + validity are editable (printed doc shows Date/Validity/Valid-until);
  editing a finalized (Sent/Won/Lost) quote is guarded by a modal offering "save as new revision"
  (same number, next letter) or "create a new quote" (new number) via `POST /api/quotes/:id/revise`
  and `/clone`. Schema fix: `quotes` is now unique on `(number, revision)` so revisions share a number.
- **Mandatory-section awareness (FR-A11):** unselected required positions get an amber
  "needs selection" highlight + Required badge (distinct from red rule-violation styling), plus a
  "Still needed:" chip bar above the Add/Save button that scrolls to each outstanding section;
  the engine returns a `missingRequired` flag per segment (`server/engine.js`).
- **Copy ordering codes (FR-A10):** a one-click copy control (`client/src/components/CopyCode.jsx`)
  sits next to every ordering code / part number — quote lines, live & editing rows, the
  configurator code box (page + drawer), companion codes, and the Parts lists; hidden in print.
- **Popularity-ranked drawer (FR-A14):** the drawer orders product families (per category + in
  search) and spare parts by a **time-decayed frequency** score (`GET /api/popularity`) — each past
  quote line weighted 2^(−ageDays/30) and summed per item, so frequent+recent items rank first and
  never-quoted ones fall to the end; a ★N badge shows the quoted count. Archived quotes are excluded.
- **Drawer navigation & related spares (FR-A9):** the Products tab organizes families under
  category sub-tabs (search spans the whole catalogue); Parts & Spares defaults to all parts on
  an empty quote, switches to spares related to the quoted product families as products are
  added, with a "Show all parts" toggle (related parts stay flagged in the full list).
- **Edit lines in place (FR-A8):** ✎ on a configured line reopens the drawer pre-loaded with
  the line's stored configuration; the row shows the live "editing…" state and "Save changes"
  updates the same line via `PATCH /api/lines/:id/reconfigure` (server re-validates and
  regenerates code, spec snapshot, companions and price; line number preserved).
- **Verification:** `node server/sweep.js` runs the full-catalogue sweep (36 families,
  ~37,000 checks: default-state validity, every enabled option selectable alone and pairwise
  with every parent option, full sequential configuration valid + priced).
  `node server/seed/migrate.js` applies rule/template patches to a live DB without touching quotes.

## Known demo limitations (per agreed scope)

- Prices are **placeholders** — replace via Admin screen or a bulk import (structure in `seed/pricing.js`).
- No authentication; the role switcher only gates UI (production needs real auth per FR-5).
- Metadata edits are live immediately; the spec's draft → validate → publish workflow (FR-4.4) is future work.
- Options marked "on request" set the line's availability flag to *to confirm* per the catalogue-wide footnote.
