# Cloudflare Workers + D1 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the EPE quote app to Cloudflare as a single Worker (Hono API + static client assets) backed by a D1 database, while keeping the existing Express/better-sqlite3 app fully working and untouched as the system of record until cutover.

**Architecture:** A new `quote-app/worker/` package contains a Hono app that re-implements all ~45 Express routes against D1 (async). The pure rule engine (`evaluate`, `renderCode`, `parseCode`, `resolveCompanions`) is imported unchanged from `server/engine.js`. The only edit to existing code is a behavior-preserving refactor inside `engine.js` that extracts the pricing arithmetic into a pure exported function so both servers share it. The client is served by the same Worker from `client/dist` (no client code changes; API paths are already relative).

**Tech Stack:** Hono 4.x, Cloudflare Workers (wrangler 4.x, already installed), D1 (SQLite), Workers Static Assets, existing React/Vite client.

## Global Constraints

- The Express app (`server/`) must keep working at every commit — it is the production system until cutover. `server/index.js`, `server/db.js`, `server/sweep.js`, seeds: **zero changes**. `server/engine.js`: only the pricing-core extraction in Task 2, gated by the sweep.
- Regression gate of record (from TESTING.md): `node server/sweep.js` → **36 families, 37,007 checks, 0 failures** after any engine change.
- Golden codes (must never change): LD default → `160-LD-0013-H10XP-A-0P-0-9-0-_-P-0-0`; AS default → `AS 35 P 360 C G 09 F 0 C C V`; LD with G06 → `160-LD-0013-H10XP-A-0P-0-9-0-G06-P-0-0` priced ₹49,100 with 2 breakdown rows.
- Data baseline to verify after every import: **16 quotes · 39 families · 61 parts · 5 categories** (update if legitimate data grows before cutover).
- All test scripts are self-cleaning (TESTING.md §2.1) and send `X-Actor`.
- API contract is frozen: same paths, methods, status codes, and JSON shapes as Express (parity-tested), because the client is unchanged.
- Work happens on branch `cloudflare-migration`; commit after every green task.

---

## Impact Analysis (what changes, what doesn't)

| Area | File(s) | Change | Risk | Mitigated by |
|---|---|---|---|---|
| Rule engine (pure parts) | `server/engine.js` `evaluate/renderCode/parseCode/resolveCompanions` | none — imported by Worker as-is | none | — |
| Pricing | `server/engine.js` `priceConfiguration` | extract arithmetic into exported pure `priceRows()`; `priceConfiguration(db,…)` keeps its exact signature and becomes a 3-line wrapper | low | sweep 37,007 checks + golden price ₹49,100 |
| Express server | `server/index.js`, `server/db.js` | none | none | — |
| API layer | new `worker/src/index.js` | all ~45 routes re-implemented in Hono, async D1 calls | **main risk** | read-endpoint parity diff vs live Express + write-path functional suite |
| Transactions | `copyQuote`, add-line, setPartFamilies etc. | `db.transaction()` → `env.DB.batch()` (atomic in D1). `copyQuote` needs the new header id inside the batch → resolved via `UNIQUE(number, revision)` subselect | medium | dedicated revise/clone tests incl. line-copy counts |
| Error handling | Express error middleware → Hono `onError` | D1 wraps SQLite errors; constraint mapping switches from `err.code` to message matching (`UNIQUE constraint failed`, `FOREIGN KEY constraint failed`, `NOT NULL constraint failed`) | low | forced-duplicate and bad-FK tests assert 409/400 |
| Backups (NFR-4) | `/api/admin/backups`, `/api/admin/export` | fs snapshots impossible on Workers. D1 Time Travel (30-day PITR) replaces snapshots; export becomes a full JSON dump download (keeps the no-lock-in promise) | low | export test counts rows in every table |
| Migrations | `server/db.js` MIGRATIONS | not ported — D1 gets a baseline schema generated from the real local DB (`sqlite3 .schema`), already post-migration. Future schema changes use `wrangler d1 migrations` | low | import + count verification |
| Client | `client/**` | none (relative `/api` paths; `X-Actor` header preserved). Vite dev proxy still points at Express for local dev | none | client build + E2E |
| Security | — | **new exposure**: the app currently has no auth; deploying makes pricing + admin endpoints public. Cloudflare Access (Zero Trust) is placed in front before sharing the URL | high if skipped | Task 12 verifies unauthenticated requests are blocked |
| Quote numbering | `nextQuoteNumber()` | unchanged logic; D1 single-writer per DB keeps race risk at current level (low-concurrency internal tool) | low | revise/clone collision tests |
| Data | `server/epe-quote.db` | one-time dump → transform → D1 import; **re-imported fresh at cutover** after stopping the Desktop server | low | row-count parity vs baseline |

Endpoint inventory being ported (from `server/index.js`, 45 routes): catalog(1), family meta(1), popularity(1), evaluate/parse-code(2), search(1), parts(1), customers(2), quotes(9: list/create/get/patch/delete/archive/unarchive/revise/clone), quote audit(1), lines(4: add/patch/delete/reconfigure), reorder(1), admin categories(4), admin families(6: list/create/patch/usage/archive/unarchive/publish), segments(1), rules(3), options(2), admin audit(1), summary(1), backups(2), export(1), prices(6), admin parts(3), dashboard(1).

---

### Task 1: Baseline verification (no code changes)

**Files:**
- Create: `docs/superpowers/plans/baseline-2026-07-24.md` (recorded results)

**Interfaces:**
- Produces: a written baseline every later task is compared against.

- [ ] **Step 1: Branch**

```bash
cd /Users/ramki/Developer/EPE && git checkout -b cloudflare-migration
```

