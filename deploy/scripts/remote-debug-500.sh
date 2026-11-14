#!/usr/bin/env bash
set -euo pipefail
echo "=== pm2 status ==="
sudo -u portal -H pm2 list || true
echo "=== pm2 logs ==="
sudo -u portal -H pm2 logs portal-advokatov --lines 40 --nostream || true
echo "=== nginx error ==="
tail -40 /var/log/nginx/error.log || true
echo "=== curl local ==="
curl -fsS -o /dev/null -w "local %{http_code}\n" -H 'Host: 130.78.12.100' http://127.0.0.1:3000/ || true
curl -fsS -o /dev/null -w "nginx80 %{http_code}\n" http://127.0.0.1/ || true
echo "=== ufw/iptables ==="
ufw status 2>/dev/null || true
iptables -L INPUT -n | head -40 || true
echo "=== ss ==="
ss -tlnp | grep -E ':(80|8080|3000)\b' || true
