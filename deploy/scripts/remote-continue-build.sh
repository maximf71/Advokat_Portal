#!/usr/bin/env bash
# Continue after npm ci + prisma db push already succeeded.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/portal-advokatov}"
APP_USER="${APP_USER:-portal}"
cd "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

sudo -u "$APP_USER" -H bash -lc '
  set -euo pipefail
  cd /opt/portal-advokatov
  set -a; source .env.production; set +a
  # IMPORTANT: do NOT set NODE_ENV=production before npm ci — that omits devDeps (typescript/tsx/prisma).
  export NEXT_TELEMETRY_DISABLED=1
  export NODE_OPTIONS=--max-old-space-size=768
  echo "Reinstalling full deps (including dev) for build..."
  rm -rf node_modules
  npm ci --include=dev
  npx prisma generate
  CITY_COUNT=$(node deploy/scripts/count-cities.js || echo 0)
  echo "cities=$CITY_COUNT"
  if [[ "$CITY_COUNT" == "0" ]]; then
    echo "Seeding..."
    npx --yes tsx prisma/seed.ts
  else
    echo "Skip seed"
  fi
  export NODE_ENV=production
  npm run build
  npm prune --omit=dev
'

echo "==> PM2 start"
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
if [[ -n "${STARTUP_CMD:-}" ]]; then
  bash -lc "$STARTUP_CMD" || true
fi

echo "==> Nginx"
install -m 0644 "$APP_DIR/deploy/nginx/portal-advokatov.conf" /etc/nginx/sites-available/portal-advokatov.conf
ln -sfn /etc/nginx/sites-available/portal-advokatov.conf /etc/nginx/sites-enabled/portal-advokatov.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "==> Verify"
ss -ulnp | grep -E ":443\b" || echo "WARN: UDP 443 gone"
ss -tlnp | grep -E ":(80|8080|3000|2096)\b" || true
sleep 2
curl -fsS -o /dev/null -w "loopback:3000 %{http_code}\n" http://127.0.0.1:3000/ || true
curl -fsS -o /dev/null -w "http80 %{http_code}\n" http://127.0.0.1/ || true
curl -fsS -o /dev/null -w "http8080 %{http_code}\n" http://127.0.0.1:8080/ || true
systemctl is-active x-ui && echo "x-ui still active"
echo "DONE"
