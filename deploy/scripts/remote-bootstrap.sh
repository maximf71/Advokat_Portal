#!/usr/bin/env bash
# Remote bootstrap for Portal Advokatov on a VPN-hosting VPS.
# VPN SAFETY: never touch UDP 443, 3x-ui, xray, hysteria, or TCP 2096/2097.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/portal-advokatov}"
echo "==> Inventory (read-only) before any change"
ss -tulnp || true
echo "--- docker ps ---"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' 2>/dev/null || true
echo "--- systemd units of interest ---"
for u in x-ui xray hysteria hysteria2 nginx caddy docker; do
  systemctl is-active "$u" 2>/dev/null && echo "$u: active" || echo "$u: inactive/missing"
done

echo "==> Ensure Docker + Nginx (apt only if missing; do not touch x-ui/xray)"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y nginx
fi

mkdir -p "$APP_DIR"
echo "==> Bootstrap complete. App dir: $APP_DIR"
