# Sandbox Feature Roadmap — Attachments, Customer History, Clarifications/TAT

> Status: **PLANNED, NOT YET BUILT.** This document records three features discussed and designed
> in the personal sandbox (`epe-quote-sandbox`, a separate Cloudflare account/D1/fork from
> production) ahead of implementation. No application code, schema, or UI has been changed for any
> of them as of this writing — each is implemented only on separate, explicit go-ahead. This file
> is the committed record of what was discussed and agreed, so the decisions aren't lost between
> sessions.

**Decisions locked in across all three:**
- Build and test entirely in the personal sandbox environment first (own Cloudflare account, own
  D1, own R2) — production (`epe-quote`) and staging (`epe-quote-staging`) are untouched by this
  work until each feature is separately promoted.
- Every feature mirrors routes across both runtimes (Worker/D1 prod-shape + local Express dev),
  per this repo's existing convention (`CLAUDE.md` "mirror every route in both runtimes").
- Every mutating action audits via the existing `audit_log` table/helper, and anything removable is
  **soft-removed** (an `archived` flag), never hard-deleted — consistent with this app's existing
  archive-never-delete / full-audit-trail rules.
- Each feature gets a PRD `FR-A#` entry + `quote-app/README.md` changelog line once built, following
  this repo's existing documentation convention (numbering assigned at build time, in build order).

---

## 1. Attachments + Manager Approval

**Problem:** Technical workings, Excel costing sheets, and scanned documents produced while
working an enquiry have nowhere to live today, and there's no way for a manager to review/approve
a quote's supporting material.

**Design:**
- New `attachments` table (file metadata: name, mime type, size, storage key, category, uploader,
  timestamp, soft-remove flag) — actual file bytes live in a new Cloudflare R2 bucket
  (`epe-quote-attachments-sandbox` in the sandbox; production/staging buckets are a later, separate
  step).
- Four new columns on `quotes`: `approval_status` (`pending|approved|rejected`, defaulting to
  `pending` from creation), `approved_by`, `approved_at`, `approval_notes`.
- **Any file type** can be uploaded (no business-side extension restriction), minus a small
  executable/script denylist (`.exe`, `.js`, `.bat`, `.sh`, etc.) for security, and never served
  inline for `text/html`/`image/svg+xml` (stored-XSS risk) regardless of that denylist.
- **Any user with quote access can upload and remove** attachments (confirmed symmetric — no
  "uploader/admin only" restriction).
- **Everyone can preview** PDF/image attachments inline and **download** any attachment type.
- **Approval is admin-only** (reuses the existing `admin` role — no new "manager" role).
- New "Attachments" tab on the quote page combining the file list/upload UI with the
  approve/reject control.

**Status:** Fully designed and approved via plan review. R2 bucket + D1 schema work for the sandbox
had begun (a `wrangler.jsonc` binding edit is sitting uncommitted in the working tree) before
attention moved to the next two features — implementation resumes from that approved design when
instructed.

---

## 2. Customer Quote History / Comparison

**Problem:** When a customer has been quoted more than once, there's no way to see how the same
product was priced for them previously without manually opening each old quote.

**Design:**
- New **"Customer History" tab** on the quote page, shown whenever the quote has a customer
  selected.
- Lists that customer's other quotations (number/revision, date, status, total), most recent
  first; each expands to show its line items.
- Every line shown there displays its **date quoted, unit price, and discount %** — the core
  requirement (full price/discount/date history per item, not just totals) — using data that
  already exists on `quotes`/`quote_lines`, nothing new to store.
- Any line whose ordering code exactly matches a line on the quote currently being viewed is
  flagged with a badge and a higher/lower/same delta note.
- Backend change is a single additive query-parameter filter on the existing `GET /api/quotes`
  route (`?customer_id=`) in both runtimes — no schema change.

**Status:** Fully designed; user confirmed the design matches intent. Awaiting final go-ahead to
build.

---

## 3. Post-offer Clarifications + TAT Tracking

**Problem:** After a quote is sent, customers come back with technical/commercial questions that
today aren't logged anywhere, and there's no visibility into how quickly they're answered.

**Design:**
- New `clarifications` table, one-to-many with `quotes`: category (fixed `'Clarification'` for
  now), `query_type` (`technical|commercial`), question text, `raised_at`/`raised_by`, `status`
  (`open|answered`), `response`, `responded_at`/`responded_by`, soft-remove flag.
- **Turnaround time (TAT) is never stored** — always computed as `responded_at − raised_at` at
  read time, so it can't drift from its two source timestamps.
- **Any signed-in user can both log and respond** to a clarification (confirmed, no role split).
- **Every entry prominently shows who raised it and who responded** — `raised_by`/`responded_by`
  are real, server-derived usernames (never free text), shown next to the question/response —
  explicitly confirmed as a requirement.
- New "Clarifications" tab on the quote page: log-a-query form, list of entries with status pill,
  question, raiser/date, and (once answered) the response, responder/date, and computed TAT.
- Lightweight TAT analysis to start: two new numbers on the existing Dashboard (open clarification
  count, average response time) rather than a full filterable reporting page — the bigger reporting
  build is a likely phase 2, only if the simple tiles don't answer the real question.
- Logging a clarification is restricted to **non-Draft** quotes (post-offer only), matching the
  feature's name/intent.

**Status:** Fully designed and confirmed. Awaiting final go-ahead to build.

---

## Open items still to settle before build (feature 3 only)

- TAT unit: plain elapsed time (hours/days) vs. business-day-aware (excludes weekends/holidays) —
  defaulting to plain elapsed time unless told otherwise.
- Reporting depth: two Dashboard tiles now vs. a full filterable report page now — defaulting to
  the two tiles, with a fuller report treated as a later phase.
