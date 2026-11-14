#!/usr/bin/env bash
# Restore plain SQL dump into VPS DB. VPN-safe.
set -euo pipefail

SQL_FILE="${1:-/opt/portal-advokatov/tmp/portal_advokatov.sql}"
DB=portal_advokatov
OWNER=portal

if [[ ! -f "$SQL_FILE" ]]; then
  echo "SQL_MISSING=$SQL_FILE"
  exit 1
fi

echo "==> sql size: $(du -h "$SQL_FILE" | awk '{print $1}')"
echo "==> stopping app"
sudo -u portal -H pm2 stop portal-advokatov >/dev/null 2>&1 || true

echo "==> terminate sessions"
sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB}' AND pid <> pg_backend_pid();" \
  >/dev/null || true

echo "==> recreate database"
sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${DB};
CREATE DATABASE ${DB} OWNER ${OWNER};
SQL

echo "==> import sql"
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f "$SQL_FILE" >/tmp/portal-restore.log 2>&1 || {
  echo "RESTORE_FAILED"
  tail -n 60 /tmp/portal-restore.log
  exit 1
}

echo "==> ownership"
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
GRANT ALL ON SCHEMA public TO portal;
GRANT ALL ON ALL TABLES IN SCHEMA public TO portal;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO portal;
SQL

echo "==> counts"
sudo -u postgres psql -d "$DB" -c \
  "SELECT 'cities' AS t, count(*) FROM \"City\"
   UNION ALL SELECT 'lawyers', count(*) FROM \"Lawyer\"
   UNION ALL SELECT 'cases', count(*) FROM \"CourtCase\"
   UNION ALL SELECT 'courts', count(*) FROM \"Court\";"

echo "==> start app"
cd /opt/portal-advokatov
sudo -u portal -H pm2 start deploy/ecosystem.config.cjs --update-env >/dev/null 2>&1 \
  || sudo -u portal -H pm2 restart portal-advokatov
sudo -u portal -H pm2 save >/dev/null 2>&1 || true

sleep 2
curl -s -o /dev/null -w "LOCAL_HTTP=%{http_code}\n" http://127.0.0.1:3000/ || true
curl -s -o /dev/null -w "NGINX80=%{http_code}\n" http://127.0.0.1/ || true
ss -ulnp | grep 443 || echo 'WARN: no UDP 443'
echo "RESTORE_OK"
