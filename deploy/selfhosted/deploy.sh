#!/usr/bin/env bash
set -euo pipefail

ROOT=${PSEUDOINTELEKT_ROOT:-/opt/apps/production/pseudointelekt}
REPO=${GITHUB_REPO:-maciekb2/withered-unit-595f}
REF=${GITHUB_REF:-main}
TOKEN=${GITHUB_TOKEN:?GITHUB_TOKEN must be set in the host env}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

curl -fsSL -H "Authorization: Bearer ${TOKEN}" -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/${REPO}/tarball/${REF}" -o "$TMP/source.tgz"
mkdir "$TMP/source"
tar -xzf "$TMP/source.tgz" -C "$TMP/source" --strip-components=1

rsync -a --delete \
  --exclude 'deploy/selfhosted/.env' \
  --exclude 'deploy/selfhosted/secrets/' \
  --exclude 'migration/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  "$TMP/source/" "$ROOT/"

cd "$ROOT"
docker compose -f deploy/selfhosted/docker-compose.yml --env-file deploy/selfhosted/.env build app
docker compose -f deploy/selfhosted/docker-compose.yml --env-file deploy/selfhosted/.env up -d app generator scheduler
docker compose -f deploy/selfhosted/docker-compose.yml --env-file deploy/selfhosted/.env ps
