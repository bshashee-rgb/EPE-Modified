# EPE Quote Generation Application — Requirements Specification

**Prepared from:** Detailed study of 60+ product datasheets in `EPE/` (Filters, Accumulators, Switches, Valves)
**Manufacturer/Customer:** EPE Process Filters & Accumulators Pvt. Ltd., Hyderabad (hydraulic filtration, accumulators, switches, valves)
**Date:** 22 July 2026
**Companion documents:** Appendix A (Filters), Appendix B (Accumulators), Appendix C (Switches & Valves) — full per-product specification hierarchies extracted from the datasheets.

---

## 1. Executive Summary

EPE sells configurable industrial products. A "product" (e.g. a bladder accumulator or a duplex filter) is never quoted as a simple SKU — it is quoted as an **ordering code**: a positional string of 6–18 specification segments, where each segment has an enumerated set of coded options and the valid options of one segment depend on the values chosen in earlier ("parent") segments.

Examples from the datasheets:

- Filter `160-LD-0013-H10XP-A-0P-0-9-A5.0-G06-P-0-0/` — 13 positions (pressure, type, size, media, ΔP class, adhesive+hardware, magnet, bypass, indicator+cracking pressure, connection, seal, housing material, other options).
- Accumulator `AS 35 P 360 C G 09 F 0 C C V / PO:10` — 14 positions.
- Piston accumulator `AP-35-375-180-C-2-PPU-P-0-0-0-FV-0-G07F-0 / PO:10` — 18 positions.
- Pressure switch `PST3-002-G02M-C-P-NO` — 6 positions.

The application to be built is therefore a **CPQ (Configure-Price-Quote) system** with three pillars:

1. **A guided product configurator** that walks a salesperson from product family → specification choices, enabling/disabling child options based on parent selections, and emits a valid ordering code.
2. **A pricing engine** that maps configurations to prices (base price + option adders + rule-based pricing), producing quote line prices.
3. **A metadata management module** through which EPE's product/admin team maintains product families, specification segments, option lists, dependency rules and prices — so the sales team always configures against the latest specs without a software release.

---

## 2. Study Findings — How EPE Specifications Actually Relate

### 2.1 Catalogue inventory

| Category | Configurable product families | Companion/accessory products |
|---|---|---|
| **Filters** (17 datasheets) | 40/160-LD/LDN duplex; 250/450-LD/LDN HP duplex; 250/450-FE/FEN manifold; 250/450-LE/LEN HP inline; 40/160-LE/LEN inline; 160-OFM20X heavy duty; 16-FR/L(N) return line; 10-FRE / 10-FRD return line (simplex/duplex); 40-FLE/FLEN inline; 25-FLD/FLDN large duplex; 16/40/45/60-DK large duplex; TLF I/II/III breathers; NFF2 offline carts (fixed BOM systems) | Filter elements (1./2./3./7. Series — their own 8-position ordering code), seal kits (`D-…`), maintenance indicators (F-xx/FD-xx/R-xx/Hxx/M010/M040/Pxx), bypass valves (BYP01–07…), vent/drain valves & plugs |
| **Accumulators** (19 distinct docs) | AS/ASHF/ASWP/ASWD/ASLV/ASLVHF/ASL/AST bladder (14 pos.); AMW diaphragm (11 pos.); AP piston (18 pos.); APC compact piston (18 pos.) | Bladder assemblies, gas bottles BA/BB/BD, Safety Block B (10 pos.), Charging Block BC, charging kits PC/PC-HP/PCM, N₂ cylinder adaptors T1–T13, ES limit-switch device, clamps/brackets/support rings, band clamp CB2, piston seal kits PSK, U-clamps |
| **Switches** (11 products) | PST2, PST3, PSTM, PSTY threaded pressure switches; PSB1/PSB2/PSB3 block switches; PSBM block switch with gauge; TST1/TST2 temperature switches (all 6 pos.) | — |
| **Valves** (1 product) | PRVS/PRVK direct-acting pressure relief valve (8 pos.) | — |

Data-quality findings that the application must be robust to (and that argue strongly for the metadata module):

- The `Valves/` folder contains only duplicates of one Switches file.
- Two files are **mislabeled**: "PST1Rev.pdf" actually contains the PRV relief-valve datasheet (no PST1 switch datasheet exists in the set); "PSVMRev.pdf" actually contains the PSBM switch.
- Several products exist in **two datasheet generations** with slightly different option sets (e.g. bladder-accumulator ANSI port codes changed from a numeric legacy scheme 81–98 to a two-character size+class scheme; AMW capacity 4 L exists only in the older annexure). Option metadata therefore needs versioning and effective dates.

### 2.2 Anatomy of an ordering code

Every configurable product follows the same grammar:

```
<ProductCode> = <Segment1>-<Segment2>-…-<SegmentN> [ / dynamic suffixes ]
```

- Each **segment** is a named specification (e.g. "Nominal size", "Seal material") with a defined **position** in the code.
- Each segment has an **option list**: `code → commercial meaning` (e.g. `V = Viton`, `G06 = 1" BSP(F)`).
- Most segments have a **standard/default option** (marked "standard" in datasheets).
- Some segments are **free-value within bounds** rather than enumerated: set pressure (must lie within the chosen rating range), precharge pressure `PO:xx`, stroke length, cable length, oil filling `O:yy ml`.
- Some segments are **multi-select** (Filters position 13 "Other options"; DK indicator position 9a explicitly allows multiple options; AS position 14 allows several variant codes together; certifications combine with "+", e.g. `7U+D`).
- Codes may end with a **free-text suffix** for special requirements (`SP`, `SP-xxx`, `Sxxx/Txxx` EPE design numbers, trailing `/__`).

