#!/usr/bin/env bash
set -euo pipefail

ROOT=${PSEUDOINTELEKT_ROOT:-/opt/apps/production/pseudointelekt}
REPO=${GITHUB_REPO:-maciekb2/withered-unit-595f}
REF=${GITHUB_REF:-main}
REVISION=${DEPLOY_REVISION:-$REF}
HEALTH_URL=${PSEUDOINTELEKT_HEALTH_URL:-http://10.2.11.53:3000/api/health}
TOKEN=${GITHUB_TOKEN:?GITHUB_TOKEN must be set in the host env}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

curl -fsSL -H "Authorization: Bearer ${TOKEN}" -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/${REPO}/tarball/${REF}" -o "$TMP/source.tgz"
mkdir "$TMP/source"
tar -xzf "$TMP/source.tgz" -C "$TMP/source" --strip-components=1

rsync -a --delete \
  --exclude 'deploy/selfhosted/.env' \
  --exclude 'deploy/selfhosted/secrets' \
  --exclude 'deploy/selfhosted/secrets/***' \
  --exclude 'secrets' \
  --exclude 'secrets/***' \
  --exclude 'migration/' \
  --exclude 'music/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  "$TMP/source/" "$ROOT/"

cd "$ROOT"
COMPOSE_BAKE=false docker compose -f deploy/selfhosted/docker-compose.yml --env-file deploy/selfhosted/.env build app
docker compose -f deploy/selfhosted/docker-compose.yml --env-file deploy/selfhosted/.env up -d app generator scheduler social-worker social-metrics
docker compose -f deploy/selfhosted/docker-compose.yml --env-file deploy/selfhosted/.env ps

healthy=false
for _ in $(seq 1 20); do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    healthy=true
    break
  fi
  sleep 3
done
if [[ "$healthy" != true ]]; then
  docker compose -f deploy/selfhosted/docker-compose.yml --env-file deploy/selfhosted/.env logs --tail=100 app
  exit 1
fi
printf '%s\n' "$REVISION" > "$ROOT/.deployed-revision.tmp"
mv "$ROOT/.deployed-revision.tmp" "$ROOT/.deployed-revision"
