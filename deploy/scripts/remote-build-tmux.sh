#!/usr/bin/env bash
# Build inside tmux as portal. Never touch VPN.
set -uo pipefail
LOG=/tmp/portal-next-build.log
SESSION=portalbuild

ss -ulnp | grep -E ':443\b' || echo "WARN: UDP 443 missing"
swapon /swapfile-portal 2>/dev/null || true

tmux has-session -t "$SESSION" 2>/dev/null && tmux kill-session -t "$SESSION"
systemctl stop portal-next-build 2>/dev/null || true

rm -rf /opt/portal-advokatov/.next
chown -R portal:portal /opt/portal-advokatov
rm -f "$LOG" /tmp/portal-next-build.exit
: >"$LOG"
chown portal:portal "$LOG"

RUNNER=/opt/portal-advokatov/deploy/scripts/_run-build-once.sh
cat >"$RUNNER" <<'INNER'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/portal-advokatov
set -a
source .env.production
set +a
export HOME=/home/portal
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS=--max-old-space-size=650
echo "BUILD_START $(date -Is)" | tee -a /tmp/portal-next-build.log
npx next build >>/tmp/portal-next-build.log 2>&1
test -f .next/BUILD_ID
mkdir -p .next/server
if [[ ! -f .next/server/middleware-manifest.json ]]; then
  echo '{"sortedMiddleware":[],"middleware":{},"functions":{}}' > .next/server/middleware-manifest.json
fi
echo BUILD_OK | tee -a /tmp/portal-next-build.log
echo 0 > /tmp/portal-next-build.exit
INNER
chmod 755 "$RUNNER"
chown portal:portal "$RUNNER"

# Ensure portal home exists for tmux/npm
mkdir -p /home/portal
chown portal:portal /home/portal

# Start tmux as portal so the whole session owns the build
sudo -u portal -H tmux new-session -d -s "$SESSION" \
  "bash $RUNNER; ec=\$?; echo \$ec > /tmp/portal-next-build.exit; sleep 2"

sleep 3
echo "=== tmux as portal ==="
sudo -u portal -H tmux ls || echo "tmux ls failed"
echo "STARTED tmux=$SESSION log=$LOG"
tail -n 20 "$LOG" || true
pgrep -af 'next build' || echo "(next not yet visible)"
