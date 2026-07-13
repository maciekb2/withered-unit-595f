#!/usr/bin/env bash
set -euo pipefail

ROOT=${PSEUDOINTELEKT_ROOT:-/opt/apps/production/pseudointelekt}
COMPOSE=(docker compose -f "$ROOT/deploy/selfhosted/docker-compose.yml" --env-file "$ROOT/deploy/selfhosted/.env")
BACKUP_DIR=${PSEUDOINTELEKT_BACKUP_DIR:-$ROOT/backups}
RETENTION_DAYS=${PSEUDOINTELEKT_BACKUP_RETENTION_DAYS:-14}
METRICS_DIR=${NODE_EXPORTER_TEXTFILE_DIR:-/var/lib/node_exporter/textfile_collector}/pseudointelekt
mkdir -p "$BACKUP_DIR/postgres" "$BACKUP_DIR/social" "$METRICS_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
dump="$BACKUP_DIR/postgres/pseudointelekt-$stamp.dump"
social="$BACKUP_DIR/social/pseudointelekt-social-$stamp.tar.gz"
metrics_tmp="$METRICS_DIR/pseudointelekt_backup.prom.tmp"

write_metrics() {
  local status=$1
  local completed=${2:-0}
  local bytes=${3:-0}
  cat > "$metrics_tmp" <<EOF
# HELP pseudointelekt_backup_last_success_timestamp_seconds Last successful complete backup.
# TYPE pseudointelekt_backup_last_success_timestamp_seconds gauge
pseudointelekt_backup_last_success_timestamp_seconds $completed
# HELP pseudointelekt_backup_status Status of the most recent backup attempt.
# TYPE pseudointelekt_backup_status gauge
pseudointelekt_backup_status $status
# HELP pseudointelekt_backup_bytes Bytes written by the most recent backup.
# TYPE pseudointelekt_backup_bytes gauge
pseudointelekt_backup_bytes $bytes
EOF
  mv "$metrics_tmp" "$METRICS_DIR/pseudointelekt_backup.prom"
}
trap 'write_metrics 0 0 0' ERR

"${COMPOSE[@]}" exec -T postgres pg_dump -U pseudointelekt -d pseudointelekt -Fc > "$dump"
test -s "$dump"
"${COMPOSE[@]}" exec -T social-worker sh -c 'tar -czf - -C /data/social .' > "$social"
test -s "$social"
chmod 600 "$dump" "$social"

if [[ -n "${RESTIC_REPOSITORY:-}" ]]; then
  : "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is required when RESTIC_REPOSITORY is configured}"
  export RESTIC_PASSWORD_FILE
  restic backup "$dump" "$social" --tag pseudointelekt --host mbprod
  restic forget --tag pseudointelekt --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune
  restic check --read-data-subset=2.5%
fi

find "$BACKUP_DIR/postgres" -type f -name 'pseudointelekt-*.dump' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR/social" -type f -name 'pseudointelekt-social-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete
bytes=$(( $(stat -c %s "$dump") + $(stat -c %s "$social") ))
write_metrics 1 "$(date +%s)" "$bytes"
printf '%s\n%s\n' "$dump" "$social"
