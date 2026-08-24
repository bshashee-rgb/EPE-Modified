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
