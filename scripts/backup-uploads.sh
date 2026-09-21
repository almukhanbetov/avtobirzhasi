#!/usr/bin/env bash
# Takes a timestamped, gzip-compressed tar archive of the production
# uploads volume (seller-uploaded listing photos) using plain `docker run`
# + `tar` — no dependency on the backend container actually running, so
# this is safe to call before `docker compose up -d` (e.g. right before
# migrations, during a deploy). Run this from the same directory as
# docker-compose.prod.yml on the VPS.
#
# The volume is resolved via its Compose labels (project + volume key),
# never a hardcoded literal name: docker-compose.prod.yml sets an explicit
# `name: avtobirzhasi` project name, so Compose's actually-resolved volume
# name is "avtobirzhasi_avtobirzhasi_uploads" — not the shorter
# "avtobirzhasi_uploads" used informally elsewhere in this repo's docs
# (confirmed by running `docker compose -f docker-compose.prod.yml config`
# and inspecting a volume it created). Passing the wrong literal name to
# `docker run -v <name>:...` would not fail loudly: Docker silently
# auto-creates a new EMPTY volume by that name and happily backs that up
# instead, producing a "successful" backup of nothing. Resolving by label
# avoids that trap, and keeps working even if the naming scheme changes.
#
# Deliberately does NOT prune old archives (unlike backup-db.sh) — nothing
# else in this project creates uploads backups yet, so there is no
# established retention policy for them to follow.
#
# Usage:
#   ./scripts/backup-uploads.sh
#   BACKUP_DIR=/var/backups/avtobirzhasi ./scripts/backup-uploads.sh
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT:-avtobirzhasi}"
COMPOSE_VOLUME_KEY="${COMPOSE_VOLUME_KEY:-avtobirzhasi_uploads}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

VOLUME_NAME=$(docker volume ls -q \
  --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
  --filter "label=com.docker.compose.volume=${COMPOSE_VOLUME_KEY}")

if [ -z "$VOLUME_NAME" ]; then
  echo "ERROR: could not resolve the uploads volume (project=${COMPOSE_PROJECT}, volume key=${COMPOSE_VOLUME_KEY})." >&2
  echo "Refusing to guess a literal volume name — Docker would silently create an empty one instead of failing." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
abs_backup_dir="$(cd "$BACKUP_DIR" && pwd)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out_file="$BACKUP_DIR/avtobirzhasi_uploads_${timestamp}.tar.gz"
tmp_name="avtobirzhasi_uploads_${timestamp}.tar.gz.partial"

if [ -e "$out_file" ]; then
  echo "ERROR: $out_file already exists — refusing to overwrite." >&2
  exit 1
fi

echo "Backing up uploads volume '${VOLUME_NAME}' -> ${out_file}"
docker run --rm \
  -v "${VOLUME_NAME}:/data:ro" \
  -v "${abs_backup_dir}:/backup" \
  alpine sh -c "tar czf /backup/${tmp_name} -C /data ."
mv "${BACKUP_DIR}/${tmp_name}" "$out_file"

echo "Verifying archive integrity..."
gzip -t "$out_file"
file_count=$(tar tzf "$out_file" | wc -l)
if [ "$file_count" -eq 0 ]; then
  echo "ERROR: uploads archive has 0 entries — treating as a failed backup." >&2
  rm -f "$out_file"
  exit 1
fi
echo "Archive verified: $file_count entries, $(du -h "$out_file" | cut -f1)"

sha256sum "$out_file" > "${out_file}.sha256"
echo "Checksum written: ${out_file}.sha256"

echo "Uploads backup written: $out_file"
