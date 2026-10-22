# EPE Quote Builder — Testing Framework & Guidelines

How to test this application: layers, commands, conventions, and per-area checklists.
Read this before claiming any change is "done". The companion context file is `../CLAUDE.md`.

**Prime directive:** this app quotes certified pressure vessels and filters. A wrong ordering code,
a wrong price, or a silently mutated finalized quotation is a *commercial/compliance* defect, not a
cosmetic one. Test accordingly: correctness of codes/prices/locks first, pixels second.

---

## 1. The test pyramid for this app

| Layer | What it proves | Tool / command | When to run |
|-------|----------------|----------------|-------------|
| L0 Build | Client compiles, no syntax errors | `npm run build --prefix client` | every client change |
| L1 Engine | Rule semantics D1–D7, code render/parse, pricing | node scripts against `engine.js` (see §3) | engine changes |
| L2 API functional | Endpoints, guards, status codes, audit | throwaway node scripts vs `localhost:4780` (see §4) | server changes |
| L3 Catalogue sweep | Every published family valid end-to-end | `node server/sweep.js` → **36 families, 37,045 checks, 0 failures** | engine/seed/rule changes — ALWAYS |
| L4 Data safety | No data loss across schema changes | `node server/test-migrations.mjs` → **6 passed, 0 failed** | any `db.js`/schema change |
| L5 Browser E2E | Real user flows in the running UI | Claude Code preview browser (see §5) | every user-visible change |
| L6 UI/UX & a11y review | States, feedback, keyboard, print | checklist review (see §6) | new/changed screens |

The sweep (L3) is the **regression gate of record** — it must be green before any change is declared
done. It is cheap (~seconds); run it liberally.

---

## 2. Non-negotiable conventions

1. **Self-cleaning test data.** Every test that creates quotes/parts/families/categories must delete
   them at the end (use the API; for stubborn residue use direct better-sqlite3 deletes). After a test
   session, verify the baseline: **22 quotes · 39 families · 61 parts · 5 categories · 61 spares**.
   (If the legitimate business data grows, update this line and §2 of CLAUDE.md.)
2. **Test against the live server, not mocks.** The app is API-first and better-sqlite3 is
   synchronous — there is no mocking layer and none is wanted. Spin the real server, hit real
   endpoints, read the real DB.
3. **Server restarts are manual.** `node index.js` has no watcher. After editing `server/**`,
   `pkill -f "node server/index.js"` and relaunch before testing, or you are testing stale code.
4. **Never trust a claim you didn't verify.** If a review (human or agent) reports a bug, reproduce
   it against the running server before fixing; if it reports "works", spot-check it. We have caught
   both false positives and false negatives this way.
5. **Golden codes.** The sweep validates structure but does **not** diff exact ordering codes. After
   any engine change, spot-check known-good codes:
   - LD default → `160-LD-0013-H10XP-A-0P-0-9-0-_-P-0-0`
   - AS default → `AS 35 P 360 C G 09 F 0 C C V`
   - LD complete w/ G06 → `160-LD-0013-H10XP-A-0P-0-9-0-G06-P-0-0` (prices ₹49,100, 2 breakdown rows)
   If a code changes *intentionally* (datasheet revision), update this list in the same commit.
6. **Actor discipline.** Every API test sends `X-Actor` (`sales` or `admin`) — audit assertions
   depend on it. Express strict-JSON rejects non-JSON bodies: only set a body when there is one
   (a past test bug produced a phantom 400 this way).

---

## 3. L1 — Engine tests (rule semantics)

Import `evaluate/renderCode/parseCode/priceConfiguration` from `server/engine.js` directly (or go
through `POST /api/families/:id/evaluate`). Each dependency type has a canonical scenario — cover the
relevant ones whenever the engine or a family's rules change:

