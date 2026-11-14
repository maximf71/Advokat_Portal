#!/usr/bin/env bash
# Sync denormalized city counts + purge Next cache so homepage reflects DB.
set -euo pipefail
cd /opt/portal-advokatov

echo "==> sync City.activeLawyersCount from live Lawyer rows"
sudo -u postgres psql -d portal_advokatov -v ON_ERROR_STOP=1 <<'SQL'
UPDATE "City" c
SET "activeLawyersCount" = sub.cnt
FROM (
  SELECT "cityId" AS id, count(*)::int AS cnt
  FROM "Lawyer"
  WHERE "cityId" IS NOT NULL
  GROUP BY "cityId"
) sub
WHERE c.id = sub.id;

UPDATE "City"
SET "activeLawyersCount" = 0
WHERE id NOT IN (SELECT DISTINCT "cityId" FROM "Lawyer" WHERE "cityId" IS NOT NULL);
SQL

echo "==> counts check"
sudo -u postgres psql -d portal_advokatov -c \
  'SELECT slug, "activeLawyersCount" FROM "City" ORDER BY slug;'

echo "==> purge Next full-route cache for /"
rm -rf .next/cache \
  .next/server/app/index.html \
  .next/server/app/index.meta \
  .next/server/app/index.rsc \
  '.next/server/app/(public)' 2>/dev/null || true
# keep build; only drop cached HTML if present under app
find .next/server/app -maxdepth 3 \( -name 'page.html' -o -name 'page_client-reference-manifest.js' \) 2>/dev/null | head

echo "==> restart PM2"
sudo -u portal -H pm2 restart portal-advokatov --update-env
sleep 3
curl -s http://127.0.0.1:3000/ | tr '\n' ' ' | grep -oE 'tabular-nums">[0-9 ]+<' | head -5 || true
curl -s -o /dev/null -w "HOME=%{http_code}\n" http://127.0.0.1:3000/
ss -ulnp | grep 443 || true
echo "REFRESH_DONE"
