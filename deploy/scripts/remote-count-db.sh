#!/usr/bin/env bash
set -euo pipefail
cd /opt/portal-advokatov
if [[ -f .env.production ]]; then set -a; . ./.env.production; set +a; fi
if [[ -f .env ]]; then set -a; . ./.env; set +a; fi

SQL='SELECT '\''cities'\'' AS t, count(*)::text FROM "City"
UNION ALL SELECT '\''lawyers'\'', count(*)::text FROM "Lawyer"
UNION ALL SELECT '\''cases'\'', count(*)::text FROM "CourtCase"
UNION ALL SELECT '\''courts'\'', count(*)::text FROM "Court"
UNION ALL SELECT '\''categories'\'', count(*)::text FROM "Category";'

if sudo -u postgres psql -d portal_advokatov -c "$SQL" 2>/dev/null; then
  exit 0
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  psql "$DATABASE_URL" -c "$SQL"
  exit 0
fi

echo "NO_DB_ACCESS"
exit 1
