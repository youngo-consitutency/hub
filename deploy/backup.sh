#!/bin/sh
# Nightly encrypted database backup, run by cron (see deploy/crontab).
# Streams pg_dump through age (public-key encryption, so the server cannot read old backups back)
# into an S3-compatible bucket with rclone, then deletes backups older than BACKUP_KEEP_DAYS.
# Needs on the host: docker compose, age, rclone (configured with a remote named in .env).
set -eu
cd "$(dirname "$0")"
set -a
. ./.env
set +a

stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
name="hub-${stamp}.dump.age"

docker compose exec -T postgres pg_dump -U hub -d hub --format=custom \
  | age -r "${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT}" \
  | rclone rcat "${BACKUP_RCLONE_REMOTE:?set BACKUP_RCLONE_REMOTE}/${name}"

# an empty or truncated upload must fail loudly, not look like a backup
size="$(rclone size --json "${BACKUP_RCLONE_REMOTE}/${name}" | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')"
if [ "${size:-0}" -lt 1024 ]; then
  echo "backup ${name} is suspiciously small (${size:-0} bytes)" >&2
  exit 1
fi

rclone delete "${BACKUP_RCLONE_REMOTE}" --min-age "${BACKUP_KEEP_DAYS:-30}d"
echo "backup ${name} ok (${size} bytes)"
