#!/usr/bin/env bash
# Enable PM2 resurrect on boot for portal user. Never touch VPN.
set -euo pipefail
sudo -u portal -H pm2 save
CMD=$(sudo -u portal -H pm2 startup systemd -u portal --hp /home/portal | grep -E '^sudo ' | tail -n 1 || true)
echo "CMD=$CMD"
if [[ -n "$CMD" ]]; then
  eval "$CMD"
fi
systemctl daemon-reload || true
systemctl enable pm2-portal 2>/dev/null || true
systemctl is-enabled pm2-portal 2>/dev/null || ls /etc/systemd/system/pm2-portal.service 2>/dev/null || true
ss -ulnp | grep ':443' || true
echo "pm2-startup done"
