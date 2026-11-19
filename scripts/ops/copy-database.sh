#!/usr/bin/env bash
# Copies the public schema of one Postgres database to another, streaming (nothing is written to
# disk), then compares row counts per table. The target must be empty unless FORCE=1.
#
#   SOURCE_URL=postgres://... TARGET_URL=postgres://... scripts/ops/copy-database.sh
#
# PG_IMAGE must be at least the source server's major version and not newer than the target's.
set -euo pipefail

: "${SOURCE_URL:?set SOURCE_URL}" "${TARGET_URL:?set TARGET_URL}"
[ "$SOURCE_URL" != "$TARGET_URL" ] || { echo "source and target are the same" >&2; exit 1; }
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"

pg() { docker run --rm -i -e PGCONNECT_TIMEOUT=15 "$PG_IMAGE" "$@"; }

tables() {
  pg psql -At "$1" -c "SELECT table_name || ' ' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1"
}

existing=$(pg psql -At "$TARGET_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
if [ "$existing" != "0" ] && [ "${FORCE:-}" != "1" ]; then
  echo "target already has $existing tables; set FORCE=1 to replace them" >&2
  exit 1
fi

pg pg_dump --format=custom --schema=public --no-owner --no-acl "$SOURCE_URL" |
  pg pg_restore --no-owner --no-acl --clean --if-exists --exit-on-error --dbname="$TARGET_URL"

if diff <(tables "$SOURCE_URL") <(tables "$TARGET_URL"); then
  echo "copied: every table has the same row count"
else
  echo "row counts differ (see above)" >&2
  exit 1
fi
