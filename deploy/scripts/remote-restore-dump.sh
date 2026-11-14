#!/usr/bin/env bash
# Restore local pg_dump -Fc into VPS DB. VPN-safe (no port/xray changes).
set -euo pipefail

DUMP="${1:-/opt/portal-advokatov/tmp/portal_advokatov.dump}"
DB=portal_advokatov
OWNER=portal

if [[ ! -f "$DUMP" ]]; then
  echo "DUMP_MISSING=$DUMP"
  exit 1
fi

echo "==> dump size: $(du -h "$DUMP" | awk '{print $1}')"
echo "==> stopping app briefly"
sudo -u portal -H pm2 stop portal-advokatov >/dev/null 2>&1 || true

echo "==> terminating DB sessions"
sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB}' AND pid <> pg_backend_pid();" \
  >/dev/null || true

echo "==> drop + create database"
sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${DB};
CREATE DATABASE ${DB} OWNER ${OWNER};
SQL

echo "==> pg_restore"
sudo -u postgres pg_restore \
  --dbname="$DB" \
  --no-owner \
  --role="$OWNER" \
  --verbose \
  "$DUMP" 2>&1 | tail -n 40

echo "==> reassign ownership"
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -c \
  "REASSIGN OWNED BY postgres TO ${OWNER};" >/dev/null 2>&1 || true
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO portal', r.tablename);
  END LOOP;
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO portal', r.sequence_name);
  END LOOP;
END $$;
SQL

echo "==> counts"
sudo -u postgres psql -d "$DB" -c \
  "SELECT 'cities' AS t, count(*) FROM \"City\"
   UNION ALL SELECT 'lawyers', count(*) FROM \"Lawyer\"
   UNION ALL SELECT 'cases', count(*) FROM \"CourtCase\"
   UNION ALL SELECT 'courts', count(*) FROM \"Court\";"

echo "==> start app"
sudo -u portal -H bash -lc 'cd /opt/portal-advokatov && pm2 start deploy/ecosystem.config.cjs --update-env || pm2 restart portal-advokatov'
sudo -u portal -H pm2 save >/dev/null 2>&1 || true

echo "==> UDP443 check"
ss -ulnp | grep 443 || echo 'WARN: no UDP 443 listener'

echo "RESTORE_OK"
