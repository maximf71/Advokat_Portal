#!/usr/bin/env bash
# Start PM2 + nginx assuming .next already built. VPN-safe.
set -euo pipefail
APP_DIR=/opt/portal-advokatov
APP_USER=portal

pkill -f "_run-build-once|next build" >/dev/null 2>&1 || true
sleep 1

chown -R "$APP_USER:$APP_USER" "$APP_DIR/.next"
test -f "$APP_DIR/.next/BUILD_ID"
test -d "$APP_DIR/.next/static"
test -f "$APP_DIR/.next/server/middleware-manifest.json"
echo "BUILD_ID=$(cat "$APP_DIR/.next/BUILD_ID")"

install -m 0644 "$APP_DIR/deploy/nginx/portal-advokatov.conf" /etc/nginx/sites-available/portal-advokatov.conf
ln -sfn /etc/nginx/sites-available/portal-advokatov.conf /etc/nginx/sites-enabled/portal-advokatov.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

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

sleep 5
echo "==> Verify"
ss -ulnp | grep -E ":443\b" || echo "WARN: UDP 443 gone"
ss -tlnp | grep -E ":(80|8080|3000|2096)\b" || true
curl -s -o /tmp/portal-home.html -w "loop3000 %{http_code}\n" http://127.0.0.1:3000/ || true
curl -s -o /dev/null -w "http80 %{http_code}\n" http://127.0.0.1/ || true
curl -s -o /dev/null -w "http8080 %{http_code}\n" http://127.0.0.1:8080/ || true
head -c 240 /tmp/portal-home.html; echo
systemctl is-active x-ui && echo "x-ui still active"
tail -n 30 /home/portal/.pm2/logs/portal-advokatov-error-0.log 2>/dev/null || true
echo DONE