### 2.3 Taxonomy of parent→child dependencies found in the datasheets

The study found **seven distinct dependency mechanisms**. The configurator's rule engine must support all of them:

| # | Dependency type | Definition | Examples from datasheets |
|---|---|---|---|
| D1 | **Option filtering (single parent)** | The allowed value list of segment B is a subset determined by the value of segment A | Filter size list depends on filter type (LD sizes 0003–0045 vs LDN sizes 0040–0400); port/connection codes depend on nominal size (every filter housing); AP capacity range depends on piston ø; AMW capacities depend on chosen MWP; DK sizes depend on pressure class (60 bar → only 0020–0045); TLF size 7-125 not available for TLF II; BC connections G07F/G08F only for BC32 |
| D2 | **Option filtering (multi-parent)** | Allowed values of B depend on the combination of two or more parents | AS max-working-pressure options depend on (series × capacity): AS 0.2 → 330 bar, AS 1–57 → 360 bar, ASWD 10–57 → 30 bar; bladder gas-valve type availability is a matrix of (valve type × capacity × design S/SL/ST) |
| D3 | **Derived/auto-set values** | Choosing A fixes B (no user choice) | Switch range → sensing element type, max system pressure, hysteresis table; PSBM range → paired manometer scale; PRV rating 025–400 → poppet design, 630 → ball design; TST set temperature → high/low contact values; NFF2 system model → entire fixed BOM |
| D4 | **Conditional defaults** | The *standard* value of B (not its option list) changes with A | Bypass default is 3.5 bar on 40-bar filters but 7.0 bar on 160-bar filters; indicator cracking-pressure default 2.5 vs 5.0 bar by pressure class (LD/LE), by chosen bypass (DK: 3.5 bar bypass → 2.5, 7.0 → 5.0), or by indicator family (OFM20X: pressure-switch family → 2.5, DP family → 5.0) |
| D5 | **Cross-segment consistency constraints** | Two segments must agree | FRD/FRE size suffix N/B must match the bypass position (…N ↔ bypass 0; …B ↔ bypass 7); PRV option S (factory sealed) only valid for series PRVS; sealed valve requires a stated set pressure; set-pressure value must lie inside the chosen rating range; ASWD requires precharge ≤ 15 bar |
| D6 | **Composition rules** | Multi-select values combine under rules | Certifications join with "+" and have prerequisites: NB registration requires ASME U-stamp (7U); CRN requires 7U **and** NB; CE applies only to vessels > 1 L (PED Art. 3 exemption below 1 L); filter "other options" allow several codes simultaneously but some are mutually exclusive (EP plugged port vs E vent valve) |
| D7 | **Cross-product compatibility** | A configured product determines which *companion products* fit | Safety Block accumulator-side nipple is explicitly mapped to accumulator family and size (G09M → AS10-55; L08M → AP ø180–520); AMW gas-valve style M → charging kit PCM, style V → kit PC + adaptor; clamp part numbers map to accumulator diameter (CT0400 → AS 10–57 / AP ø180); filter → its element code (positions copied over), seal-kit code, indicator part number (F-5.0-GW-02-00-P style), bypass spare part by size band; breather housing size → element size (1-25/2-32 → 002) |

### 2.4 Reusable option dictionaries

Many option sets repeat across families and should be modelled once and referenced (not copy-pasted per product):

- **Filtration media & grade** (Reference A in Appendix A) — one list shared by ~10 filter families and the elements catalogue.
- **Seal materials** (P/V/E/N/B/K/F/T…) — shared across all categories, with per-product subsets (DK allows only P/V/E; PSTY allows only P).
- **Connection/port codes** (G../T../N../S../M../DN../ANSI-class codes) — shared vocabulary with per-product, per-size subsets.
- **Body/shell materials** (C/B/A/X/N/L/Z…), **indicator families**, **certification codes** (0/8/30/7W/7U/1/3/NB/CRN/NR/D/DNV/ABS).

This drives a core design decision: **global option dictionaries + per-product allowed subsets**, so a rename or addition propagates consistently.

### 2.5 Three linked codes per filter product

Every filter housing sale implies up to three generated codes, built from overlapping position subsets:

1. **Filter assembly code** (all 13 positions),
2. **Replacement element code** (`1./2./3./7. Series` + size + media + ΔP + adhesive/hardware + bypass + seal),
3. **Seal kit code** (`D-` + pressure + type + size + indicator + connection + seal).

The configurator must generate all applicable codes from one configuration session so the salesperson can quote spares alongside the main product.

---

## 3. Conceptual Data Model

