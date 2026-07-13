#!/usr/bin/env bash
set -euo pipefail

ROOT=${PSEUDOINTELEKT_ROOT:-/opt/apps/production/pseudointelekt}
REPO=${GITHUB_REPO:-maciekb2/withered-unit-595f}
REMOTE_SHA=$(git ls-remote "https://github.com/${REPO}.git" refs/heads/main | awk '{print $1}')
test -n "$REMOTE_SHA"
CURRENT_SHA=$(cat "$ROOT/.deployed-revision" 2>/dev/null || true)
if [[ "$CURRENT_SHA" == "$REMOTE_SHA" ]]; then exit 0; fi

exec 9>"$ROOT/.deploy.lock"
flock -n 9 || exit 0
CURRENT_SHA=$(cat "$ROOT/.deployed-revision" 2>/dev/null || true)
if [[ "$CURRENT_SHA" == "$REMOTE_SHA" ]]; then exit 0; fi
GITHUB_REPO="$REPO" GITHUB_REF="$REMOTE_SHA" DEPLOY_REVISION="$REMOTE_SHA" \
  "$ROOT/deploy/selfhosted/deploy.sh"
