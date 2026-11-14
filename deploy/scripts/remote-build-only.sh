#!/usr/bin/env bash
set -euo pipefail
echo "==> disk/mem before build"
df -h /
free -h
du -sh /opt/portal-advokatov/node_modules /opt/portal-advokatov/.next 2>/dev/null || true
ss -ulnp | grep 443 || true

# Free npm cache if tight
npm cache clean --force >/dev/null 2>&1 || true
rm -rf /tmp/* 2>/dev/null || true
swapon /swapfile-portal 2>/dev/null || true

sudo -u portal -H bash -lc '
  set -euo pipefail
  cd /opt/portal-advokatov
  set -a; source .env.production; set +a
  export NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
  export NODE_OPTIONS=--max-old-space-size=700
  rm -rf .next
  # Ensure typescript still present for typecheck (do not prune before build)
  test -d node_modules/typescript || npm install --no-save typescript@5
  npx next build
  echo BUILD_OK
  ls -la .next | head
'
