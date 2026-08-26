#!/usr/bin/env bash
# Takes a timestamped, gzip-compressed pg_dump of the production database
# via the running `postgres` service in docker-compose.prod.yml, and
# prunes backups older than RETENTION_DAYS. Run this from the same
# directory as docker-compose.prod.yml on the VPS (where .env already
# lives for `docker compose` itself to read POSTGRES_DB/POSTGRES_USER).
#
# No password is ever read or passed here: pg_dump runs *inside* the
# postgres container and connects over the container's local Unix
# socket, which the official postgres image's default pg_hba.conf trusts
# unconditionally for local connections — the same reason `psql` works
# inside that container without -h/-W. This was verified locally against
# a throwaway dev database before being written into this script; see
# STAGE8_PRODUCTION_READINESS_REPORT.md's Backups section.
#
# Usage:
#   ./scripts/backup-db.sh
#   BACKUP_DIR=/var/backups/avtobirzhasi RETENTION_DAYS=30 ./scripts/backup-db.sh
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${POSTGRES_DB:?POSTGRES_DB is not set — run this next to docker-compose.prod.yml with .env present}"
: "${POSTGRES_USER:?POSTGRES_USER is not set}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out_file="$BACKUP_DIR/avtobirzhasi_${timestamp}.sql.gz"
tmp_file="${out_file}.partial"

echo "Backing up database '${POSTGRES_DB}' -> ${out_file}"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges \
  | gzip > "$tmp_file"
mv "$tmp_file" "$out_file"

echo "Backup written: $out_file ($(du -h "$out_file" | cut -f1))"

echo "Pruning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}"
find "$BACKUP_DIR" -maxdepth 1 -name 'avtobirzhasi_*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete
