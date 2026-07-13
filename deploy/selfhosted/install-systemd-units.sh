#!/usr/bin/env bash
set -euo pipefail
ROOT=${PSEUDOINTELEKT_ROOT:-/opt/apps/production/pseudointelekt}
sudo install -m 0644 "$ROOT/deploy/selfhosted/systemd/pseudointelekt-backup.service" /etc/systemd/system/
sudo install -m 0644 "$ROOT/deploy/selfhosted/systemd/pseudointelekt-backup.timer" /etc/systemd/system/
sudo install -m 0644 "$ROOT/deploy/selfhosted/systemd/pseudointelekt-restore-test.service" /etc/systemd/system/
sudo install -m 0644 "$ROOT/deploy/selfhosted/systemd/pseudointelekt-restore-test.timer" /etc/systemd/system/
sudo install -m 0644 "$ROOT/deploy/selfhosted/systemd/pseudointelekt-deploy-poller.service" /etc/systemd/system/
sudo install -m 0644 "$ROOT/deploy/selfhosted/systemd/pseudointelekt-deploy-poller.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pseudointelekt-backup.timer pseudointelekt-restore-test.timer
sudo systemctl enable --now pseudointelekt-deploy-poller.timer
