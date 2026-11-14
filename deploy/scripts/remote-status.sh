#!/usr/bin/env bash
set -euo pipefail
df -h /
echo "---"
ls -la /opt/portal-advokatov/.next 2>&1 | head || echo "no .next"
echo "---"
ls /opt/portal-advokatov/node_modules 2>/dev/null | wc -l
ls /opt/portal-advokatov/node_modules/next 2>&1 | head -2 || echo "no next pkg"
ls /opt/portal-advokatov/node_modules/tsx 2>&1 | head -2 || echo "no tsx"
echo "---"
sudo -u portal -H bash -lc 'cd /opt/portal-advokatov; set -a; source .env.production; set +a; node deploy/scripts/count-cities.js; echo'
echo "---"
pm2 list || true
ss -ulnp | grep 443 || true
systemctl is-active x-ui || true
