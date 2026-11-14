#!/usr/bin/env bash
df -h /
free -h
echo "--- dmesg OOM ---"
dmesg -T 2>/dev/null | grep -iE 'oom|killed process|out of memory' | tail -20 || true
echo "--- .next ---"
du -sh /opt/portal-advokatov/.next 2>/dev/null || echo no-next
ls /opt/portal-advokatov/.next 2>/dev/null | head || true
echo "--- node_modules ---"
du -sh /opt/portal-advokatov/node_modules 2>/dev/null || true
echo "--- VPN ---"
ss -ulnp | grep 443 || true
systemctl is-active x-ui
