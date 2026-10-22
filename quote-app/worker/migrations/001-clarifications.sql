-- 001-clarifications.sql
-- Adds post-offer clarification/TAT tracking to an EXISTING D1 database. Additive only.
--
-- Numbering note: this branch (feature/clarifications-tat) was cut from `main` before the
-- Attachments feature's migrations/001-attachments.sql merged. If both land in the same
-- environment, apply whichever merged first as 001 and renumber this one to the next integer
-- (e.g. 002-clarifications.sql) — they touch disjoint tables/columns so order between them
-- doesn't matter functionally, only the filename numbering needs to stay sequential.
--
-- D1 has no `_migrations` tracking table, so this file is NOT idempotent — run it exactly ONCE
-- per environment:
--   npx wrangler d1 execute epe-quote-sandbox --remote --file=./migrations/001-clarifications.sql
--
-- A fresh database built from schema.sql already has this shape — only apply this file to a
-- database that predates it.

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
