#!/usr/bin/env bash
# Detached next build. Never touch VPN / x-ui / xray / UDP 443.
set -euo pipefail
LOG=/tmp/portal-next-build.log

ss -ulnp | grep -E ':443\b' || echo "WARN: UDP 443 missing"
swapon /swapfile-portal 2>/dev/null || true
sync
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true

systemctl stop portal-next-build 2>/dev/null || true
systemctl reset-failed portal-next-build 2>/dev/null || true
# Kill leftover next build workers
pkill -f '/opt/portal-advokatov/node_modules/.bin/next build' 2>/dev/null || true
sleep 1

# Root cleans .next so portal can rebuild without EACCES leftovers
rm -rf /opt/portal-advokatov/.next
chown -R portal:portal /opt/portal-advokatov

rm -f "$LOG" /tmp/portal-next-build.exit
touch "$LOG"
chown portal:portal "$LOG"

RUNNER=/opt/portal-advokatov/deploy/scripts/_run-build-once.sh
cat >"$RUNNER" <<'INNER'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/portal-advokatov
set -a
source .env.production
set +a
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS=--max-old-space-size=650
echo "BUILD_START $(date -Is)"
npx next build
test -f .next/BUILD_ID
mkdir -p .next/server
if [[ ! -f .next/server/middleware-manifest.json ]]; then
  echo '{"sortedMiddleware":[],"middleware":{},"functions":{}}' > .next/server/middleware-manifest.json
fi
echo BUILD_OK
INNER
chmod 755 "$RUNNER"
chown portal:portal "$RUNNER"

systemd-run --no-block --uid=portal --gid=portal \
  --working-directory=/opt/portal-advokatov \
  --unit=portal-next-build \
  --property=Type=oneshot \
  --property=RemainAfterExit=yes \
  /bin/bash -c "/opt/portal-advokatov/deploy/scripts/_run-build-once.sh > /tmp/portal-next-build.log 2>&1; echo \$? > /tmp/portal-next-build.exit"

sleep 2
systemctl status portal-next-build --no-pager | head -20 || true
echo "STARTED unit=portal-next-build log=$LOG"
tail -n 8 "$LOG" || true