- [ ] **Step 2: Run the sweep (regression gate of record)**

Run: `cd quote-app && node server/sweep.js`
Expected: `36 families, 37007 checks, 0 failures` (or the current true numbers — record verbatim).

- [ ] **Step 3: Run the migration-safety suite**

Run: `node server/test-migrations.mjs`
Expected: `5 passed, 0 failed`.

- [ ] **Step 4: Record data counts**

```bash
sqlite3 server/epe-quote.db "SELECT (SELECT COUNT(*) FROM quotes), (SELECT COUNT(*) FROM families), (SELECT COUNT(*) FROM parts), (SELECT COUNT(*) FROM categories);"
```
Expected: `16|39|61|5` (record actual).

- [ ] **Step 5: Verify golden codes against a live Express instance**

```bash
PORT=4781 node server/index.js &  sleep 2
# LD family id: look it up
LD_ID=$(sqlite3 server/epe-quote.db "SELECT id FROM families WHERE code='LD' OR name LIKE '%LD%' LIMIT 1")
curl -s -X POST localhost:4781/api/families/$LD_ID/evaluate -H 'Content-Type: application/json' -H 'X-Actor: sales' -d '{"selections":{}}' | python3 -c "import json,sys; r=json.load(sys.stdin); print(r['code'])"
```
Expected: `160-LD-0013-H10XP-A-0P-0-9-0-_-P-0-0`. Repeat for the AS family and the G06 priced variant (expect total 49100, 2 breakdown rows). Kill the server (`lsof -tiTCP:4781 | xargs kill`).

- [ ] **Step 6: Write all recorded values into `baseline-2026-07-24.md`, commit**

```bash
git add docs/ && git commit -m "chore: record migration baseline (sweep, counts, golden codes)"
```

---

### Task 2: Extract pure pricing core in `engine.js`

**Files:**
- Modify: `quote-app/server/engine.js:322-364` (priceConfiguration)

**Interfaces:**
- Produces: `export function priceRows(bases, adders, effective, segments)` → `{ poa, total, breakdown }` where `bases` = rows from `base_prices`, `adders` = rows from `option_prices`. `priceConfiguration(db, priceListId, familyId, effective, segments)` keeps its exact current signature and behavior.
- Consumed by: Express (unchanged call sites) and the Worker (Task 6).

- [ ] **Step 1: Refactor — replace the body of `priceConfiguration` with a fetch + pure-core split**

```js
// ============ PRICING ============
// Pure core: same algorithm, rows passed in (shared by the Express and Worker servers).
export function priceRows(bases, adders, effective, segments) {
  let best = null, bestSpecificity = -1;
  for (const b of bases) {
    const match = JSON.parse(b.match || '{}');
    let ok = true;
    for (const [k, v] of Object.entries(match)) {
      if (String(effective[k]) !== String(v)) { ok = false; break; }
    }
    const spec = Object.keys(match).length;
    if (ok && spec > bestSpecificity) { best = b; bestSpecificity = spec; }
  }
  const breakdown = [];
  let poa = false;
  let total = 0;
  if (best) {
    breakdown.push({ label: 'Base price', amount: best.amount });
    total = best.amount;
  } else {
    poa = true;
    breakdown.push({ label: 'Base price', amount: null, note: 'No base price mapped — Price on Application' });
  }
  for (const seg of segments) {
    const v = effective[seg.key];
    const vals = Array.isArray(v) ? v : (v != null && v !== '' ? [v] : []);
    for (const val of vals) {
      const opt = seg.options.find(o => o.code === String(val));
      if (opt && opt.price_on_application) {
        poa = true;
        breakdown.push({ label: `${seg.name}: ${opt.label}`, amount: null, note: 'Price on Application' });
        continue;
      }
      const row = adders.find(a => a.segment_key === seg.key && a.option_code === String(val));
      if (row && row.amount !== 0) {
        const amt = row.kind === 'pct' ? Math.round((best ? best.amount : 0) * row.amount / 100) : row.amount;
        breakdown.push({ label: `${seg.name}: ${opt ? opt.label : val}`, amount: amt, kind: row.kind });
        total += amt;
      }
    }
  }
  return { poa, total: poa ? null : Math.round(total), breakdown };
}

export function priceConfiguration(db, priceListId, familyId, effective, segments) {
  const bases = db.prepare('SELECT * FROM base_prices WHERE price_list_id=? AND family_id=?').all(priceListId, familyId);
  const adders = db.prepare('SELECT * FROM option_prices WHERE price_list_id=? AND family_id=?').all(priceListId, familyId);
  return priceRows(bases, adders, effective, segments);
}
```

(The moved lines are byte-identical to the current algorithm — only the two `db.prepare` calls move out of the loop-free preamble into the wrapper.)

- [ ] **Step 2: Run the sweep**

Run: `node server/sweep.js`
Expected: identical numbers to Task 1 (0 failures).

- [ ] **Step 3: Re-verify the priced golden code (₹49,100, 2 rows) as in Task 1 Step 5**

- [ ] **Step 4: Commit**

```bash
git add server/engine.js && git commit -m "refactor(engine): extract pure priceRows core, behavior identical (sweep green)"
```

---

### Task 3: Worker scaffold — Hono + static assets + local D1

**Files:**
- Create: `quote-app/worker/package.json`, `quote-app/worker/wrangler.jsonc`, `quote-app/worker/src/index.js`, `quote-app/worker/schema.sql`, `quote-app/worker/.gitignore` (`node_modules/`, `.wrangler/`)

**Interfaces:**
- Produces: Hono `app` with bindings `env.DB` (D1) and `env.ASSETS`; `worker/schema.sql` = exact post-migration schema of the real DB.

