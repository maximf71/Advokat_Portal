#!/usr/bin/env bash
set -euo pipefail
LOG=/tmp/portal-next-build.log
echo "=== tmux ==="
tmux ls 2>/dev/null || echo "(no tmux sessions)"
echo "=== exit file ==="
cat /tmp/portal-next-build.exit 2>/dev/null || echo "(none)"
echo "=== tail log ==="
tail -n 60 "$LOG" 2>/dev/null || echo "(no log)"
echo "=== markers ==="
if grep -q 'BUILD_OK' "$LOG" 2>/dev/null; then
  echo STATUS=SUCCESS
elif tmux has-session -t portalbuild 2>/dev/null; then
  echo STATUS=RUNNING
elif grep -qE 'Failed to compile|Build error|Build failed|ELIFECYCLE|EACCES|ENOENT|Type error' "$LOG" 2>/dev/null \
  && ! grep -q 'BUILD_OK' "$LOG" 2>/dev/null; then
  echo STATUS=FAILED
elif [[ -f /tmp/portal-next-build.exit ]]; then
  ec=$(cat /tmp/portal-next-build.exit)
  if [[ "$ec" == "0" ]]; then echo STATUS=SUCCESS; else echo "STATUS=FAILED exit=$ec"; fi
else
  echo STATUS=UNKNOWN
fi
ss -ulnp | grep ':443' | head -1 || true
test -f /opt/portal-advokatov/.next/BUILD_ID && echo HAS_BUILD_ID || echo NO_BUILD_ID
pgrep -af 'next build' | head -5 || echo "(no next build proc)"
