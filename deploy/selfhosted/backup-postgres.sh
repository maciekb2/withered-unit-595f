#!/usr/bin/env bash
set -euo pipefail

ROOT=${PSEUDOINTELEKT_ROOT:-/opt/apps/production/pseudointelekt}
COMPOSE=(docker compose -f "$ROOT/deploy/selfhosted/docker-compose.yml" --env-file "$ROOT/deploy/selfhosted/.env")
BACKUP_DIR=${PSEUDOINTELEKT_BACKUP_DIR:-$ROOT/backups/postgres}
RETENTION_DAYS=${PSEUDOINTELEKT_BACKUP_RETENTION_DAYS:-14}
mkdir -p "$BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="$BACKUP_DIR/pseudointelekt-$stamp.dump"

"${COMPOSE[@]}" exec -T postgres pg_dump -U pseudointelekt -d pseudointelekt -Fc > "$file"
test -s "$file"
find "$BACKUP_DIR" -type f -name 'pseudointelekt-*.dump' -mtime "+$RETENTION_DAYS" -delete
chmod 600 "$file"
printf '%s\n' "$file"
