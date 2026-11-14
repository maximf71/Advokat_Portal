#!/usr/bin/env bash
# Lean deploy for small VPS (low RAM/disk): Node + PM2 + apt PostgreSQL + Nginx.
# VPN SAFETY: never touch UDP 443, x-ui, xray, hysteria, or TCP 2096/2097.
# Do NOT bind the app to anything except 127.0.0.1:3000.
# Do NOT install/restart 3x-ui/xray. Skip Docker on tiny disks.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/portal-advokatov}"
APP_USER="${APP_USER:-portal}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "==> Pre-check UDP 443 (VPN) — must stay up"
ss -ulnp | grep -E ':443\b' || echo "WARN: UDP 443 not listening"
systemctl is-active x-ui >/dev/null && echo "x-ui: active" || echo "WARN: x-ui inactive"

echo "==> Free safe disk space (apt caches + journal; no VPN packages)"
journalctl --vacuum-size=50M >/dev/null 2>&1 || true
apt-get clean || true
rm -rf /var/lib/apt/lists/*
df -h /

echo "==> Extra swap for Next.js build (temporary file; does not affect VPN)"
if [[ ! -f /swapfile-portal ]]; then
  fallocate -l 2G /swapfile-portal || dd if=/dev/zero of=/swapfile-portal bs=1M count=2048
  chmod 600 /swapfile-portal
  mkswap /swapfile-portal
fi
swapon /swapfile-portal 2>/dev/null || true
free -h

echo "==> Install Node ${NODE_MAJOR}, PostgreSQL, Nginx, PM2 (idempotent)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg nginx postgresql postgresql-contrib

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

if [[ ! -f "$APP_DIR/.env.production" ]]; then
  echo "Missing $APP_DIR/.env.production" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source "$APP_DIR/.env.production"
set +a

: "${POSTGRES_USER:?}"
: "${POSTGRES_PASSWORD:?}"
: "${POSTGRES_DB:?}"
: "${DATABASE_URL:?}"
: "${NEXTAUTH_SECRET:?}"

echo "==> PostgreSQL role/db (localhost only — never publish 5432 publicly)"
systemctl enable --now postgresql

# Escape single quotes for SQL string literals
SQL_PASS="${POSTGRES_PASSWORD//\'/\'\'}"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
    CREATE ROLE ${POSTGRES_USER} LOGIN PASSWORD '${SQL_PASS}';
  ELSE
    ALTER ROLE ${POSTGRES_USER} WITH LOGIN PASSWORD '${SQL_PASS}';
  END IF;
END
\$\$;
SQL

if [[ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'")" != "1" ]]; then
  sudo -u postgres createdb -O "${POSTGRES_USER}" "${POSTGRES_DB}"
fi

echo "==> npm ci + prisma + build as ${APP_USER}"
sudo -u "$APP_USER" -H bash -lc "
  set -euo pipefail
  cd '$APP_DIR'
  set -a; source .env.production; set +a
  # Do NOT export NODE_ENV=production before npm ci (would omit typescript/tsx/prisma).
  export NEXT_TELEMETRY_DISABLED=1
  export NODE_OPTIONS='--max-old-space-size=768'
  npm ci --include=dev
  npx prisma generate
  npx prisma db push
  CITY_COUNT=\$(node deploy/scripts/count-cities.js || echo 0)
  if [[ \"\$CITY_COUNT\" == \"0\" ]]; then
    echo 'Seeding...'
    npx --yes tsx prisma/seed.ts
  else
    echo \"Skip seed, cities=\$CITY_COUNT\"
  fi
  export NODE_ENV=production
  npm run build
  npm prune --omit=dev
"

echo "==> PM2 on 127.0.0.1:3000 only (Nginx will proxy; VPN ports untouched)"
APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
# Merge secrets into PM2 env without printing them
sudo -u "$APP_USER" -H bash -lc "
  set -euo pipefail
  set -a; source '$APP_DIR/.env.production'; set +a
  cd '$APP_DIR'
  pm2 delete portal-advokatov >/dev/null 2>&1 || true
  pm2 start '$APP_DIR/deploy/ecosystem.config.cjs' --update-env
  pm2 save
"
STARTUP_CMD="$(pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" | grep -E 'sudo|systemctl' | tail -n 1 || true)"
if [[ -n "${STARTUP_CMD:-}" ]]; then
  bash -lc "$STARTUP_CMD" || true
fi

echo "==> Nginx TCP 80 + 8080 → 127.0.0.1:3000 (never TCP/UDP 443, never 2096/2097)"
install -m 0644 "$APP_DIR/deploy/nginx/portal-advokatov.conf" /etc/nginx/sites-available/portal-advokatov.conf
ln -sfn /etc/nginx/sites-available/portal-advokatov.conf /etc/nginx/sites-enabled/portal-advokatov.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "==> Post-deploy verification"
echo "--- UDP 443 ---"
ss -ulnp | grep -E ':443\b' || echo "WARN: UDP 443 gone"
echo "--- TCP listeners of interest ---"
ss -tlnp | grep -E ':(80|8080|3000|2096|443)\b' || true
curl -fsS -o /dev/null -w "loopback:3000 %{http_code}\n" http://127.0.0.1:3000/ || true
curl -fsS -o /dev/null -w "http80 %{http_code}\n" http://127.0.0.1/ || true
curl -fsS -o /dev/null -w "http8080 %{http_code}\n" http://127.0.0.1:8080/ || true
systemctl is-active x-ui >/dev/null && echo "x-ui still active" || echo "WARN: x-ui inactive"
PUBLIC_IP="$(hostname -I | awk '{print $1}')"
echo "Public URLs: http://${PUBLIC_IP}/  and  http://${PUBLIC_IP}:8080/"
echo "VPN reminder: UDP 443 / x-ui / xray were not restarted by this script."
