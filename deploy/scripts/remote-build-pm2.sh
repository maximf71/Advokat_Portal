#!/usr/bin/env bash
# Low-RAM rebuild + PM2 + nginx. Never touch x-ui / xray / UDP 443.
set -euo pipefail
APP_DIR=/opt/portal-advokatov
APP_USER=portal

echo "==> Pre VPN check"
ss -ulnp | grep -E ':443\b' || echo "WARN: UDP 443 missing"
systemctl is-active x-ui || true

# Reclaim memory without touching VPN processes
sync
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
swapon /swapfile-portal 2>/dev/null || true
# Kill stray next build workers from failed runs (not xray)
pkill -u "$APP_USER" -f 'next-server|next build|next-swc' 2>/dev/null || true
sleep 1
free -h
df -h /

sudo -u "$APP_USER" -H bash -lc '
  set -euo pipefail
  cd /opt/portal-advokatov
  set -a; source .env.production; set +a
  export NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
  export NODE_OPTIONS=--max-old-space-size=650
  rm -rf .next
  npx next build
  echo BUILD_OK
  test -f .next/BUILD_ID
'

echo "==> PM2 start 127.0.0.1:3000"
APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
sudo -u "$APP_USER" -H bash -lc '
  set -euo pipefail
  set -a; source /opt/portal-advokatov/.env.production; set +a
  cd /opt/portal-advokatov
  pm2 delete portal-advokatov >/dev/null 2>&1 || true
  pm2 start /opt/portal-advokatov/deploy/ecosystem.config.cjs --update-env
  pm2 save
'
STARTUP_CMD="$(pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" | grep -E "sudo|systemctl" | tail -n 1 || true)"
if [[ -n "${STARTUP_CMD:-}" ]]; then bash -lc "$STARTUP_CMD" || true; fi

echo "==> Nginx"
install -m 0644 "$APP_DIR/deploy/nginx/portal-advokatov.conf" /etc/nginx/sites-available/portal-advokatov.conf
ln -sfn /etc/nginx/sites-available/portal-advokatov.conf /etc/nginx/sites-enabled/portal-advokatov.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

sleep 4
echo "==> Verify"
ss -ulnp | grep -E ':443\b' || echo "WARN: UDP 443 gone"
ss -tlnp | grep -E ':(80|8080|3000|2096)\b' || true
curl -fsS -o /dev/null -w "loopback:3000 %{http_code}\n" http://127.0.0.1:3000/ || pm2 logs portal-advokatov --lines 40 --nostream || true
curl -fsS -o /dev/null -w "http80 %{http_code}\n" http://127.0.0.1/ || true
curl -fsS -o /dev/null -w "http8080 %{http_code}\n" http://127.0.0.1:8080/ || true
systemctl is-active x-ui && echo "x-ui still active"
echo "DONE public=http://$(hostname -I | awk '{print $1}')/"
