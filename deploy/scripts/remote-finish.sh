#!/usr/bin/env bash
# Finish build + PM2 + Nginx after seed already done. VPN-safe.
set -euo pipefail
APP_DIR=/opt/portal-advokatov
APP_USER=portal
APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"

echo "==> Pre-check UDP 443"
ss -ulnp | grep -E ":443\b" || echo "WARN: UDP 443 gone"
systemctl is-active x-ui || echo "WARN: x-ui inactive"

# Free a bit of space before build
rm -rf "$APP_DIR/.next" /tmp/next-* 2>/dev/null || true
df -h /

echo "==> Ensure PM2 systemd unit exists (before app start — do not reinstall after)"
if [[ ! -f /etc/systemd/system/pm2-portal.service ]]; then
  STARTUP_CMD="$(sudo -u "$APP_USER" -H bash -lc "pm2 startup systemd -u $APP_USER --hp $APP_HOME" | grep -E "sudo|systemctl" | tail -n 1 || true)"
  if [[ -n "${STARTUP_CMD:-}" ]]; then
    bash -lc "$STARTUP_CMD" || true
  fi
fi
systemctl enable pm2-portal.service 2>/dev/null || true

echo "==> Next.js production build"
sudo -u "$APP_USER" -H bash -lc '
  set -euo pipefail
  cd /opt/portal-advokatov
  set -a; source .env.production; set +a
  export NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
  export NODE_OPTIONS=--max-old-space-size=650
  export NEXT_PRIVATE_WORKER_THREADS=1
  npm run build
  test -f .next/BUILD_ID
  test -d .next/static
  test -f .next/server/middleware-manifest.json
  echo "BUILD_ID=$(cat .next/BUILD_ID)"
'

echo "==> PM2 start (no pm2 startup here)"
sudo -u "$APP_USER" -H bash -lc '
  set -euo pipefail
  export HOME=/home/portal PM2_HOME=/home/portal/.pm2
  set -a; source /opt/portal-advokatov/.env.production; set +a
  cd /opt/portal-advokatov
  pm2 delete portal-advokatov >/dev/null 2>&1 || true
  pm2 start /opt/portal-advokatov/deploy/ecosystem.config.cjs --update-env
  pm2 save
  pm2 status
'

install -m 0644 "$APP_DIR/deploy/nginx/portal-advokatov.conf" /etc/nginx/sites-available/portal-advokatov.conf
ln -sfn /etc/nginx/sites-available/portal-advokatov.conf /etc/nginx/sites-enabled/portal-advokatov.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "==> Verify"
sleep 4
ss -ulnp | grep -E ":443\b" || echo "WARN: UDP 443 gone"
ss -tlnp | grep -E ":(80|8080|3000|2096)\b" || true
curl -fsS -o /dev/null -w "loopback:3000 %{http_code}\n" http://127.0.0.1:3000/ || true
curl -fsS -o /dev/null -w "http80 %{http_code}\n" http://127.0.0.1/ || true
curl -fsS -o /dev/null -w "http8080 %{http_code}\n" http://127.0.0.1:8080/ || true
systemctl is-active x-ui && echo "x-ui still active"
echo "DONE public=http://$(hostname -I | awk '{print $1}')/"