```
ProductCategory (Filters, Accumulators, Switches, Valves, Accessories, Systems)
 └─ ProductFamily (e.g. "40/160-LD/LDN Duplex Filter", "AS Bladder Accumulator")
     ├─ attributes: name, description, datasheet ref/revision, image, status (draft/published/retired)
     ├─ CodeTemplate (ordered segments + separators + suffix rules → renders ordering code)
     └─ SpecSegment (position, name, description, UI order, selection type)
         ├─ selectionType: single-select | multi-select | numeric-in-range | free-text
         ├─ required / optional, default option (static or rule-driven)
         └─ SegmentOption (code, label, description, std flag, status, effective dates)
                └─ may REFERENCE a GlobalOptionDictionary entry (media, seals, ports, certs…)

DependencyRule (scoped to ProductFamily; evaluated by the rule engine)
 ├─ type: FILTER (D1/D2) | DERIVE (D3) | DEFAULT (D4) | CONSTRAINT (D5) | COMPOSE (D6)
 ├─ condition: expression over segment values (supports multi-parent conditions)
 └─ action: allow-list / deny-list / set-value / set-default / validation error+message

CompatibilityLink (D7 — cross-product)
 ├─ from: ProductFamily + condition on its segment values
 ├─ to: companion ProductFamily / fixed Part / generated code template (element, seal kit, indicator)
 └─ relation: required | recommended | optional accessory | spare

Part (non-configurable items with fixed part numbers: clamps CL0400, adaptors T1–T13,
      bypass spares BYP03/xx, indicator part numbers…)

PriceMap
 ├─ PriceList (currency, customer tier/region, effective dates, status)
 ├─ BasePrice (ProductFamily + key segments, e.g. size × pressure class)
 ├─ OptionPriceDelta (per SegmentOption: absolute adder, % uplift, or price-on-application)
 ├─ MatrixPrice (combination pricing where adders are not independent, e.g. size × material)
 └─ PartPrice (fixed parts)

Quote
 ├─ header: customer, contact, currency, validity, terms, status, revision
 └─ QuoteLine
     ├─ configuration snapshot (all segment selections, frozen metadata version)
     ├─ generated ordering code(s) (product + element + seal kit where applicable)
     ├─ qty, unit price breakdown (base + adders + manual adj.), discounts, taxes
     └─ availability status (confirmed / to-check — per the catalogue-wide footnote)
```

---

## 4. Functional Requirements

### 4.1 Product selection & guided configuration (Sales)

