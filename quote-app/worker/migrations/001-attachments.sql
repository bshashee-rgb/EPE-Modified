-- 001-attachments.sql
-- Adds file attachments + manager approval status to an EXISTING D1 database.
-- Additive only (new table + new columns) — safe to run against a live database with data.
--
-- D1 has no `_migrations` tracking table (unlike the local Express `server/db.js`), so this
-- file is NOT idempotent — the ALTER TABLE lines error if run twice. Run it exactly ONCE per
-- environment:
--   npx wrangler d1 execute epe-quote-sandbox --remote --file=./migrations/001-attachments.sql
--
-- A fresh database built from schema.sql already has this shape — only apply this file to a
-- database that predates it.

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

ALTER TABLE quotes ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE quotes ADD COLUMN approved_by TEXT;
ALTER TABLE quotes ADD COLUMN approved_at TEXT;
ALTER TABLE quotes ADD COLUMN approval_notes TEXT;
