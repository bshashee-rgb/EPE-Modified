// Data-safety regression tests (FR-A28): prove the migration/backup framework never
// loses data. Run with:  node server/test-migrations.mjs
// Two cases: (1) round-trip the REAL database through the upgrade path unchanged;
// (2) migrate a synthetic LEGACY-schema database and assert every row/column survives.
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(here, '.migration-test');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
const LIVE = path.join(here, 'epe-quote.db');

let pass = 0, fail = 0;
const chk = (n, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS' : 'FAIL') + ' ' + n + (x ? '  -> ' + x : '')); };

async function importDbWith(dbPath) {
  process.env.EPE_DB = dbPath;
  process.env.EPE_BACKUP_DIR = path.join(TMP, 'backups');
  // cache-bust so DB_PATH is recomputed per case
  return import('./db.js?case=' + encodeURIComponent(dbPath));
}

// ---- Case 1: real DB round-trip (skipped gracefully if no live DB) ----
if (fs.existsSync(LIVE)) {
  const copy = path.join(TMP, 'rt.db');
  fs.copyFileSync(LIVE, copy);
  const T = ['quotes', 'quote_lines', 'families', 'segments', 'options', 'rules', 'parts', 'part_families', 'categories', 'base_prices', 'option_prices', 'customers', 'audit_log'];
  const raw = new Database(copy);
  const before = Object.fromEntries(T.filter(t => raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t)).map(t => [t, raw.prepare('SELECT COUNT(*) n FROM ' + t).get().n]));
  raw.close();
  const { openDb, createSchema } = await importDbWith(copy);
  const db = openDb(); createSchema(db, { backup: true });
  const after = Object.fromEntries(Object.keys(before).map(t => [t, db.prepare('SELECT COUNT(*) n FROM ' + t).get().n]));
  db.close();
  chk('real DB round-trip: all row counts unchanged', Object.keys(before).every(t => before[t] === after[t]), JSON.stringify(before));
} else {
  console.log('SKIP real DB round-trip (no epe-quote.db present)');
}

// ---- Case 2: synthetic legacy schema ----
const legacy = path.join(TMP, 'legacy.db');
const lg = new Database(legacy);
lg.exec(`
  CREATE TABLE categories (id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, sort INTEGER DEFAULT 0);
  CREATE TABLE families (id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT 'published');
  CREATE TABLE parts (id INTEGER PRIMARY KEY, family_id INTEGER, part_number TEXT UNIQUE NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT 'active');
  CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
  CREATE TABLE quotes (id INTEGER PRIMARY KEY, number TEXT UNIQUE NOT NULL, revision TEXT NOT NULL DEFAULT 'A',
    customer_id INTEGER, status TEXT NOT NULL DEFAULT 'Draft', currency TEXT DEFAULT 'INR', validity_days INTEGER DEFAULT 30,
    terms TEXT, notes TEXT, discount_pct REAL DEFAULT 0, tax_pct REAL DEFAULT 18,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
`);
lg.prepare("INSERT INTO categories(id,code,name) VALUES (1,'FIL','Filters')").run();
lg.prepare("INSERT INTO families(id,category_id,code,name) VALUES (1,1,'LD','LD Filter')").run();
lg.prepare("INSERT INTO parts(id,family_id,part_number,name) VALUES (1,1,'BYP01','Bypass valve')").run();
lg.prepare("INSERT INTO quotes(id,number,revision,status,created_at) VALUES (1,'Q-2025-0001','A','Won','2025-01-02 10:00:00')").run();
lg.close();

const { openDb: openL, createSchema: createL } = await importDbWith(legacy);
const db = openL(); createL(db, { backup: true });
const cols = db.prepare('PRAGMA table_info(quotes)').all().map(c => c.name);
chk('legacy: quote_date/archived/created_by/updated_by added', ['quote_date', 'archived', 'created_by', 'updated_by'].every(c => cols.includes(c)));
const q1 = db.prepare('SELECT * FROM quotes WHERE id=1').get();
chk('legacy: original quote data intact', q1.number === 'Q-2025-0001' && q1.status === 'Won' && q1.created_at === '2025-01-02 10:00:00');
chk('legacy: family & part rows intact', db.prepare('SELECT name FROM families WHERE id=1').get().name === 'LD Filter' && !!db.prepare("SELECT 1 FROM parts WHERE part_number='BYP01'").get());
let revOk = false; try { db.prepare("INSERT INTO quotes(number,revision,status) VALUES ('Q-2025-0001','B','Draft')").run(); revOk = true; } catch { /* */ }
chk('legacy: composite UNIQUE(number,revision) upgrade allows a Rev B', revOk);
db.close();

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nData-safety: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
