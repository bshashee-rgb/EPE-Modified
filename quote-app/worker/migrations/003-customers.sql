-- 003-customers.sql
-- Adds a generated customer code and GST source/place-of-supply state fields to an EXISTING
-- D1 database. Additive only (new columns on customers, no changes to existing ones).
--
-- D1 has no `_migrations` tracking table, so this file is NOT idempotent -- run it exactly ONCE
-- per environment:
--   npx wrangler d1 execute epe-quote-sandbox --remote --file=./migrations/003-customers.sql
--
-- A fresh database built from schema.sql already has this shape -- only apply this file to a
-- database that predates it.

ALTER TABLE customers ADD COLUMN code TEXT;
ALTER TABLE customers ADD COLUMN source_state TEXT DEFAULT 'Telangana';
ALTER TABLE customers ADD COLUMN place_of_supply_state TEXT;

-- Backfill a sequential CUST-0001, CUST-0002, ... code for existing rows, in id (creation) order.
UPDATE customers
SET code = 'CUST-' || substr('0000' || (SELECT COUNT(*) FROM customers c2 WHERE c2.id <= customers.id), -4, 4)
WHERE code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_code ON customers(code);