| Rule | Canonical test |
|------|----------------|
| D1/D2 FILTER | An out-of-set option is returned `enabled:false` (disabled, **never hidden**, never an error) — including under *defaulted* parents |
| D3 DERIVE | Facts appear for the matching condition (LD shows Test pressure / Temperature range / Rated flow) |
| D4 DEFAULT | LD pressure 160→40 flips bypass default 9→7; an **explicitly chosen** child value survives parent changes; most-specific rule wins regardless of rule id order |
| D5 CONSTRAINT | require/forbid trigger violations with the datasheet message; numeric bounds incl. `maxFromSelection` (set pressure ≤ rating) |
| D6 COMPOSE | Mutually-exclusive pair blocks; prerequisite chain (CRN ⇒ 7U + NB — this encodes *regulatory certification* rules, treat as high-severity) |
| D7 companions | Complete valid config resolves companions (LD → element code + seal kit + BYP part) |
| FR-A2 reset | Changing a parent that invalidates a chosen child **resets** the child and emits a warning — config can never sit invalid |
| parseCode | Round-trip: default code → parse → re-evaluate → identical code; garbage code → non-empty `issues[]` |
| Pricing | Most-specific base match beats generic; pct adders compute on base; unmapped/PoA-flag ⇒ `poa:true`, never ₹0 |

**Domain-critical scenarios** (from the vertical — always keep covered): certification prerequisite
chains (D6), conditional defaults on pressure class (D4), PoA propagation (a special/SP option must
flag the line, never price silently at zero), and the on-request → `availability:'to_confirm'` flag.

---

## 4. L2 — API functional tests

Pattern: a throwaway `node --input-type=module` script with a tiny `j(method,url,body,actor)` helper,
assertions printed as ✅/❌ with a final `N passed, M failed`. Keep scripts self-cleaning (§2.1).

**Coverage checklist for quote endpoints** (all currently pass — keep them passing):
- Create → `Draft`, number `Q-YYYY-NNNN` (max-sequence+1, delete-safe), `created_by` stamped.
- Add config line: server re-evaluates; incomplete/invalid → `400 + violations`; archived/draft
  family → `400`. Add part line, qty clamped ≥ 1.
- **Finalized-quote lock (BUG-1 regression, high value):** on any non-Draft quote, add/edit/delete/
  reconfigure line, reorder, and content-field PATCH all → **`409`**; status transitions and
  archive/unarchive still → `200`. Test *every* mutation route — the original bug was exactly a
  missed route.
- Revise: → same number Rev B; **revise the same source twice** → Rev C, never 500 (BUG-2 regression);
  clone → new number Rev A. Both copy all lines (transactional).
- Constraint mapping (BUG-3 regression): bad FK → `400`; duplicate option/category/family/part
  code → `409`; invalid status string → `400`; never a raw 500 for user input.
- Audit: every mutation appends (`create/add-line/edit-line/delete-line/reconfigure-line/reorder/
  status/update/archive/…`), newest-first in `/api/quotes/:id/audit`; hard-delete purges the
  per-quote trail but leaves a `quote-deleted` record.
- Admin CRUD: publish gate blocks empty families; archive shows usage; category delete blocked while
  in use; spare M:N links sync `family_id` = first of `family_ids`.

---

## 5. L5 — Browser E2E (preview tools)

Use the Claude Code browser pane against `http://localhost:5178` (launch configs
`epe-quote-server` / `epe-quote-client`). Verify **through the UI**, then confirm **through the API**
that the server state actually changed — a screenshot alone is not verification.

Hard-won automation pitfalls (do not rediscover these):
- **React blur:** synthetic `el.blur()` / `new Event('blur')` do NOT trigger React `onBlur`.
  Dispatch `new FocusEvent('focusout', {bubbles:true})` — that is what React 18 delegates on.
  This matters for every `CommitInput` (qty, discount, GST, validity).
