#!/usr/bin/env bash
# Dump DATA ONLY from the live sqlite file, in an order that satisfies FKs,
# stripped of PRAGMA/TRANSACTION statements (D1 rejects them).
set -euo pipefail
DB="${1:-../server/epe-quote.db}"
OUT="${2:-data.sql}"
TABLES="categories families segments options rules companion_links parts part_families price_lists base_prices option_prices part_prices customers quotes quote_lines audit_log clarifications"
: > "$OUT"
for t in $TABLES; do
  # Explicit column list, not just positional VALUES(...): the source (Express
  # sqlite) and target (D1) schemas are maintained independently and can drift
  # in column ORDER (e.g. quotes.fx_rate) even when column NAMES match. A bare
  # "INSERT INTO t VALUES(...)" silently shifts values into the wrong columns
  # on import instead of erroring — matching by name avoids that entirely.
  cols="$(sqlite3 "$DB" "PRAGMA table_info($t);" | cut -d'|' -f2 | paste -sd, -)"
  sqlite3 "$DB" ".mode insert $t" "SELECT * FROM $t;" \
    | sed "s/^INSERT INTO $t VALUES(/INSERT INTO $t ($cols) VALUES(/" >> "$OUT"
done
echo "wrote $OUT: $(grep -c 'INSERT INTO' $OUT) rows"