- **FR-1.1** Browse/search the catalogue by category → family; search by product name, series code, or a full/partial ordering code (pasting `160-LD-0013-…` should locate the family and pre-fill the configuration).
- **FR-1.2** On selecting a product family, render its specification segments in defined order as a guided form (wizard or single-page with progressive enablement).
- **FR-1.3** **Progressive enablement:** child segments are disabled until their parent segments are chosen; on parent selection, child option lists are filtered per the dependency rules (D1/D2). Options that exist but are invalid for the current selection should be shown greyed-out with the reason (e.g. "G05 ¾" only available for sizes 0005–0013") rather than hidden, so sales can guide customers.
- **FR-1.4** **Defaults:** every segment pre-selects its standard option, including conditional defaults (D4) that recalculate when parents change (changing 40→160 bar must update bypass default 3.5→7.0 bar and indicator default 2.5→5.0 bar, without overriding values the user explicitly set).
- **FR-1.5** **Derived values (D3)** are displayed as read-only facts of the configuration (element type, max system pressure, manometer scale, flow rating for chosen size) — these come from metadata tables, not code.
- **FR-1.6** **Numeric segments** validated against dynamic bounds (set pressure within selected rating; precharge ≤ limits, e.g. ASWD ≤ 15 bar; stroke ≤ 100 mm for ES).
- **FR-1.7** **Multi-select segments** enforce composition rules (D6): mutually exclusive pairs, prerequisite chains (CRN ⇒ 7U + NB), and quantity limits.
- **FR-1.8** On any change, re-validate the whole configuration (D5 constraints) and surface violations inline with datasheet-grounded messages.
- **FR-1.9** **Ordering code generation:** render the live ordering code as the user configures, using the family's code template (separators, blank-as-standard conventions, `/PO:xx` style suffixes, multi-code concatenation). The code is regenerated, never hand-typed.
- **FR-1.10** **Reverse parsing:** given a complete ordering code, decode it into a configuration (for re-quotes, order history imports, and validation of customer-supplied codes), reporting any invalid/obsolete positions.
- **FR-1.11** **Companion products (D7):** after configuring a main product, the app proposes compatible companions with pre-resolved codes/part numbers: replacement element + seal kit for filters; safety block (with auto-selected nipple code), charging kit (PCM vs PC by gas-valve style), clamps/brackets (by diameter), gas bottles/charging block for transfert setups, indicator part numbers. One click adds them as linked quote lines.
- **FR-1.12** Support quoting **non-configurable parts** (fixed part numbers: spares, adaptors, indicators) and **fixed-BOM systems** (NFF2 carts) as simple catalogue picks.
- **FR-1.13** Save configurations as reusable **templates/favourites** (e.g. a customer's standard filter spec) for one-click re-quoting.
- **FR-1.14** Every datasheet carries "Before ordering, check for availability" — each quote line carries an **availability flag** (standard / to-be-confirmed) driven by option metadata (options marked "on request" set the flag automatically).

### 4.2 Pricing engine

- **FR-2.1** Price a configuration as: **base price** (keyed by family + primary segments, typically size × pressure class) **+ option deltas** (absolute or %) **+ matrix prices** for non-independent combinations (e.g. SS housing × large size) — all resolved from the active price list.
- **FR-2.2** Support **multiple price lists**: currency, region, customer tier/segment, effective-dated, with draft → published lifecycle. INR first; multi-currency ready.
- **FR-2.3** Options with no price mapping resolve to **"Price on Application"** and flag the line for engineering/commercial review rather than silently pricing at zero. The same applies to `SP`/special/`X0` free-text options.
- **FR-2.4** Quantity-based pricing (tier breaks) per line; header- and line-level **discounts** with role-based limits and an **approval workflow** when limits are exceeded.
- **FR-2.5** Show the **price breakdown** (base + each option adder) to authorized roles; customer-facing output shows only the line price unless configured otherwise.
- **FR-2.6** Taxes (GST) and totals computed per line and quote; freight/packing/other charges as configurable quote-level line items.
- **FR-2.7** Price list import/export via spreadsheet (bulk maintenance is how the pricing team will actually work).
- **FR-2.8** A quote line stores the **price-list version** used; re-opening an old quote never silently reprices — the user is offered "refresh prices" explicitly.

### 4.3 Quote lifecycle

- **FR-3.1** Quote header: customer (from CRM or local master), contact, enquiry reference, validity period, delivery/payment terms, prepared-by.
- **FR-3.2** Statuses: Draft → Submitted (internal review, if triggered) → Sent → Won / Lost / Expired; **revisions** create a new version (Q-1234 Rev B) with full history and diff of what changed.
- **FR-3.3** Quote **document generation** (PDF): EPE branding, per-line ordering code + human-readable specification summary (each segment: name + chosen option meaning), prices, totals, terms; optional annexure with the full spec table per line. Email dispatch from the app.
- **FR-3.4** Duplicate/clone quotes and lines; re-quote from history with re-validation against current metadata (obsolete options are flagged, not silently substituted).
- **FR-3.5** On Won: export/handoff of the quote (ordering codes + quantities) to order processing/ERP (CSV/API; Zoho ecosystem integration is a likely target — to confirm).
- **FR-3.6** Dashboards: pipeline by status, win rate, most-quoted configurations, quotes pending approval, quotes with price-on-application lines.

### 4.4 Specification metadata management (Admin / Product team)

This module is the customer's explicit requirement: EPE staff must maintain the spec universe themselves so sales always sees current data.

- **FR-4.1** CRUD for: categories, product families, code templates, spec segments, segment options, global option dictionaries, dependency rules, compatibility links, parts.
- **FR-4.2** **Global option dictionaries** (media, seals, connections, certifications…) maintained once and referenced by families with per-family allowed subsets; editing a dictionary entry shows which families it affects before saving.
- **FR-4.3** **Dependency rule editor** usable by a trained product administrator (not a developer): tabular "allowed combinations" editors for D1/D2 (e.g. a size × connection grid), matrix upload for large grids (the bladder gas-valve × capacity matrix), simple condition builder for constraints/defaults; free-form rules reserved for admin power users.
- **FR-4.4** **Versioning & publish workflow:** all metadata edits happen in a draft workspace; a validation pass (rule engine dry-run: no orphan options, no contradictory rules, every family renders a valid default code) must pass before publishing; published versions are immutable and effective-dated. Sales always configures against the latest published version; historical quotes keep the version they were made with.
- **FR-4.5** **Datasheet linkage:** each family stores its datasheet file/revision (e.g. "EPE/05.001/LD Rev.9/09-2024"); when a new datasheet revision arrives, admin updates metadata and attaches the new PDF; the app can show sales the datasheet inline during configuration.
- **FR-4.6** **Bulk import/export** of segments/options/rules via structured spreadsheets — required both for initial seeding from the 60 datasheets and ongoing catalogue refresh.
- **FR-4.7** **Audit trail:** who changed what, when, old → new value, for every metadata and price change.
- **FR-4.8** Option/family **retirement** (soft delete with effective dates): retired options remain resolvable for historical quotes but cannot be selected in new ones; the legacy↔current code mappings (e.g. ANSI port codes 81–98 → new two-character scheme) can be recorded so old codes still parse.
- **FR-4.9** **Impact preview:** before publishing, show which existing templates/favourite configurations become invalid under the new rules.

### 4.5 Users, roles & administration

- **FR-5.1** Roles (minimum): **Sales** (configure, quote, discount within limit), **Sales Manager** (approve discounts, see all quotes/dashboards), **Product Admin** (metadata), **Pricing Admin** (price lists), **System Admin** (users, settings). One person may hold several roles.
- **FR-5.2** Authentication with SSO-readiness (EPE/Nexivo run on Zoho — Zoho/SAML/OAuth to confirm); session and password policies per customer IT norms.
- **FR-5.3** Customer master: local CRUD plus optional sync from CRM (to confirm which system — likely Zoho CRM).

---

## 5. Non-Functional Requirements

- **NFR-1 Performance:** option filtering and code regeneration respond < 300 ms; rule evaluation is client-cacheable per published metadata version; catalogue of ~30 families × ≤ 18 segments × ≤ 100 options/segment plus matrices of a few thousand cells must be handled comfortably.
- **NFR-2 Usability:** a salesperson quotes a standard filter in under 2 minutes; keyboard-friendly forms; works on laptop and tablet; the UI language is the datasheet's own vocabulary (segment names and option meanings, not internal codes alone).
- **NFR-3 Integrity:** an invalid ordering code must be impossible to add to a quote; all validation server-side as well as client-side.
- **NFR-4 Availability & deployment:** cloud-hosted web application; daily backups; metadata and quotes exportable at any time (no lock-in).
- **NFR-5 Auditability:** quotes and metadata immutable-once-published with full history (supports ISO 9001-style traceability EPE likely follows).
- **NFR-6 Extensibility:** adding a brand-new product family (new datasheet) must require **zero code changes** — only metadata entry. This is the acceptance test of the whole architecture.
- **NFR-7 Localisation-ready:** units shown as in datasheets (bar with psi equivalents); currency formatting per price list; future multi-language labels supported by the metadata schema (label per locale).

---

## 6. Data Seeding & Migration Plan

1. **Phase 0 — dictionaries:** load global option dictionaries (media Reference A, seal materials, connection codes, certification codes, indicator families) from the appendices.
2. **Phase 1 — pilot family per category:** one filter (40/160-LD/LDN), one accumulator (AS), one switch (PST3), the PRV valve — full segments, rules, matrices; validate the model covers D1–D7 end-to-end.
3. **Phase 2 — remaining families** via the bulk import templates (Appendices A–C already contain the structured content).
4. **Phase 3 — companion links & parts:** elements, seal kits, indicators, safety blocks, charging kits, clamps, spares with fixed part numbers.
5. **Phase 4 — pricing:** EPE supplies price data per the price-map structure (base + adders + matrices). *Note: no pricing information exists in the datasheets — this is entirely customer-supplied.*
6. **Verification:** for each family, regenerate the example codes printed on the datasheets (e.g. `160-LD-0013-H10XP-A-0P-0-9-A5.0-G06-P-0-0/`) and confirm byte-for-byte match; attempt known-invalid combinations and confirm rejection.

Recommended sequencing of the build itself: metadata model + rule engine → configurator UI → code generation/parsing → pricing → quote lifecycle/PDF → dashboards/integrations.

## 7. Open Questions for EPE (to resolve before build)

1. **Pricing structure reality:** Is pricing today maintained per ordering-code combination, per base-model + option adders, or negotiated per enquiry? How many price lists (domestic/export, OEM/dealer/end-user)? Which currency set?
2. **Discount policy:** discount limits per role, and who approves beyond them?
3. **ERP/CRM landscape:** Which systems must the app integrate with for customers, orders, and item masters (Zoho CRM/Books/Inventory or other)? Should Won quotes push sales orders automatically?
4. **Availability workflow:** when a line is "to-be-confirmed", who confirms (works/engineering), and should the app route it as a task?
5. **PST1 gap:** the PST1 datasheet is missing (file contains the PRV valve). Does a PST1 product exist to be included?
6. **Legacy generations:** should older-generation families (blue-format sheets: 40-FLE, 250/450-LD old format, TLF, NFF2, 25-FLD) be modelled as-is, or does EPE have newer revisions to supply first?
7. **Quote document format:** existing quotation template/branding to replicate? Annexure with full spec table — yes/no by default?
8. **Users & volumes:** number of sales users, quotes/month, concurrent usage — to size hosting.
9. **Customer-facing configurator (future):** is a dealer/customer self-service portal on the roadmap? (The metadata model supports it; affects auth design now.)
10. **Special/`SP` options:** how are specials engineered and priced today — should the app capture a structured "special requirement" workflow with engineering sign-off?

---

## 8. Addendum v1.1 — Requirements added after customer review (22 Jul 2026)

Feedback from the first working version produced these binding changes:

- **FR-A1 Prevent, don't reject.** Any specification option that would make the configuration invalid must be **disabled in the UI before it can be clicked** — including options that conflict with *auto-defaulted* parent values and multi-select options whose prerequisites (e.g. NB certification requiring ASME 7U) are not yet selected. Server-side validation remains as the last-resort guard, but a salesperson must never see an "invalid configuration" error for a choice the screen offered.
- **FR-A2 Parent changes reset stale children.** If a parent selection changes and an already-chosen child option is no longer available, the child position is automatically reset and a non-blocking notice explains why ("option X is not available with the current parent selections — please choose again"). The configuration can never *sit* in an invalid state.
- **FR-A3 Product & specification creation by admin.** The metadata module must let the product admin create new product families (category, series code, name, datasheet reference), append specification segments (ordering-code positions, incl. selection type), add options, and add/remove dependency rules — with no developer involvement.
- **FR-A4 Archive, never delete.** Products are retired by **archiving**: (a) the action requires an explicit confirmation; (b) before confirming, the system checks and displays **which existing quotations reference the product** (number, revision, status, line count); (c) archiving hides the product from the sales catalogue and blocks new quote lines, with a clear message; (d) **nothing is deleted from the database** — all metadata is retained, historical quotations stay fully reproducible, and the product can be unarchived at any time. Option retirement likewise requires confirmation and is a soft status change.
- **FR-A5 Printed quotation carries the full specification.** The print/PDF output must show every line's **complete specification table and companion products inline** — the collapsible "expand" presentation is for the on-screen view only.
- **FR-A7 Quote-centric add-item panel.** Building a quotation is done *from the quotation*: an "Add item" action opens the product catalogue in a right-side panel (~55–60 % width) beside the still-visible quote. The panel has tabs for **Products** (catalogue browse → embedded configurator) and **Parts & Spares** (fixed part numbers). While the salesperson configures in the panel, the quotation displays a live **pending line** — a highlighted draft row updating in real time with the item description, ordering code, quantity and unit price — which becomes a permanent line on "Add to quote" and disappears on cancel/close. The standalone catalogue page remains for browsing.
- **FR-A8 Edit quoted lines in place.** Every configured line on a quotation has an Edit action that reopens the add-item panel **pre-loaded with that line's exact stored configuration** (all positions as quoted, quantity included). While editing, the line's row in the quotation shows the live in-progress state ("editing…"). Saving re-validates server-side and updates the **same line in place** — new ordering code, refreshed specification snapshot, regenerated companion codes and re-derived price — preserving the line number; cancelling restores the stored values. Lines of archived products and non-configured (part) lines cannot be reconfigured.
- **FR-A9 Drawer navigation & related spares.** Inside the add-item panel: (a) the **Products** tab organizes the catalogue under **category sub-tabs** (Filters, Accumulators, Switches, Valves, Systems) with the product families listed under the active sub-tab; a search across the whole catalogue overrides the sub-tab filter while typing. (b) The **Parts & Spares** tab shows **all spare parts by default** on an empty quotation; as soon as the quotation contains configured products, it switches to showing the **spare parts related to the quoted product families** — recomputed live as products are added — with a **toggle switch** ("Show all parts") that lets the salesperson bring back the full parts list to add a spare unrelated to the quoted products.
- **FR-A10 Copy ordering codes.** Every place an ordering code or part number is displayed — quote line rows, the live/editing pending rows, the configurator's live-code box (full page and drawer), companion/spare codes, and the Parts & Spares lists — carries a one-click **copy-to-clipboard** control with visual "copied" feedback, so the code can be pasted into ERP, email, or purchase systems without retyping. Copy controls are hidden in the printed quotation.
- **FR-A11 Mandatory-section awareness.** While configuring, any required specification position that has no selection yet is highlighted with an **amber "needs selection" treatment** (soft amber background + amber left border + a "Required" badge) — deliberately distinct from the **red** styling used for genuine rule violations, so "not filled in yet" never looks like "you did something wrong". A compact **"Still needed:"** chip bar above the Add/Save button lists every outstanding required position as a clickable chip that scrolls to (and briefly flashes) that section. Optional positions are never flagged. The chips clear and the amber lifts as each position is filled; the Add/Save button stays disabled until none remain.
- **FR-A12 Line-level add, configurable dates, and version control on modification.**
  (a) The "Add item" action lives at the **line-item level** — a full-width "+ Add item" row at the bottom of the quotation's line-items table (not a separate toolbar button) — so adding a line reads as extending the list where the lines are.
  (b) The **quote date and validity period are configurable** per quotation (date picker + validity-in-days), the printed quotation shows Date / Validity / computed "Valid until", and a new quote defaults its date to the creation date.
  (c) **Version control on modification of a finalized quote:** while a quote is Draft it edits freely; once it is finalized (Sent/Won/Lost/Expired) its contents are locked, and any attempt to modify it prompts the user to either **save a new revision** (same quote number, next revision letter, as an editable Draft) or **create a new quote** (a fresh quote number, revision A) — the finalized quotation itself is never changed in place. (Revisions of one quote share its number; uniqueness is per number+revision.)
- **FR-A13 Dashboard home, merged quote management, catalogue freshness, quote lifecycle actions.**
  (a) The **Dashboard is the landing page**. The standalone Quotes page is **merged into it**: KPI widgets on top, then the full quotes table beneath, with **search (by item / ordering-code or customer name), status filter, and sort** (by date, number, customer, value, status). Clicking a row opens the quotation.
  (b) The **catalogue shows each product's last-updated date**. Every product family carries an `updated_at` timestamp, set at seed time and **bumped automatically whenever an admin changes its metadata** (family fields, segments, options, or rules); the catalogue card and the configurator display it so sales can see how current a product's specs are.
  (c) **Quote lifecycle actions** are available per quotation: **Clone** (copy to a new quote number, Rev A), **Archive** (soft-hide — kept in the database and recoverable via a "show archived" filter, dropped from the default list), and **Delete** (permanent removal after an explicit confirmation dialog; unlike archive, this cannot be undone). Archived quotes are excluded from the default dashboard list and from the configurator's "add to existing quote" picker.
- **FR-A14 Popularity-ranked add-item drawer.** In the add-item panel, both the **product families** (within each category sub-tab, and in search results) and the **Parts & Spares** list are ordered by how **frequently and recently** each item has been quoted to customers — highest first. Ranking uses a **time-decayed frequency** score: every historical quote line for an item contributes a weight that decays with age (≈30-day half-life) and the weights are summed, so many recent quotes rank above a single old one, and never-quoted items fall to the end in their normal (catalogue/part-number) order. The score updates as new quotations are made. (The standalone Catalogue and Parts pages retain their default ordering.)
- **FR-A15 Full pricing & flags authoring for new products.** When an admin creates a product and its options, they can set everything needed to price and behave correctly — not just code + label: (a) per-option **flags** — standard, on-request (availability-to-confirm), and price-on-application — settable when adding an option and toggleable afterward; (b) **base prices** for the family — a Generic base plus optional per-value keyed base prices (e.g. one per size), each editable and deletable; (c) **option adders** — absolute (₹) or percent, addable to any option, editable and deletable. A configuration prices as the most-specific matching base price plus its option adders (options flagged PoA force the line to Price-on-Application), so a newly authored product is fully quotable end-to-end without touching the database or seed.
- **FR-A16 Guided dependency-rule builder.** Admins must not have to hand-write rule JSON. The rule editor presents each dependency type by a plain-language name (Limit choices / Preselect a value / Show a fact / Require-forbid-bound / Combination rules) with a one-line help tip, then a **fill-in-the-blank form** whose inputs are dropdowns and chip-pickers **populated from the family's actual segments and options** — the admin never types a segment key or option code by hand. A **live plain-English preview** ("When Size is 0145 or 0200, only S103 or S133 are available for Connection") shows exactly what the rule will do before it is added, and existing rules are listed in the same plain English (raw JSON available on expand). An **Advanced (JSON)** toggle remains for power users and unusual rule shapes; switching to it prefills the JSON from the guided form. **Existing rules are editable through the same builder**: an Edit action on any rule loads it back into the "Add a rule" form (decomposed into its dropdowns/pickers), where the admin changes it and saves in place (same rule, updated) or cancels; a rule whose shape the guided form cannot fully represent opens prefilled in the Advanced (JSON) editor so it remains editable. The guided form models **multiple facts** (a "Show a fact" rule may set several facts) and **multiple combination entries** (a "Combination rules" rule may list several incompatible pairs or several prerequisites), so those rules preload into the form rather than JSON; only genuinely compound shapes (e.g. a require/forbid over more than one segment at once, or a numeric bound tied to another field) fall back to JSON, and a guard prevents any rule from being silently truncated on save.
- **FR-A17 Searchable metadata administration.** The admin Families & Specifications list is searchable and filterable: a search box matches product families by series code, name, category, or datasheet reference, and a status filter (All / Published / Draft / Archived) narrows the list — so an admin can find a product to edit without scrolling the full catalogue, and can locate draft or archived products that are hidden from the sales views.
- **FR-A18 Reorderable quote line items (drag-and-drop).** The salesperson reorders line items within a quotation by **dragging a line and dropping it** in the desired position, using a drag handle placed at the **start of each row** (left of the line number, per standard table-UI convention). While a line is being dragged its row is **visually highlighted (colour change)** until it is dropped, and the row it will land above/below is indicated. On drop, the new order is what appears on screen and in the printed quotation, and line numbers renumber to match. Reordering a finalized (Sent/Won/Lost) quote is not permitted directly — the quote is locked, and the salesperson branches to a new revision or new quote first (per FR-A12).
- **FR-A19 Quote change-history & audit trail.** The quote page has a **History** tab presenting the quotation's change log as a **timeline** (most recent first): who did what and when — quote created, status changes, detail edits, line added / edited / removed / reconfigured, lines reordered, archive/unarchive, revision/clone — each entry showing the action, the user, and the timestamp. The quote also records and displays its **created-by and last-modified-by user** (shown in the quotation header). Every content-changing action stamps the modifier and appends to the audit trail. (Until user authentication is added, the "user" is the acting role, e.g. Sales or Product Admin.)
- **FR-A20 Linear status pipeline & consistent navigation.** The quote's status is shown and updated as a **coloured linear pipeline** (Blueprint-style) rather than a plain dropdown: the main progression **Draft → Sent → Won** is a connected chevron stepper with the current stage carrying its colour, already-passed stages shown as completed (✓), and not-yet-reached stages muted; the off-track outcomes **Lost / Expired** are offered as separate outcome chips. Clicking any stage sets the quote to that status inline (and, since leaving Draft finalizes the quote, the finalize/lock behaviour and the coloured status pill on the printed document follow the same colour scheme). The quote page's back control returns to the **Dashboard** (home), which is where quotes are listed — it must not navigate to a non-existent page.
- **FR-A21 Spare-parts administration with one-or-many product association.** The metadata administration area lets the Product Admin **add, edit and retire spare parts** — a dedicated **Spare Parts** tab lists every spare (part number, name, related families, price, status) with search, add and inline edit; a **spare-parts card inside each family editor** offers the same, pre-linked to that family, so spares can be added directly "to the product family." Each spare can be associated with a **single product family or with several related families** (many-to-many), chosen through a checkbox multi-select of families. A spare surfaces as a **related spare** in the quote drawer whenever *any* of its associated products is on the quote (not only a single primary product). Part numbers are unique (duplicate attempts are rejected with a clear message), and retiring a spare keeps it in the database and on historical quotations while removing it from new-quote pick-lists (never deleted).
- **FR-A22 Tabbed product editor with a floating rule builder.** When a Product Admin opens a product in metadata administration, the editor is organised into **tabs** instead of one long scroll — **Segments & Options**, **Pricing**, **Spare Parts**, and **Rules (n)** — so each concern is viewed on its own without endless scrolling. The **Rules** tab presents all dependency rules in a list, with the **"Add a rule" guided builder docked at the top in a floating (sticky) panel** that stays in view while the rules list scrolls; it is compact by default (an "Add a rule" button) and unfolds into the full guided builder on demand. Editing an existing rule (✎) opens that same top dock in edit mode with the rule preloaded, and Cancel collapses it back. (The guided builder itself is unchanged — see FR-A15/A16.)
- **FR-A23 Collapsible (accordion) segments with record counts.** On the **Segments & Options** tab, each specification segment is a **collapsible accordion**: its header (position, name, key, selection type) is always visible with a rotating caret, and clicking it expands or collapses that segment's options table. Sections are **collapsed by default** so a product with many positions shows as a compact, scannable list, with **Expand all / Collapse all** controls. **Record counts are shown**: the tab label and the tab header show the number of specification segments, each accordion header shows how many option records it holds (and how many are retired), and a running total of options across all positions is displayed. This keeps large products (e.g. 18 segments / 100+ options) navigable without a long scroll.
- **FR-A24 Record counts on every product-editor tab (incl. base-price variants & spares).** Every tab in the product editor shows the number of records it holds, displaying **0 when empty**: **Segments & Options (n)**, **Base Price variants (n)**, **Spare Parts (n)**, and **Rules (n)**. The **Pricing** tab is renamed **Base Price variants** (each base-price row — the generic price plus any per-segment-value prices — is a variant) and its count reflects the number of base-price variants defined for the family. The **Spare Parts** tab count reflects the spares linked to that family and updates live as spares are added, edited or unlinked.
- **FR-A25 Product category administration.** The Product Admin can **create, rename, reorder and delete product categories** directly in metadata administration (previously categories were fixed seed data and a new family could only be filed under a pre-existing one). Product categories are the **first top-level tab** of the Product Metadata Administration page — the **Product Categories** tab shows every category with its code, display name, sort order and the number of families using it, and supports adding a new category (unique code + name), editing an existing one, and deleting a category **only when no families reference it** (an in-use category cannot be deleted — the app reports how many families still use it rather than reassigning or orphaning them). New categories become immediately selectable when creating a product family; empty categories simply don't appear in the sales catalogue. Every change is audited.
- **FR-A26 Record counts on the top-level metadata tabs.** The top-level tabs of the Product Metadata Administration page each show their record count: **Families & Specifications (n)** (total product families across all statuses), **Spare Parts (n)** (total spare parts), and **Audit Trail (n)** (total audit entries). This complements the per-product tab counts (FR-A24); counts refresh when the relevant data changes (e.g. adding a family or a spare) so the admin always sees the current totals at a glance.
- **FR-A27 Choose the target quote from the Parts & Spares page.** On the standalone **Parts & Spares** page, the per-part action is labelled **Add to Quote** (previously "Add to draft quote", which silently used the first draft). Clicking it opens a **quote picker** listing the open (Draft) quotations — each showing quote number/revision, customer, line count and date — from which the user chooses the destination; the part is then added to that quotation and the app opens it. The picker also offers **＋ New quote** (creates a fresh quotation and adds the part to it). Only editable (Draft) quotations are offered, since finalized quotes are locked (per FR-A12).
- **FR-A28 Data-safety architecture — no data loss across updates.** As the application evolves (new features, schema changes), existing data (quotations, catalogue metadata, prices, audit history) must never be lost. This is guaranteed by a defined mechanism rather than left to care: (a) **automatic backups** — the database is snapshotted before every schema migration and once per day on startup, with retention of the most recent snapshots; (b) **versioned, forward-only migrations** — every schema change is a named, recorded migration (tracked in a `_migrations` table) that runs exactly once and only ever **adds** columns/tables/indexes; (c) **safe rebuilds** — when SQLite cannot alter a constraint in place and a table must be rebuilt, the new table is created with the full current column set and the migration **asserts that every existing column is preserved** (and the row count is unchanged) before the old table is dropped, so a column can never be silently lost; (d) **exportability** — the entire database can be exported/downloaded at any time and manual backups triggered on demand (no lock-in). The guarantee is verified by tests that round-trip real data and a synthetic legacy-schema database through the upgrade path and assert every row and column survives.
- **FR-A29 Server-side integrity hardening.** The server is the authority (NFR-3), enforced consistently: (a) a finalized quotation's **contents are immutable server-side** — line add/edit/reconfigure/delete/reorder and commercial-field edits are rejected with a clear conflict on any non-Draft quote, while status transitions and archive/unarchive remain allowed; (b) revisions derive their letter from the highest existing revision (re-revising never collides); (c) database constraint violations return clear 4xx messages (duplicate → conflict, bad reference → bad-request) instead of opaque 500s; (d) multi-row writes (clone/revise, line operations) are transactional; (e) quantities, discounts and statuses are validated/bounded. On the client, every failed request surfaces a visible message (no silent failures), commercial-field edits commit on blur rather than per keystroke, and unknown routes show a clear "not found" rather than a blank screen.
- **FR-A32 Post-offer clarifications & TAT tracking.** Once a quote has been sent as an offer
  (not while it's still Draft), any user can log a customer's technical or commercial question
  against it under a **Clarification** category, and any user can respond. Each entry records who
  raised it and when, and — once answered — who responded, when, and the **turnaround time (TAT)**,
  computed as the elapsed time between raised and responded (never stored, always derived from the
  two timestamps). A Clarifications tab on the quote page lists these with status (open/answered);
  the Dashboard shows two aggregate tiles — open clarification count and average response time —
  as a lightweight starting point for TAT analysis (a fuller filterable report is a later phase if
  needed). Removing a clarification soft-removes it (never hard-deleted). New `clarifications`
  table (additive migration) — no changes to the `quotes` table.
- **FR-A6 Catalogue-wide verification.** Each metadata release must pass an automated sweep proving, for every published family: the default configuration is violation-free; every option displayed as enabled is selectable without error (alone and pairwise with every parent option); and a full sequential configuration completes, validates, renders its ordering code and prices. (The v1.1 sweep covers 36 families / ~37,000 checks.)

## 9. Acceptance Criteria (summary)

1. A salesperson can produce a valid, priced, PDF quote for any published product family without referring to the paper datasheet.
2. The system cannot emit an ordering code that violates any dependency printed in the datasheets (spot-checked against the D1–D7 examples in §2.3).
3. A product admin can add a new option (e.g. a new filtration grade) or a whole new family and have it live for sales after passing publish validation — with no developer involvement.
4. Historical quotes remain exactly reproducible after any metadata or price change.
5. All datasheet example codes regenerate identically from the configurator (seeding verification, §6).
