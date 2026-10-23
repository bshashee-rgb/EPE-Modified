import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.EPE_DB || path.join(__dirname, 'epe-quote.db');
const BACKUP_DIR = process.env.EPE_BACKUP_DIR || path.join(path.dirname(DB_PATH), 'backups');
const MAX_BACKUPS = 40; // retention: newest N snapshots are kept

export function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');   // durable, crash-safe write-ahead log
  db.pragma('foreign_keys = ON');
  return db;
}

// ============================================================================
//  DATA-SAFETY LAYER — backups + versioned, additive-only migrations.
//  Invariant: an application update must never lose data. Enforced by
//   (1) automatic snapshots before every schema change and daily on startup,
//   (2) migrations that only ADD (columns/tables/indexes), and
//   (3) any unavoidable table rebuild asserting new columns ⊇ old columns
//       before dropping the original (so a column can never be silently lost).
// ============================================================================

// Take a consistent point-in-time copy of the database file.
export function snapshotDb(db, tag = 'manual') {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)'); // fold the WAL into the main file first
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(BACKUP_DIR, `epe-quote.${tag}.${stamp}.db`);
    fs.copyFileSync(DB_PATH, dest);
    pruneBackups();
    console.log(`[backup] snapshot → ${path.basename(dest)}`);
    return dest;
  } catch (e) {
    console.error('[backup] snapshot FAILED:', e.message);
    return null;
  }
}

export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => { const s = fs.statSync(path.join(BACKUP_DIR, f)); return { file: f, size: s.size, at: s.mtime.toISOString() }; })
    .sort((a, b) => b.at.localeCompare(a.at));
}

function pruneBackups() {
  const files = listBackups();
  for (const f of files.slice(MAX_BACKUPS)) {
    try { fs.unlinkSync(path.join(BACKUP_DIR, f.file)); } catch { /* best effort */ }
  }
}

// One routine backup per calendar day, so ordinary code/feature updates (even
// with no migration) always leave a recent restore point.
function dailySnapshot(db) {
  const today = new Date().toISOString().slice(0, 10);
  const already = listBackups().some((b) => b.file.includes(today));
  if (!already) snapshotDb(db, 'daily');
}

// ---- Migration registry. Each entry is idempotent (guarded) so re-running is
//      harmless, which lets us baseline an already-migrated database safely. ----
const MIGRATIONS = [
  { name: '001-quotes-quote_date', up(db) {
    if (!hasCol(db, 'quotes', 'quote_date')) {
      db.exec("ALTER TABLE quotes ADD COLUMN quote_date TEXT");
      db.exec("UPDATE quotes SET quote_date = date(created_at) WHERE quote_date IS NULL");
    }
  } },
  { name: '002-quotes-archived', up(db) {
    if (!hasCol(db, 'quotes', 'archived')) db.exec("ALTER TABLE quotes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  } },
  { name: '003-quotes-created_updated_by', up(db) {
    if (!hasCol(db, 'quotes', 'created_by')) db.exec("ALTER TABLE quotes ADD COLUMN created_by TEXT");
    if (!hasCol(db, 'quotes', 'updated_by')) db.exec("ALTER TABLE quotes ADD COLUMN updated_by TEXT");
  } },
  { name: '004-families-updated_at', up(db) {
    if (!hasCol(db, 'families', 'updated_at')) {
      db.exec("ALTER TABLE families ADD COLUMN updated_at TEXT");
      db.exec("UPDATE families SET updated_at = datetime('now') WHERE updated_at IS NULL");
    }
  } },
  { name: '005-part_families-backfill', up(db) {
    db.exec(`INSERT OR IGNORE INTO part_families (part_id, family_id)
             SELECT id, family_id FROM parts WHERE family_id IS NOT NULL`);
  } },
  // Rebuild toggles foreign_keys (not allowed inside a transaction), so it runs
  // outside the per-migration transaction and manages its own.
  { name: '006-quotes-composite-unique', rebuild: true, up(db) {
    const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='quotes'").get()?.sql || '';
    if (/number\s+TEXT\s+UNIQUE/i.test(sql)) rebuildQuotesComposite(db);
  } },
  { name: '007-quotes-fx_rate', up(db) {
    if (!hasCol(db, 'quotes', 'fx_rate')) db.exec("ALTER TABLE quotes ADD COLUMN fx_rate REAL NOT NULL DEFAULT 1");
  } },
  { name: '008-quotes-approval', up(db) {
    if (!hasCol(db, 'quotes', 'approval_status')) db.exec("ALTER TABLE quotes ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending'");
    if (!hasCol(db, 'quotes', 'approved_by')) db.exec("ALTER TABLE quotes ADD COLUMN approved_by TEXT");
    if (!hasCol(db, 'quotes', 'approved_at')) db.exec("ALTER TABLE quotes ADD COLUMN approved_at TEXT");
    if (!hasCol(db, 'quotes', 'approval_notes')) db.exec("ALTER TABLE quotes ADD COLUMN approval_notes TEXT");
  } },
  { name: '009-customers-gst', up(db) {
    if (!hasCol(db, 'customers', 'code')) db.exec("ALTER TABLE customers ADD COLUMN code TEXT");
    if (!hasCol(db, 'customers', 'source_state')) db.exec("ALTER TABLE customers ADD COLUMN source_state TEXT DEFAULT 'Telangana'");
    if (!hasCol(db, 'customers', 'place_of_supply_state')) db.exec("ALTER TABLE customers ADD COLUMN place_of_supply_state TEXT");
    db.exec(`UPDATE customers SET code = 'CUST-' || substr('0000' || (SELECT COUNT(*) FROM customers c2 WHERE c2.id <= customers.id), -4, 4) WHERE code IS NULL`);
    if (!hasIndex(db, 'idx_customers_code')) db.exec('CREATE UNIQUE INDEX idx_customers_code ON customers(code)');
  } },
];

const hasCol = (db, table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
const hasIndex = (db, name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(name);

// Safe rebuild: build the new table with the FULL current column set (incl.
// archived / created_by / updated_by and the customer FK), assert that every
// existing column is preserved, then copy all rows. Fixes the historical bug
// where the rebuild silently dropped columns.
function rebuildQuotesComposite(db) {
  const run = db.transaction(() => {
    db.exec(`CREATE TABLE quotes_rebuild (
      id INTEGER PRIMARY KEY,
      number TEXT NOT NULL, revision TEXT NOT NULL DEFAULT 'A',
      customer_id INTEGER REFERENCES customers(id),
      status TEXT NOT NULL DEFAULT 'Draft',
      currency TEXT NOT NULL DEFAULT 'INR', quote_date TEXT, validity_days INTEGER DEFAULT 30,
      terms TEXT, notes TEXT, discount_pct REAL DEFAULT 0, tax_pct REAL DEFAULT 18,
      archived INTEGER NOT NULL DEFAULT 0, created_by TEXT, updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(number, revision))`);
    const oldCols = db.prepare("PRAGMA table_info(quotes)").all().map((c) => c.name);
    const newCols = db.prepare("PRAGMA table_info(quotes_rebuild)").all().map((c) => c.name);
    const lost = oldCols.filter((c) => !newCols.includes(c));
    if (lost.length) throw new Error(`rebuild would drop columns: ${lost.join(', ')} — aborting to protect data`);
    const cols = oldCols.join(',');
    db.exec(`INSERT INTO quotes_rebuild (${cols}) SELECT ${cols} FROM quotes`);
    const before = db.prepare('SELECT COUNT(*) n FROM quotes').get().n;
    const after = db.prepare('SELECT COUNT(*) n FROM quotes_rebuild').get().n;
    if (before !== after) throw new Error(`rebuild row-count mismatch ${before}→${after} — aborting`);
    db.exec('DROP TABLE quotes');
    db.exec('ALTER TABLE quotes_rebuild RENAME TO quotes');
  });
  db.pragma('foreign_keys = OFF');
  try { run(); } finally { db.pragma('foreign_keys = ON'); }
}

export function runMigrations(db, opts = {}) {
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))");
  const done = new Set(db.prepare('SELECT name FROM _migrations').all().map((r) => r.name));
  const pending = MIGRATIONS.filter((m) => !done.has(m.name));
  if (!pending.length) return [];

  // Back up before mutating any real data.
  const hasData = tableExists(db, 'quotes') && db.prepare('SELECT COUNT(*) n FROM quotes').get().n > 0;
  if (opts.backup !== false && hasData) snapshotDb(db, 'pre-migration');

  const record = db.prepare('INSERT INTO _migrations(name) VALUES (?)');
  const applied = [];
  for (const m of pending) {
    if (m.rebuild) {                 // pragma-toggling migration: no outer txn
      m.up(db);
      record.run(m.name);
    } else {
      db.transaction(() => { m.up(db); record.run(m.name); })();
    }
    applied.push(m.name);
  }
  if (applied.length) console.log(`[migrate] applied: ${applied.join(', ')}`);
  return applied;
}

const tableExists = (db, name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);

export function createSchema(db, opts = {}) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sort INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    datasheet_ref TEXT,
    kind TEXT NOT NULL DEFAULT 'configurable',
    code_template TEXT,
    status TEXT NOT NULL DEFAULT 'published',
    updated_at TEXT,
    sort INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS segments (
    id INTEGER PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    selection_type TEXT NOT NULL DEFAULT 'single',
    required INTEGER NOT NULL DEFAULT 1,
    in_code INTEGER NOT NULL DEFAULT 1,
    code_prefix TEXT DEFAULT '',
    numeric_unit TEXT,
    help TEXT,
    UNIQUE(family_id, key)
  );

  CREATE TABLE IF NOT EXISTS options (
    id INTEGER PRIMARY KEY,
    segment_id INTEGER NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    label TEXT NOT NULL,
    is_standard INTEGER NOT NULL DEFAULT 0,
    on_request INTEGER NOT NULL DEFAULT 0,
    price_on_application INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    sort INTEGER DEFAULT 0,
    UNIQUE(segment_id, code)
  );

  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    rule TEXT NOT NULL,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS companion_links (
    id INTEGER PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    link TEXT NOT NULL,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS parts (
    id INTEGER PRIMARY KEY,
    family_id INTEGER REFERENCES families(id) ON DELETE SET NULL,
    part_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS part_families (
    part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    PRIMARY KEY (part_id, family_id)
  );

  CREATE TABLE IF NOT EXISTS price_lists (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'published'
  );

  CREATE TABLE IF NOT EXISTS base_prices (
    id INTEGER PRIMARY KEY,
    price_list_id INTEGER NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    match TEXT NOT NULL DEFAULT '{}',
    amount REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS option_prices (
    id INTEGER PRIMARY KEY,
    price_list_id INTEGER NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    segment_key TEXT NOT NULL,
    option_code TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'abs',
    amount REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS part_prices (
    id INTEGER PRIMARY KEY,
    price_list_id INTEGER NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    amount REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT, email TEXT, phone TEXT, address TEXT, gstin TEXT
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY,
    number TEXT NOT NULL,
    revision TEXT NOT NULL DEFAULT 'A',
    customer_id INTEGER REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'Draft',
    currency TEXT NOT NULL DEFAULT 'INR',
    fx_rate REAL NOT NULL DEFAULT 1,
    quote_date TEXT,
    validity_days INTEGER DEFAULT 30,
    terms TEXT,
    notes TEXT,
    discount_pct REAL DEFAULT 0,
    tax_pct REAL DEFAULT 18,
    archived INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    updated_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(number, revision)
  );

  CREATE TABLE IF NOT EXISTS quote_lines (
    id INTEGER PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'config',
    family_id INTEGER REFERENCES families(id),
    part_id INTEGER REFERENCES parts(id),
    ordering_code TEXT NOT NULL,
    description TEXT,
    config_json TEXT,
    spec_summary TEXT,
    companions_json TEXT,
    qty REAL NOT NULL DEFAULT 1,
    unit_price REAL,
    price_breakdown TEXT,
    poa INTEGER NOT NULL DEFAULT 0,
    availability TEXT NOT NULL DEFAULT 'standard',
    discount_pct REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL DEFAULT (datetime('now')),
    actor TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    detail TEXT
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_attachments_quote_id ON attachments(quote_id);

  CREATE TABLE IF NOT EXISTS clarifications (
    id INTEGER PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'Clarification',
    query_type TEXT NOT NULL,
    question TEXT NOT NULL,
    raised_at TEXT NOT NULL DEFAULT (datetime('now')),
    raised_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    response TEXT,
    responded_at TEXT,
    responded_by TEXT,
    archived INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_clarifications_quote_id ON clarifications(quote_id);
  `);

  // Routine daily restore point (protects against non-migration code changes too).
  if (opts.backup) dailySnapshot(db);
  // Versioned, additive-only migrations (snapshots before mutating real data).
  runMigrations(db, { backup: opts.backup });
}
