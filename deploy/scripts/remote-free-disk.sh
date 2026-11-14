#!/usr/bin/env bash
# Free disk without touching x-ui / xray / VPN.
set -euo pipefail
journalctl --vacuum-size=30M >/dev/null 2>&1 || true
apt-get clean || true
rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*
# Drop unused old kernel headers if multiple present (keep running kernel)
CURRENT="$(uname -r)"
echo "Running kernel: $CURRENT"
dpkg -l 'linux-headers-*' 'linux-modules-*' 2>/dev/null | awk '/^ii/{print $2}' | while read -r pkg; do
  case "$pkg" in
    *"$CURRENT"*|linux-headers-generic*|linux-modules-extra-*) continue ;;
  esac
  if [[ "$pkg" == linux-headers-* ]] || [[ "$pkg" == linux-modules-* ]]; then
    echo "Purging unused $pkg"
    apt-get purge -y "$pkg" >/dev/null 2>&1 || true
  fi
done
# Truncate large old logs (not VPN-related)
find /var/log -type f -name '*.gz' -delete 2>/dev/null || true
find /var/log -type f -name '*.1' -delete 2>/dev/null || true
df -h /
ss -ulnp | grep 443 || true
systemctl is-active x-ui || true
