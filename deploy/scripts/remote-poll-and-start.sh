#!/usr/bin/env bash
set -euo pipefail
LOG=/tmp/portal-next-build.log
EXITF=/tmp/portal-next-build.exit

for i in $(seq 1 90); do
  if [[ -f "$EXITF" ]]; then
    code=$(cat "$EXITF" || echo 1)
    echo "BUILD_EXIT=$code after ${i}0s"
    tail -n 40 "$LOG" || true
    if [[ "$code" != "0" ]]; then
      exit 1
    fi
    break
  fi
  if (( i % 6 == 0 )); then
    echo "still building… $(date -Is)"
    tail -n 3 "$LOG" || true
  fi
  sleep 10
done

if [[ ! -f /opt/portal-advokatov/.next/BUILD_ID ]]; then
  echo "NO_BUILD_ID"
  tail -n 60 "$LOG" || true
  exit 1
fi

cd /opt/portal-advokatov
chown -R portal:portal .next
sudo -u portal -H pm2 restart portal-advokatov --update-env || \
  sudo -u portal -H pm2 start deploy/ecosystem.config.cjs --update-env
sleep 4
curl -s http://127.0.0.1:3000/ | tr '\n' ' ' | grep -oE 'Адвокатов в базе</div><div class="font-serif text-3xl tabular-nums">[^<]+' || true
curl -s -o /dev/null -w "HOME=%{http_code}\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "PUBLIC=%{http_code}\n" http://127.0.0.1/
ss -ulnp | grep 443 || true
echo "LIVE_OK"
