#!/bin/sh
# Restores a backup made by backup.sh into the running Postgres container.
#   ./restore.sh hub-2026-11-19T031500Z.dump.age /path/to/age-private-key.txt
# This REPLACES the database contents. Rehearse it on a scratch server before you need it.
set -eu
[ "$#" -eq 2 ] || { echo "usage: $0 <backup-name> <age-private-key-file>" >&2; exit 2; }
cd "$(dirname "$0")"
set -a
. ./.env
set +a

rclone cat "${BACKUP_RCLONE_REMOTE}/$1" \
  | age -d -i "$2" \
  | docker compose exec -T postgres pg_restore -U hub -d hub --clean --if-exists --no-owner
echo "restored $1"
