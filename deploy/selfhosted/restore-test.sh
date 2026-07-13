#!/usr/bin/env bash
set -euo pipefail

ROOT=${PSEUDOINTELEKT_ROOT:-/opt/apps/production/pseudointelekt}
BACKUP_DIR=${PSEUDOINTELEKT_BACKUP_DIR:-$ROOT/backups}
dump=$(find "$BACKUP_DIR/postgres" -type f -name 'pseudointelekt-*.dump' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
social=$(find "$BACKUP_DIR/social" -type f -name 'pseudointelekt-social-*.tar.gz' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
test -n "$dump" && test -s "$dump"
test -n "$social" && test -s "$social"
pg_restore --list "$dump" >/dev/null
tar -tzf "$social" >/dev/null

if [[ -n "${RESTIC_REPOSITORY:-}" ]]; then
  : "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is required when RESTIC_REPOSITORY is configured}"
  export RESTIC_PASSWORD_FILE
  restic snapshots --tag pseudointelekt --latest 1 >/dev/null
  restic check --read-data-subset=5%
fi
printf 'restore-test-ok %s\n' "$(date -u +%FT%TZ)"
