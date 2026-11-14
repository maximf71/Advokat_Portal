# Deploy (no domain, VPN-safe)

Hard rules on the VPS that already runs 3x-ui / xray (Hysteria2 on **UDP 443**):

- Do **not** touch UDP 443, reinstall/restart x-ui/xray/hysteria, or bind anything to UDP 443.
- Avoid TCP 2096/2097 (panel/sub).
- App binds **127.0.0.1:3000** only; Nginx listens on **TCP 80** and **TCP 8080**.
- No HTTPS / Let's Encrypt until a domain exists. Do not steal TCP 443 even if free.

## Small VPS path (recommended for ~1 GB RAM / ~10 GB disk)

Uses apt PostgreSQL + Node + PM2 + Nginx (Docker build would OOM/fill disk).

```bash
# from workspace (password via env, never commit)
$env:DEPLOY_SSH_PASS='…'
node deploy/scripts/pack-and-upload.js
# then upload .env.production and run remote-deploy-pm2.sh
```

## Docker path (larger VPS)

See `Dockerfile` + `docker-compose.prod.yml`. Postgres has **no host ports**. App publishes `127.0.0.1:3000` only.

## Public URLs (until domain)

- `http://<VPS_IP>/`
- `http://<VPS_IP>:8080/`