- **Controlled inputs:** set values via the native setter
  (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set`) then dispatch
  `input` — plain `.value=` does not update React state.
- **Stale modules:** after client edits, run `location.reload()` in the tab (Vite HMR usually works,
  but a hard reload removes doubt). After server edits, **restart the node process** first.
- Allow ~300–900 ms `setTimeout` between action and assertion — fetch + re-render is async.
- Multi-step flows: return one JSON blob of all observations from a single `javascript_exec` rather
  than many screenshots; screenshot only for visual/layout claims.

**Flow suite to re-run after significant UI changes** (each verified working today):
configurator disable-not-error + amber "Still needed" chips → drawer add-item with live pending line →
edit-line preload → drag AND keyboard (↑/↓ on ⠿ handle) reorder → status pipeline
Draft→Sent (lock notice appears, revision modal on edit attempt, confirm on un-finalize) →
History tab timeline → Parts "Add to Quote" picker → Admin: accordion counts, rule-builder preload
round-trip, category/spare CRUD → toast appears on a forced API error → `#/quote/abc` shows NotFound.

---

## 6. L6 — UI/UX & accessibility guidelines

House interaction principles (these are product decisions — regressions are bugs):
1. **Prevent, don't reject** (FR-A1): anything invalid is disabled *before* click, with a tooltip
   reason. A user must never see an "invalid configuration" error for something the screen offered.
2. **Amber ≠ red**: "not filled in yet" is amber (needs-selection); *violations* are red. Never
   conflate them.
3. **No silent failures**: every API error surfaces via the global toast (`api.js` auto-toasts; pass
   `{quiet:true}` only when a form shows its own inline error — never both, never neither).
4. **Commit on blur**: commercial numeric fields use `CommitInput`. Never reintroduce
   per-keystroke PATCH.
5. **Destructive = confirm**: delete quote, delete line, retire option, archive family (with usage
   list), un-finalize (Draft click on a finalized quote), category delete. Archive is the default
   posture; hard-delete is the exception and says so.
6. **Every list has an empty state** ("No parts match…", "No rules yet") and every async view a
   loading state that cannot hang silently (toast + retry on failure).
7. **Keyboard & a11y**: interactive icons get `aria-label`; drag handles are focusable with arrow-key
   alternatives; modals have `role="dialog" aria-modal`, close on Escape and overlay click; visible
   `:focus-visible` rings; `prefers-reduced-motion` respected.
8. **Counts tell the truth**: every tab/badge count reflects live data (0 when empty) and refreshes
   after the mutation that changes it.
9. **Print is a first-class view**: the printed quotation must show full spec tables + companions
   inline, hide all controls (`no-print`), show the coloured status pill and Prepared-by line.
   Verify via print preview after touching `QuoteDetail` or `styles.css` print rules.
10. **Datasheet vocabulary**: labels use the datasheet's own terms (segment names, option meanings),
    codes always accompanied by their meaning. Every displayed code/part number gets a `CopyCode`.

Review method for a new/changed screen: walk it in this order — *empty state → loading → happy path →
error path (kill the server) → keyboard only → print (if applicable)* — then run the L5 flow suite.

---

## 7. Definition of done (gate for every change)

- [ ] `node server/sweep.js` → 0 failures  (always)
- [ ] `node server/test-migrations.mjs` → 6 passed  (if schema touched)
- [ ] `npm run build --prefix client` clean  (if client touched)
- [ ] L2 script for changed endpoints incl. the three regression families (lock/revise/constraint-mapping)
- [ ] L5 browser verification of the changed flow + API-level confirmation of state
- [ ] Golden codes spot-checked  (if engine touched)
- [ ] DB back at baseline; no test residue
- [ ] PRD (next `FR-A#`) + `README.md` updated; TESTING.md updated if conventions/golden values changed

## 8. Future hardening (recommended, not yet in place)

- **Vitest** for L1: turn §3's canonical scenarios into a committed unit suite (`server/engine.test.js`)
  instead of throwaway scripts.
- **Playwright** for L5: script the §5 flow suite for CI once the app is hosted; the preview-browser
  method remains the interactive tool.
- **Golden-code corpus**: extend sweep.js with an expected-code table per family (datasheet examples)
  so code regressions fail automatically rather than via manual spot-checks.
- **CI order**: build → engine tests → seed a scratch DB (`EPE_DB=…`) → API suite → sweep →
  migration test → Playwright.
