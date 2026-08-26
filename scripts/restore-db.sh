#!/usr/bin/env bash
# Restores a gzip'd pg_dump (produced by backup-db.sh) into a NEW, separate
# database for verification. This script refuses to target the production
# database name — restoring a backup is for proving the backup is good,
# never for overwriting live data. To actually recover production from a
# backup, that is a deliberate, manual, human-supervised operation outside
# the scope of this script.
#
# Usage:
#   ./scripts/restore-db.sh backups/avtobirzhasi_20260826T120000Z.sql.gz
#   ./scripts/restore-db.sh <dump.sql.gz> my_custom_check_db_name
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DUMP_FILE="${1:?Usage: restore-db.sh <dump.sql.gz> [target-db-name]}"
TARGET_DB="${2:-avtobirzhasi_restore_check}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Dump file not found: $DUMP_FILE" >&2
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER is not set — run this next to docker-compose.prod.yml with .env present}"
: "${POSTGRES_DB:?POSTGRES_DB is not set}"

if [ "$TARGET_DB" = "$POSTGRES_DB" ]; then
  echo "Refusing to restore into '$TARGET_DB' — that is the production database name." >&2
  echo "Pick a different target-db argument." >&2
  exit 1
fi

echo "Creating scratch database '${TARGET_DB}' (dropping it first if a previous check left it behind)..."
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS ${TARGET_DB};"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
  -c "CREATE DATABASE ${TARGET_DB};"

echo "Restoring ${DUMP_FILE} into '${TARGET_DB}'..."
gunzip -c "$DUMP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "${TARGET_DB}"

echo
echo "Restore verification — tables now in '${TARGET_DB}':"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "${TARGET_DB}" -c "\dt"

echo
echo "Done. This scratch database is NOT used by the application — drop it once you're satisfied:"
echo "  docker compose -f $COMPOSE_FILE exec postgres psql -U $POSTGRES_USER -d postgres -c 'DROP DATABASE ${TARGET_DB};'"
