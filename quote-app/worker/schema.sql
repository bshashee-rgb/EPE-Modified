CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sort INTEGER DEFAULT 0
  );
CREATE TABLE families (
    id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    code TEXT UNIQUE NOT NULL,           -- e.g. LD, AS, PST3
    name TEXT NOT NULL,
    description TEXT,
    datasheet_ref TEXT,                  -- e.g. EPE/05.001/LD Rev.9/09-2024
    kind TEXT NOT NULL DEFAULT 'configurable',  -- configurable | fixed_part_group | fixed_bom
    code_template TEXT,                  -- JSON: { separator, prefixSegments?, suffixNote? }
    status TEXT NOT NULL DEFAULT 'published',   -- draft | published | retired
    updated_at TEXT,                     -- last metadata change (shown as catalogue freshness)
    sort INTEGER DEFAULT 0
  );
CREATE TABLE segments (
    id INTEGER PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    key TEXT NOT NULL,                   -- machine key e.g. 'pressure', 'size'
    name TEXT NOT NULL,                  -- display name e.g. 'Max working pressure'
    position INTEGER NOT NULL,           -- order in ordering code & UI
    selection_type TEXT NOT NULL DEFAULT 'single', -- single | multi | numeric | text
    required INTEGER NOT NULL DEFAULT 1,
    in_code INTEGER NOT NULL DEFAULT 1,  -- rendered into ordering code?
    code_prefix TEXT DEFAULT '',         -- e.g. 'PO:' for precharge
    numeric_unit TEXT,                   -- bar, mm, ml ...
    help TEXT,
    UNIQUE(family_id, key)
  );
CREATE TABLE options (
    id INTEGER PRIMARY KEY,
    segment_id INTEGER NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                  -- code that appears in ordering code
    label TEXT NOT NULL,                 -- commercial meaning
    is_standard INTEGER NOT NULL DEFAULT 0,
    on_request INTEGER NOT NULL DEFAULT 0,  -- availability to be confirmed
    price_on_application INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',  -- active | retired
    sort INTEGER DEFAULT 0,
    UNIQUE(segment_id, code)
  );
CREATE TABLE rules (
    id INTEGER PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    rule TEXT NOT NULL,                  -- JSON
    note TEXT
  );
CREATE TABLE companion_links (
    id INTEGER PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    link TEXT NOT NULL,                  -- JSON
    note TEXT
  );
CREATE TABLE parts (
    id INTEGER PRIMARY KEY,
    family_id INTEGER REFERENCES families(id) ON DELETE SET NULL,
    part_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active'
  );
CREATE TABLE price_lists (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'published'
  );
CREATE TABLE base_prices (
    id INTEGER PRIMARY KEY,
    price_list_id INTEGER NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    match TEXT NOT NULL DEFAULT '{}',    -- JSON {segKey: code} exact-match (most specific wins)
    amount REAL NOT NULL
  );
CREATE TABLE option_prices (
    id INTEGER PRIMARY KEY,
    price_list_id INTEGER NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    segment_key TEXT NOT NULL,
    option_code TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'abs',    -- abs | pct
    amount REAL NOT NULL
  );
CREATE TABLE part_prices (
    id INTEGER PRIMARY KEY,
    price_list_id INTEGER NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    amount REAL NOT NULL
  );
CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT, email TEXT, phone TEXT, address TEXT, gstin TEXT
  );
CREATE TABLE quotes (
    id INTEGER PRIMARY KEY,
    number TEXT NOT NULL,                 -- Q-2026-0001 (shared across revisions)
    revision TEXT NOT NULL DEFAULT 'A',
    customer_id INTEGER REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'Draft',  -- Draft|Sent|Won|Lost|Expired
    currency TEXT NOT NULL DEFAULT 'INR',
    fx_rate REAL NOT NULL DEFAULT 1,      -- INR -> currency snapshot, set when currency last changed
    quote_date TEXT,                      -- issue date (editable); defaults to creation date
    validity_days INTEGER DEFAULT 30,
    terms TEXT,
    notes TEXT,
    discount_pct REAL DEFAULT 0,
    tax_pct REAL DEFAULT 18,
    archived INTEGER NOT NULL DEFAULT 0,  -- soft-hide (recoverable); Delete is separate & permanent
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')), created_by TEXT, updated_by TEXT,
    approval_status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    approved_by TEXT, approved_at TEXT, approval_notes TEXT,
    UNIQUE(number, revision)             -- a number may repeat, but not the same revision twice
  );
CREATE TABLE quote_lines (
    id INTEGER PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'config', -- config | part | custom
    family_id INTEGER REFERENCES families(id),
    part_id INTEGER REFERENCES parts(id),
    ordering_code TEXT NOT NULL,
    description TEXT,
    config_json TEXT,                    -- frozen selections snapshot
    spec_summary TEXT,                   -- frozen human-readable summary (JSON rows)
    companions_json TEXT,                -- generated companion codes snapshot
    qty REAL NOT NULL DEFAULT 1,
    unit_price REAL,
    price_breakdown TEXT,                -- JSON
    poa INTEGER NOT NULL DEFAULT 0,      -- price on application
    availability TEXT NOT NULL DEFAULT 'standard',  -- standard | to_confirm
    discount_pct REAL DEFAULT 0
  );
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL DEFAULT (datetime('now')),
    actor TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    detail TEXT
  );
CREATE TABLE part_families (
    part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    PRIMARY KEY (part_id, family_id)
  );
CREATE TABLE attachments (
    id INTEGER PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    r2_key TEXT NOT NULL,                -- R2 object key (prod/staging/sandbox)
    category TEXT NOT NULL DEFAULT 'other',  -- technical | costing | scan | other
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived INTEGER NOT NULL DEFAULT 0   -- soft-remove only, never hard DELETE
  );
CREATE INDEX idx_attachments_quote_id ON attachments(quote_id);
