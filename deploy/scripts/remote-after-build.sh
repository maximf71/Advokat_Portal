#!/usr/bin/env bash
set -euo pipefail
APP_DIR=/opt/portal-advokatov
APP_USER=portal
test -f "$APP_DIR/.next/BUILD_ID"

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

install -m 0644 "$APP_DIR/deploy/nginx/portal-advokatov.conf" /etc/nginx/sites-available/portal-advokatov.conf
ln -sfn /etc/nginx/sites-available/portal-advokatov.conf /etc/nginx/sites-enabled/portal-advokatov.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

sleep 3
ss -ulnp | grep -E ':443\b' || echo "WARN: UDP 443 gone"
ss -tlnp | grep -E ':(80|8080|3000|2096)\b' || true
curl -fsS -o /dev/null -w "loopback:3000 %{http_code}\n" http://127.0.0.1:3000/ || pm2 logs portal-advokatov --lines 50 --nostream || true
curl -fsS -o /dev/null -w "http80 %{http_code}\n" http://127.0.0.1/ || true
curl -fsS -o /dev/null -w "http8080 %{http_code}\n" http://127.0.0.1:8080/ || true
systemctl is-active x-ui && echo "x-ui still active"
echo "DONE public=http://$(hostname -I | awk '{print $1}')/"