- [ ] **Step 1: package.json**

```json
{
  "name": "epe-quote-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:local-import": "wrangler d1 execute epe-quote --local --file=./data.sql"
  },
  "dependencies": { "hono": "^4.6.0" },
  "devDependencies": { "wrangler": "^4.0.0" }
}
```

- [ ] **Step 2: wrangler.jsonc** (database_id filled in Task 12; local dev doesn't need it)

```jsonc
{
  "name": "epe-quote",
  "main": "src/index.js",
  "compatibility_date": "2026-07-01",
  "assets": {
    "directory": "../client/dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "epe-quote", "database_id": "PLACEHOLDER-SET-IN-TASK-12" }
  ]
}
```

- [ ] **Step 3: Minimal src/index.js**

```js
import { Hono } from 'hono';

const app = new Hono();
app.get('/api/ping', (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 4: Generate the baseline schema from the REAL database** (post-migration truth, not `createSchema` — the quotes table differs after migration 006)

```bash
cd quote-app/server && sqlite3 epe-quote.db .schema | grep -v sqlite_sequence > ../worker/schema.sql
```
Then open `worker/schema.sql` and delete the `_migrations` table statement (D1 migrations replace it).

- [ ] **Step 5: Install, create local D1, verify**

```bash
cd ../worker && npm install
wrangler d1 execute epe-quote --local --file=./schema.sql
npm run dev &  sleep 4
curl -s localhost:8787/api/ping        # → {"ok":true}
curl -s -o /dev/null -w "%{http_code}\n" localhost:8787/   # → 200 (client index.html from ../client/dist)
```
Expected: both pass. Kill wrangler dev.

- [ ] **Step 6: Commit**

```bash
git add worker/ && git commit -m "feat(worker): scaffold Hono worker with static assets and local D1 schema"
```

---

### Task 4: Data import + D1 data-access layer

**Files:**
- Create: `quote-app/worker/export-data.sh`, `quote-app/worker/src/data.js`

**Interfaces:**
- Produces: `data.js` exports —
  `loadFamilyMeta(DB, familyId)` → same shape as engine's version (async);
  `audit(DB, actor, action, entity, entityId, detail)` → Promise;
  `touchFamily(DB, familyId)`, `partFamilyIds(DB, partId)`, `segmentFamilyId(DB, segmentId)`, `optionFamilyId(DB, optionId)`, `stampQuote(DB, quoteId, actor)`, `lineQuoteId(DB, lineId)`, `activePriceList(DB)`, `requireDraft(DB, quoteId)` → `{quote}|{error,status}`;
  `nextRevision(DB, number)`, `nextQuoteNumber(DB)`.
  D1 idioms used throughout: `.prepare(sql).bind(...).first()` / `.all()` → `.results`, `.run()` → `.meta.last_row_id`.

- [ ] **Step 1: export-data.sh — dump real data (data only, D1-import-safe)**

```bash
#!/usr/bin/env bash
# Dump DATA ONLY from the live sqlite file, in an order that satisfies FKs,
# stripped of PRAGMA/TRANSACTION statements (D1 rejects them).
set -euo pipefail
DB="${1:-../server/epe-quote.db}"
OUT="${2:-data.sql}"
TABLES="categories families segments options rules companion_links parts part_families price_lists base_prices option_prices part_prices customers quotes quote_lines audit_log"
: > "$OUT"
for t in $TABLES; do
  sqlite3 "$DB" ".mode insert $t" "SELECT * FROM $t;" >> "$OUT"
done
echo "wrote $OUT: $(grep -c 'INSERT INTO' $OUT) rows"
```

- [ ] **Step 2: Import into local D1 and verify counts**

```bash
chmod +x export-data.sh && ./export-data.sh
wrangler d1 execute epe-quote --local --file=./data.sql
wrangler d1 execute epe-quote --local --command "SELECT (SELECT COUNT(*) FROM quotes), (SELECT COUNT(*) FROM families), (SELECT COUNT(*) FROM parts), (SELECT COUNT(*) FROM categories)"
```
Expected: matches Task 1 baseline (`16|39|61|5`).

- [ ] **Step 3: Write src/data.js**

```js
// D1 data-access helpers. Mirrors the sync helpers in server/index.js + the
// db-touching engine functions, in async D1 form. Shapes are parity-tested.

export async function loadFamilyMeta(DB, familyId) {
  const family = await DB.prepare('SELECT * FROM families WHERE id=?').bind(familyId).first();
  if (!family) return null;
  const segments = (await DB.prepare('SELECT * FROM segments WHERE family_id=? ORDER BY position').bind(familyId).all()).results;
  for (const s of segments) {
    s.options = (await DB.prepare("SELECT * FROM options WHERE segment_id=? AND status='active' ORDER BY sort, id").bind(s.id).all()).results;
  }
  const rules = (await DB.prepare('SELECT * FROM rules WHERE family_id=?').bind(familyId).all()).results
    .map(r => ({ id: r.id, type: r.type, note: r.note, ...JSON.parse(r.rule) }));
  const links = (await DB.prepare('SELECT * FROM companion_links WHERE family_id=?').bind(familyId).all()).results
    .map(r => ({ id: r.id, note: r.note, ...JSON.parse(r.link) }));
  family.code_template = family.code_template ? JSON.parse(family.code_template) : { separator: '-' };
  return { family, segments, rules, links };
}

export const audit = (DB, actor, action, entity, entityId, detail) =>
  DB.prepare('INSERT INTO audit_log(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)')
    .bind(actor || 'demo', action, entity, String(entityId ?? ''), detail ? JSON.stringify(detail) : null).run();

export const touchFamily = (DB, familyId) =>
  familyId ? DB.prepare("UPDATE families SET updated_at = datetime('now') WHERE id=?").bind(familyId).run() : Promise.resolve();

export const partFamilyIds = async (DB, partId) =>
  (await DB.prepare('SELECT family_id FROM part_families WHERE part_id=? ORDER BY family_id').bind(partId).all()).results.map(r => r.family_id);

export const segmentFamilyId = async (DB, segmentId) =>
  (await DB.prepare('SELECT family_id FROM segments WHERE id=?').bind(segmentId).first())?.family_id;

export const optionFamilyId = async (DB, optionId) =>
  (await DB.prepare('SELECT s.family_id AS fid FROM options o JOIN segments s ON s.id=o.segment_id WHERE o.id=?').bind(optionId).first())?.fid;

export const stampQuote = (DB, quoteId, actor) =>
  DB.prepare("UPDATE quotes SET updated_at=datetime('now'), updated_by=? WHERE id=?").bind(actor || 'demo', quoteId).run();

export const lineQuoteId = async (DB, lineId) =>
  (await DB.prepare('SELECT quote_id FROM quote_lines WHERE id=?').bind(lineId).first())?.quote_id;

export const activePriceList = (DB) =>
  DB.prepare("SELECT * FROM price_lists WHERE status='published' ORDER BY id LIMIT 1").first();

// Finalized-quote guard (server is the authority — NFR-3). Same 404/409 semantics.
export async function requireDraft(DB, quoteId) {
  const q = await DB.prepare('SELECT * FROM quotes WHERE id=?').bind(+quoteId).first();
  if (!q) return { error: { error: 'quote not found' }, status: 404 };
  if (q.status !== 'Draft') return {
    error: { error: `Quote ${q.number} Rev ${q.revision} is ${q.status} and locked — save a new revision or a new quote to change its contents.` },
    status: 409,
  };
  return { quote: q };
}

export async function nextRevision(DB, number) {
  let max = 'A';
  for (const r of (await DB.prepare('SELECT revision FROM quotes WHERE number=?').bind(number).all()).results) {
    if (r.revision > max) max = r.revision;
  }
  return max >= 'Z' ? null : String.fromCharCode(max.charCodeAt(0) + 1);
}

export async function nextQuoteNumber(DB) {
  const year = new Date().getFullYear();
  const rows = (await DB.prepare('SELECT DISTINCT number FROM quotes WHERE number LIKE ?').bind(`Q-${year}-%`).all()).results;
  let max = 0;
  for (const r of rows) { const m = r.number.match(/-(\d+)$/); if (m) max = Math.max(max, +m[1]); }
  return `Q-${year}-${String(max + 1).padStart(4, '0')}`;
}
```

- [ ] **Step 4: Smoke-test loadFamilyMeta through a temporary route**

Add to `src/index.js`: `app.get('/api/_meta-test/:id', async (c) => c.json(await loadFamilyMeta(c.env.DB, +c.req.param('id'))));`
Run wrangler dev, `curl -s localhost:8787/api/_meta-test/1 | python3 -m json.tool | head -20` → family 1 with segments+options. Remove the temp route.

- [ ] **Step 5: Commit**

```bash
git add worker/ && git commit -m "feat(worker): D1 data layer + real-data import script (counts verified)"
```

---

### Task 5: Port read-only routes + parity harness

**Files:**
- Modify: `quote-app/worker/src/index.js`
- Create: `quote-app/worker/test/parity.mjs`

**Interfaces:**
- Consumes: `data.js` helpers (Task 4).
- Produces: GET routes `/api/catalog`, `/api/families/:id/meta`, `/api/popularity`, `/api/search`, `/api/parts`, `/api/customers`, `/api/quotes`, `/api/quotes/:id`, `/api/quotes/:id/audit`, `/api/admin/categories`, `/api/admin/families`, `/api/admin/families/:id/usage`, `/api/admin/parts`, `/api/admin/prices/:familyId`, `/api/admin/audit`, `/api/admin/summary`, `/api/dashboard` — byte-shape-identical JSON to Express.

- [ ] **Step 1: Port each GET route.** Conversion rules (apply uniformly):

| Express | Hono/D1 |
|---|---|
| `app.get('/p', (req,res)=>…)` | `app.get('/p', async (c)=>…)` |
| `req.params.id` | `c.req.param('id')` |
| `req.query.q` | `c.req.query('q')` |
| `req.headers['x-actor']` | `c.req.header('x-actor')` |
| `db.prepare(sql).get(a)` | `await DB.prepare(sql).bind(a).first()` |
| `db.prepare(sql).all(a)` | `(await DB.prepare(sql).bind(a).all()).results` |
| `res.json(x)` | `return c.json(x)` |
| `res.status(404).json(e)` | `return c.json(e, 404)` |

Representative conversion (catalog) — every other GET follows the same mechanical pattern with its exact SQL copied verbatim from `server/index.js`:

```js
import { Hono } from 'hono';
import { evaluate, resolveCompanions, parseCode, priceRows } from '../../server/engine.js';
import * as d from './data.js';

const app = new Hono();
const DB = (c) => c.env.DB;

app.get('/api/catalog', async (c) => {
  const categories = (await DB(c).prepare('SELECT * FROM categories ORDER BY sort').all()).results;
  const families = (await DB(c).prepare('SELECT id, category_id, code, name, description, datasheet_ref, kind, status, updated_at FROM families ORDER BY sort, name').all()).results;
  return c.json({ categories, families });
});
```

Two non-mechanical notes: (a) `/api/quotes/:id` post-processes line JSON fields (`config_json`→`config` etc.) — copy that loop verbatim; (b) `/api/popularity`'s scoring is pure JS — copy `parseTs`/`scoreMap` verbatim, only the two SQL reads become D1 calls.

- [ ] **Step 2: Write test/parity.mjs** — diffs Express (source of truth) vs Worker on identical data:

```js
// Parity: identical requests to Express (4781) and Worker (8787); deep-diff JSON.
// Prereq: both running against THE SAME data snapshot (fresh data.sql import).
const EX = 'http://localhost:4781', WK = 'http://localhost:8787';
const H = { 'X-Actor': 'sales', 'Content-Type': 'application/json' };
const get = async (base, p) => (await fetch(base + p, { headers: H })).json();
const post = async (base, p, body) => (await fetch(base + p, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();

const diff = (a, b, path = '') => {
  if (typeof a !== typeof b) return [`${path}: type ${typeof a} vs ${typeof b}`];
  if (a === null || typeof a !== 'object') return Object.is(a, b) ? [] : [`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys.flatMap((k) => diff(a?.[k], b?.[k], `${path}.${k}`));
};

let failures = 0;
const check = (name, d) => { if (d.length) { failures++; console.log(`✗ ${name}\n  ` + d.slice(0, 5).join('\n  ')); } else console.log(`✓ ${name}`); };

const cat = await get(EX, '/api/catalog');
check('catalog', diff(cat, await get(WK, '/api/catalog')));
for (const f of cat.families) {
  check(`meta ${f.code}`, diff(await get(EX, `/api/families/${f.id}/meta`), await get(WK, `/api/families/${f.id}/meta`)));
  if (f.kind === 'configurable' && f.status === 'published') {
    check(`evaluate-default ${f.code}`, diff(
      await post(EX, `/api/families/${f.id}/evaluate`, { selections: {} }),
      await post(WK, `/api/families/${f.id}/evaluate`, { selections: {} })));
  }
}
for (const p of ['/api/popularity', '/api/parts', '/api/customers', '/api/quotes', '/api/quotes?archived=1',
  '/api/search?q=LD', '/api/admin/categories', '/api/admin/families', '/api/admin/parts', '/api/admin/audit',
  '/api/admin/summary', '/api/dashboard']) {
  check(p, diff(await get(EX, p), await get(WK, p)));
}
const quotes = await get(EX, '/api/quotes');
for (const q of quotes.slice(0, 5)) {
  check(`quote ${q.number}-${q.revision}`, diff(await get(EX, `/api/quotes/${q.id}`), await get(WK, `/api/quotes/${q.id}`)));
  check(`quote-audit ${q.id}`, diff(await get(EX, `/api/quotes/${q.id}/audit`), await get(WK, `/api/quotes/${q.id}/audit`)));
}
console.log(failures ? `\n${failures} PARITY FAILURES` : '\nALL PARITY CHECKS PASSED');
process.exit(failures ? 1 : 0);
```

(The `evaluate-default` checks are added in Task 6; until then that block is expected to fail — run parity with it commented out in this task, uncomment in Task 6.)

- [ ] **Step 3: Run parity**

```bash
cd quote-app && PORT=4781 node server/index.js &   # Express on the ORIGINAL local db
cd worker && rm -rf .wrangler/state && wrangler d1 execute epe-quote --local --file=./schema.sql && ./export-data.sh && wrangler d1 execute epe-quote --local --file=./data.sql && npm run dev &
sleep 5 && node test/parity.mjs
```
Expected: `ALL PARITY CHECKS PASSED` (evaluate block commented). Note: audit rows written by Express *after* the dump would diverge — always re-dump immediately before the run.

- [ ] **Step 4: Commit** `git add worker/ && git commit -m "feat(worker): read-only routes, parity-verified against Express"`

---

### Task 6: Port configurator routes (evaluate, parse-code, search already done)

**Files:**
- Modify: `quote-app/worker/src/index.js`

**Interfaces:**
- Consumes: `evaluate`, `resolveCompanions`, `parseCode`, `priceRows` from `server/engine.js` (unchanged file); `d.loadFamilyMeta`, `d.activePriceList`.
- Produces: `POST /api/families/:id/evaluate`, `POST /api/families/:id/parse-code`; helper `priceFor(DB, priceListId, familyId, effective, segments)` used by quote-line routes in Task 7.

- [ ] **Step 1: Implement**

```js
async function priceFor(DB, priceListId, familyId, effective, segments) {
  const bases = (await DB.prepare('SELECT * FROM base_prices WHERE price_list_id=? AND family_id=?').bind(priceListId, familyId).all()).results;
  const adders = (await DB.prepare('SELECT * FROM option_prices WHERE price_list_id=? AND family_id=?').bind(priceListId, familyId).all()).results;
  return priceRows(bases, adders, effective, segments);
}

app.post('/api/families/:id/evaluate', async (c) => {
  const meta = await d.loadFamilyMeta(DB(c), +c.req.param('id'));
  if (!meta) return c.json({ error: 'family not found' }, 404);
  const body = await c.req.json();
  const result = evaluate(meta, body.selections || {});
  const priceList = await d.activePriceList(DB(c));
  if (priceList && result.complete && !result.violations.length) {
    result.price = await priceFor(DB(c), priceList.id, meta.family.id, result.effective, meta.segments);
    result.price.currency = priceList.currency;
  }
  if (result.complete && !result.violations.length) {
    result.companions = resolveCompanions(meta, result.effective);
  }
  return c.json(result);
});

app.post('/api/families/:id/parse-code', async (c) => {
  const meta = await d.loadFamilyMeta(DB(c), +c.req.param('id'));
  if (!meta) return c.json({ error: 'family not found' }, 404);
  const body = await c.req.json();
  return c.json(parseCode(meta, String(body.code || '')));
});
```

- [ ] **Step 2: Uncomment the evaluate block in parity.mjs, re-run the full parity suite**

Expected: `ALL PARITY CHECKS PASSED` — this single check proves engine parity for **every published family's default configuration**, including the golden codes and the ₹49,100 price (assert them explicitly too):

```bash
curl -s -X POST localhost:8787/api/families/$LD_ID/evaluate -H 'Content-Type: application/json' -d '{"selections":{}}' | python3 -c "import json,sys; r=json.load(sys.stdin); assert r['code']=='160-LD-0013-H10XP-A-0P-0-9-0-_-P-0-0', r['code']; print('golden LD ok')"
```

- [ ] **Step 3: Commit** `git commit -am "feat(worker): configurator routes; engine parity across all families"`

---

### Task 7: Port quote + line write routes (transactions via batch)

**Files:**
- Modify: `quote-app/worker/src/index.js`
- Create: `quote-app/worker/test/writes.mjs`

**Interfaces:**
- Consumes: `d.requireDraft`, `d.nextQuoteNumber`, `d.nextRevision`, `d.stampQuote`, `d.audit`, `priceFor`.
- Produces: `POST/GET/PATCH/DELETE /api/quotes*`, `/api/lines*`, `/api/quotes/:id/reorder|archive|unarchive|revise|clone`. Same status codes and guard messages as Express (BUG-1 finalize guard, SRV-5 atomicity).

- [ ] **Step 1: Port the simple writes** (create quote, patch quote, archive/unarchive, delete, add part line, patch line, delete line, reorder) using the Task 5 conversion table, copying validation (`QUOTE_STATUSES`, `CONTENT_FIELDS`, `clampPct`, `clampQty` — copy these constants/helpers verbatim into `src/index.js`) and audit calls verbatim. Multi-statement writes use `DB.batch([...])` (atomic). `lastInsertRowid` → `(await stmt.run()).meta.last_row_id`.

- [ ] **Step 2: `copyQuote` — the one structurally different port.** D1 has no interactive transactions; the new header's id is needed by the line-copy insert. Solution: `UNIQUE(number, revision)` identifies the new header inside one atomic batch:

```js
async function copyQuote(DB, q, mode, actor) {
  const number = mode === 'revision' ? q.number : await d.nextQuoteNumber(DB);
  const revision = mode === 'revision' ? await d.nextRevision(DB, q.number) : 'A';
  if (mode === 'revision' && !revision) {
    return { error: { error: `Quote ${q.number} has reached its last revision letter (Z). Create a new quote instead.` }, status: 409 };
  }
  // One atomic batch (SRV-5): header + line copies + audit succeed or fail together.
  // The new header row is addressed by its UNIQUE(number, revision) key.
  const who = actor || 'demo';
  await DB.batch([
    DB.prepare(`INSERT INTO quotes(number,revision,customer_id,status,currency,quote_date,validity_days,terms,notes,discount_pct,tax_pct,created_by,updated_by)
      VALUES (?,?,?,?,?, date('now'), ?,?,?,?,?,?,?)`)
      .bind(number, revision, q.customer_id, 'Draft', q.currency, q.validity_days, q.terms, q.notes, q.discount_pct, q.tax_pct, who, who),
    DB.prepare(`INSERT INTO quote_lines(quote_id,line_no,kind,family_id,part_id,ordering_code,description,config_json,spec_summary,companions_json,qty,unit_price,price_breakdown,poa,availability,discount_pct)
      SELECT (SELECT id FROM quotes WHERE number=? AND revision=?), line_no, kind, family_id, part_id, ordering_code, description, config_json, spec_summary, companions_json, qty, unit_price, price_breakdown, poa, availability, discount_pct
      FROM quote_lines WHERE quote_id=? ORDER BY line_no`)
      .bind(number, revision, q.id),
    DB.prepare(`INSERT INTO audit_log(actor,action,entity,entity_id,detail)
      VALUES (?,?, 'quote', (SELECT id FROM quotes WHERE number=? AND revision=?), ?)`)
      .bind(who, mode === 'revision' ? 'revise' : 'clone', number, revision, JSON.stringify({ from: q.id, number, revision })),
  ]);
  return { quote: await DB.prepare('SELECT * FROM quotes WHERE number=? AND revision=?').bind(number, revision).first() };
}
```

- [ ] **Step 3: Port the configured-line routes** (`POST /api/quotes/:id/lines` config branch, `PATCH /api/lines/:id/reconfigure`): copy the Express logic verbatim, replacing `loadFamilyMeta`/`priceConfiguration` with `await d.loadFamilyMeta`/`await priceFor`, and the insert+stamp+audit trio with a `DB.batch`. The `spec` mapping loop is pure — copy verbatim.

- [ ] **Step 4: Write test/writes.mjs** — self-cleaning functional suite against the Worker (localhost:8787), asserting for each flow (create → add config line via LD defaults → line has golden code and price 49100 → patch qty → mark Sent → content edit returns **409** → revise → revision B has same line count → clone → new number rev A → archive/unarchive → delete all created quotes → final quote count equals starting count). Assert every status code explicitly. ~120 lines, plain fetch + assert, `X-Actor: sales`.

- [ ] **Step 5: Run** `node test/writes.mjs` → `ALL WRITE TESTS PASSED, db restored to baseline`.

- [ ] **Step 6: Commit** `git commit -am "feat(worker): quote/line write routes with atomic batch transactions"`

---

### Task 8: Port admin write routes

**Files:**
- Modify: `quote-app/worker/src/index.js`
- Create: `quote-app/worker/test/admin-writes.mjs`

**Interfaces:**
- Consumes: `d.touchFamily`, `d.segmentFamilyId`, `d.optionFamilyId`, `d.partFamilyIds`, `d.activePriceList`, `d.audit`, `d.loadFamilyMeta`.
- Produces: all `/api/admin/*` write endpoints (categories CRUD, families create/patch/publish/archive/unarchive, segments, rules CRUD, options, base-prices CRUD, option-prices CRUD, parts create/patch with `setPartFamilies`/`setPartPrice` as batches).

- [ ] **Step 1: Port mechanically** per the Task 5 table; `setPartFamilies` becomes:

```js
async function setPartFamilies(DB, partId, familyIds) {
  const ids = [...new Set((familyIds || []).map((x) => +x).filter(Boolean))];
  await DB.batch([
    DB.prepare('DELETE FROM part_families WHERE part_id=?').bind(partId),
    ...ids.map((fid) => DB.prepare('INSERT OR IGNORE INTO part_families(part_id, family_id) VALUES (?,?)').bind(partId, fid)),
    DB.prepare('UPDATE parts SET family_id=? WHERE id=?').bind(ids[0] || null, partId),
  ]);
  return ids;
}
```

The publish validation gate (`/api/admin/families/:id/publish`) copies its problems-list logic verbatim (it only needs `loadFamilyMeta`).

- [ ] **Step 2: test/admin-writes.mjs** — self-cleaning: create category → duplicate code returns 409 → create draft family → publish fails 400 (no segments) → add segment + 2 options → publish succeeds → add a base price + option adder → evaluate returns priced result → create part linked to family → patch part price → delete category with family fails 409 → cleanup (delete rules/options/segments/family via API or direct local-D1 execute) → counts restored.

- [ ] **Step 3: Run it, expect all pass. Commit** `git commit -am "feat(worker): admin write routes + functional suite"`

---

### Task 9: Backups/export replacement + error handler

**Files:**
- Modify: `quote-app/worker/src/index.js`

**Interfaces:**
- Produces: `GET /api/admin/backups` → `[]` plus `{ mode: 'd1-time-travel', note }` wrapper is **not** used — keep the array shape the client expects, but empty; `POST /api/admin/backups` → `{ ok: true, file: null, note: 'Backups are automatic on Cloudflare D1 (Time Travel, 30-day point-in-time restore).' }`; `GET /api/admin/export` → JSON dump of all 16 tables with `Content-Disposition: attachment`.

- [ ] **Step 1: Implement**

```js
const EXPORT_TABLES = ['categories','families','segments','options','rules','companion_links','parts','part_families','price_lists','base_prices','option_prices','part_prices','customers','quotes','quote_lines','audit_log'];

// D1 Time Travel replaces file snapshots (NFR-4): restore via
//   wrangler d1 time-travel restore epe-quote --timestamp=<ISO>
app.get('/api/admin/backups', (c) => c.json([]));
app.post('/api/admin/backups', async (c) => {
  await d.audit(DB(c), c.req.header('x-actor'), 'backup', 'database', '', { mode: 'd1-time-travel' });
  return c.json({ ok: true, file: null, note: 'Backups are automatic on Cloudflare D1 (Time Travel, 30-day point-in-time restore).' });
});
// No lock-in: full-database export as JSON, downloadable anytime.
app.get('/api/admin/export', async (c) => {
  const out = {};
  for (const t of EXPORT_TABLES) out[t] = (await DB(c).prepare(`SELECT * FROM ${t}`).all()).results;
  c.header('Content-Disposition', `attachment; filename="epe-quote.${new Date().toISOString().slice(0, 10)}.json"`);
  return c.json(out);
});
```

- [ ] **Step 2: Error handler** (replaces Express middleware; D1 surfaces SQLite errors as message text, not `err.code`):

```js
app.onError((err, c) => {
  if (err.httpStatus) return c.json({ error: err.message }, err.httpStatus);
  const msg = String(err.cause?.message || err.message || '');
  if (/UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(msg)) {
    return c.json({ error: 'That record already exists (duplicate key).' }, 409);
  }
  if (/FOREIGN KEY constraint failed/i.test(msg)) {
    return c.json({ error: 'A referenced record does not exist.' }, 400);
  }
  if (/NOT NULL constraint failed|CHECK constraint failed/i.test(msg)) {
    return c.json({ error: 'The request is missing or has an invalid required value.' }, 400);
  }
  console.error('[error]', c.req.method, c.req.path, '-', msg);
  return c.json({ error: 'Internal server error' }, 500);
});
```

- [ ] **Step 3: Test** — duplicate customer part_number via `POST /api/admin/parts` twice → second returns 409 with the exact message; export returns all 16 tables with correct row counts (compare against `wrangler d1 execute --command "SELECT COUNT(*)…"`); add both checks to `admin-writes.mjs`.

- [ ] **Step 4: Commit** `git commit -am "feat(worker): D1-native backups/export + constraint-mapped error handler"`

---

### Task 10: Full local verification (parity + writes + E2E)

**Files:**
- Create: `quote-app/worker/test/run-all.sh`

- [ ] **Step 1: run-all.sh** — one command that: kills stragglers on 4781/8787, resets local D1 (`rm -rf .wrangler/state`, schema, fresh `export-data.sh` dump, import), starts Express (4781) + wrangler dev (8787), waits for both, runs `parity.mjs`, `writes.mjs`, `admin-writes.mjs` in sequence, kills both servers, exits non-zero on any failure.

- [ ] **Step 2: Run it** → all three suites green.

- [ ] **Step 3: Client build + E2E in the browser** — `npm run build --prefix ../client`, start wrangler dev, then drive `http://localhost:8787` in the browser: dashboard renders with real counts; open a quote; configure an LD from the catalog and see the golden code + ₹49,100; create a quote, add the line, revise it, verify the lock message on a Sent quote; Admin tab loads families and audit. Delete the created quote afterwards (self-cleaning).

- [ ] **Step 4: Verify Express is still untouched** — `git diff main -- quote-app/server/` shows ONLY the `engine.js` pricing extraction; run `node server/sweep.js` once more → green.

- [ ] **Step 5: Commit** `git commit -am "test(worker): one-shot verification harness; full local suite green"`

---

### Task 11: Documentation

**Files:**
- Modify: `quote-app/README.md` (add a "Cloudflare deployment" section)
- Create: `quote-app/worker/README.md` (bindings, local dev, test commands, Time Travel restore, cutover runbook from Task 12/13)

- [ ] Write both, commit: `git commit -am "docs: worker deployment + runbook"`

---

### Task 12: Provision Cloudflare + first deploy + Access

**Files:**
- Modify: `quote-app/worker/wrangler.jsonc` (real `database_id`)

- [ ] **Step 1: Authenticate** — user runs `! wrangler login` (interactive; needs the browser).

- [ ] **Step 2: Create the production D1 database and record its id**

```bash
cd quote-app/worker && wrangler d1 create epe-quote
# paste the returned database_id into wrangler.jsonc
```

- [ ] **Step 3: Load schema + fresh data into production D1**

```bash
./export-data.sh                       # fresh dump from the local repo db
wrangler d1 execute epe-quote --remote --file=./schema.sql
wrangler d1 execute epe-quote --remote --file=./data.sql
wrangler d1 execute epe-quote --remote --command "SELECT (SELECT COUNT(*) FROM quotes),(SELECT COUNT(*) FROM families),(SELECT COUNT(*) FROM parts),(SELECT COUNT(*) FROM categories)"
```
Expected: baseline counts.

- [ ] **Step 4: Deploy**

```bash
npm run build --prefix ../client && wrangler deploy
```
Expected: a `*.workers.dev` URL. Smoke: `/api/catalog` returns categories; `/` serves the app; evaluate LD default returns the golden code.

- [ ] **Step 5: Protect it — Cloudflare Access.** In the Cloudflare dashboard (Zero Trust → Access → Applications): add the workers.dev hostname, policy = allow only the EPE/Nexivo team emails (or a One-Time PIN for the customer's domain). Verify an incognito request to `/api/quotes` is intercepted by the Access login, not served. **Do not share the URL before this step.**

- [ ] **Step 6: Commit** `git commit -am "chore(worker): production D1 binding + first deploy"`

---

### Task 13: Cutover runbook (executed only when the user says go)

- [ ] 1. Announce a pause; stop the Desktop server: `kill <pid of node server/index.js in ~/Desktop/Nexivo-India/EPE>`.
- [ ] 2. Copy the final Desktop database into the repo with **`sqlite3 <desktop-db> ".backup quote-app/server/epe-quote.db"` — NEVER a plain `cp`**. A file copy of a live/just-closed WAL database can produce a torn snapshot; this actually happened in Task 1 and silently corrupted catalog flags (wrong ordering codes). `.backup` is consistent. (If you must cp, first open the source once with sqlite3 and `PRAGMA wal_checkpoint(TRUNCATE)`.)
- [ ] 3. Re-import production D1: wipe and reload — `wrangler d1 execute epe-quote --remote --file=./schema-reset.sql` (a generated file of `DROP TABLE IF EXISTS …` for the **16 business tables only** + schema.sql content), then `./export-data.sh && wrangler d1 execute epe-quote --remote --file=./data.sql`. **The `users` table is deliberately NOT in schema-reset.sql or export-data.sh, so auth accounts (incl. `ramki@nexivo.co`) survive the re-import untouched — do not drop or re-seed them on the normal path.**
- [ ] 4. Verify: business counts vs `/api/admin/summary`, spot-check the latest quote in the deployed UI, and confirm auth survived — `wrangler d1 execute epe-quote --remote --command "SELECT count(*) FROM users"` ≥ 1 plus one real UI login. (Only if production D1 is ever recreated from scratch: re-run `wrangler d1 execute epe-quote --remote --file=./auth-schema.sql`, `node seed-admin.mjs --email ramki@nexivo.co --name "Ramki" --role admin --remote`, and `wrangler secret put SESSION_SECRET`.)
- [ ] 5. Users switch to the Workers URL. Desktop folder is archived (nothing deleted).
- [ ] 6. Merge `cloudflare-migration` → `main`, push, commit final state.

---

## Testing strategy summary (gates)

| Gate | After task | Proves | Command |
|---|---|---|---|
| G0 baseline | 1 | recorded truth to compare against | sweep + counts + golden codes |
| G1 engine intact | 2 | pricing refactor changed nothing | `node server/sweep.js` (37,007 checks) |
| G2 read parity | 5–6 | Worker returns byte-identical JSON for every read endpoint + every family's default evaluation | `test/parity.mjs` |
| G3 write correctness | 7–8 | guards (409 lock, Z-revision), atomicity, audit, self-cleaning | `test/writes.mjs`, `test/admin-writes.mjs` |
| G4 integrated | 10 | one command, everything green + browser E2E | `test/run-all.sh` |
| G5 production | 12 | deployed app = local app; locked behind Access | remote smoke + incognito check |
| G6 cutover | 13 | zero data loss | count + latest-quote verification |

## Rollback

At any point before Task 13: nothing to roll back — the Express app and Desktop deployment were never touched. After cutover: the final database copy is in git and on the Desktop; restarting the Desktop server restores the old world instantly. D1 Time Travel gives 30-day point-in-time restore on the cloud side.
