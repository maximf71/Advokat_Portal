#!/usr/bin/env bash
# Deploy / refresh Portal Advokatov without touching VPN stack.
# VPN SAFETY: do not restart x-ui/xray/hysteria; do not bind UDP 443.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/portal-advokatov}"
cd "$APP_DIR"

if [[ ! -f .env.production ]]; then
  echo "Missing .env.production in $APP_DIR" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env.production
set +a

echo "==> Pre-deploy UDP 443 snapshot (must remain after deploy)"
ss -ulnp | grep -E ':443\b' || echo "(no UDP 443 listener — unexpected if VPN was up)"

echo "==> Build and start compose (postgres internal + app on 127.0.0.1:3000)"
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

echo "==> Wait for postgres healthy"
for i in $(seq 1 60); do
  if docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
    pg_isready -U "${POSTGRES_USER:-portal}" -d "${POSTGRES_DB:-portal_advokatov}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Prisma schema sync (db push — no migrations folder yet)"
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm --entrypoint sh app -c \
  'npx prisma db push --skip-generate && npx prisma generate'

# Seed only if cities table empty (homepage needs cities)
CITY_COUNT=$(docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  psql -U "${POSTGRES_USER:-portal}" -d "${POSTGRES_DB:-portal_advokatov}" -tAc "SELECT COUNT(*) FROM \"City\";" 2>/dev/null || echo 0)
CITY_COUNT=$(echo "$CITY_COUNT" | tr -d '[:space:]')
if [[ -z "$CITY_COUNT" || "$CITY_COUNT" == "0" ]]; then
  echo "==> Seeding database (empty City table)"
  docker compose -f docker-compose.prod.yml --env-file .env.production run --rm --entrypoint sh app -c \
    'npx tsx prisma/seed.ts'
else
  echo "==> Skip seed (City count=$CITY_COUNT)"
fi

echo "==> Install Nginx site (TCP 80 + 8080 only)"
install -m 0644 deploy/nginx/portal-advokatov.conf /etc/nginx/sites-available/portal-advokatov.conf
ln -sfn /etc/nginx/sites-available/portal-advokatov.conf /etc/nginx/sites-enabled/portal-advokatov.conf
# Remove default site if it would steal :80
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "==> Post-deploy checks"
ss -ulnp | grep -E ':443\b' || echo "WARN: UDP 443 missing"
ss -tlnp | grep -E ':(80|8080|3000)\b' || true
curl -fsS -o /dev/null -w "localhost:3000 -> %{http_code}\n" http://127.0.0.1:3000/ || true
curl -fsS -o /dev/null -w "localhost:80 -> %{http_code}\n" http://127.0.0.1/ || true
curl -fsS -o /dev/null -w "localhost:8080 -> %{http_code}\n" http://127.0.0.1:8080/ || true

echo "==> Done. Public URLs: http://$(hostname -I | awk '{print $1}')/ and :8080"
echo "VPN reminder: UDP 443 / x-ui / xray were not restarted by this script."
