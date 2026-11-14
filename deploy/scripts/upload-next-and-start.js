/**
 * Upload prebuilt .next + next.config and start PM2/Nginx on VPS.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { Client } = require(path.join(
  process.env.TEMP || process.env.TMP || "/tmp",
  "portal-ssh-tools",
  "node_modules",
  "ssh2"
));

const ROOT = path.resolve(__dirname, "..", "..");
const HOST = process.env.DEPLOY_SSH_HOST || "130.78.12.100";
const USER = process.env.DEPLOY_SSH_USER || "root";
const PASS = process.env.DEPLOY_SSH_PASS;
const ARCHIVE = path.join(process.env.TEMP || process.env.TMP, "portal-next-build.tgz");

if (!PASS) {
  console.error("DEPLOY_SSH_PASS required");
  process.exit(1);
}

function connect() {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on("ready", () => resolve(c)).on("error", reject).connect({
      host: HOST,
      username: USER,
      password: PASS,
      readyTimeout: 30000,
    });
  });
}

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      stream.on("data", (d) => {
        const s = d.toString();
        stdout += s;
        process.stdout.write(s);
      });
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      stream.on("close", (code) => resolve({ code: code ?? 0, stdout }));
    });
  });
}

function upload(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      console.log(`Uploading ${local} -> ${remote}`);
      sftp.fastPut(local, remote, (e) => (e ? reject(e) : resolve()));
    });
  });
}

console.log("Packing .next + next.config.ts ...");
const r = spawnSync(
  "tar",
  ["-czf", ARCHIVE, "-C", ROOT, ".next", "next.config.ts"],
  { stdio: "inherit" }
);
if (r.status !== 0) process.exit(r.status || 1);
console.log(`Archive ${(fs.statSync(ARCHIVE).size / 1024 / 1024).toFixed(1)} MB`);

(async () => {
  const conn = await connect();
  try {
    await upload(conn, ARCHIVE, "/tmp/portal-next-build.tgz");
    const remote = `
set -euo pipefail
cd /opt/portal-advokatov
rm -rf .next
tar -xzf /tmp/portal-next-build.tgz -C /opt/portal-advokatov
rm -f /tmp/portal-next-build.tgz
chown -R portal:portal /opt/portal-advokatov/.next /opt/portal-advokatov/next.config.ts
# Ensure Linux Prisma engines (Windows build may have wrong binary)
sudo -u portal -H bash -lc 'cd /opt/portal-advokatov; set -a; source .env.production; set +a; npx prisma generate'
# PM2
sudo -u portal -H bash -lc 'set -a; source /opt/portal-advokatov/.env.production; set +a; cd /opt/portal-advokatov; pm2 delete portal-advokatov >/dev/null 2>&1 || true; pm2 start /opt/portal-advokatov/deploy/ecosystem.config.cjs --update-env; pm2 save'
APP_HOME=$(getent passwd portal | cut -d: -f6)
STARTUP_CMD=$(pm2 startup systemd -u portal --hp "$APP_HOME" | grep -E 'sudo|systemctl' | tail -n 1 || true)
if [[ -n "\${STARTUP_CMD:-}" ]]; then bash -lc "$STARTUP_CMD" || true; fi
# Nginx
install -m 0644 /opt/portal-advokatov/deploy/nginx/portal-advokatov.conf /etc/nginx/sites-available/portal-advokatov.conf
ln -sfn /etc/nginx/sites-available/portal-advokatov.conf /etc/nginx/sites-enabled/portal-advokatov.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx
sleep 3
echo '=== VERIFY ==='
ss -ulnp | grep ':443' || echo 'WARN UDP 443'
ss -tlnp | grep -E ':(80|8080|3000|2096)\\b' || true
curl -fsS -o /dev/null -w 'loopback:3000 %{http_code}\\n' http://127.0.0.1:3000/ || true
curl -fsS -o /dev/null -w 'http80 %{http_code}\\n' http://127.0.0.1/ || true
curl -fsS -o /dev/null -w 'http8080 %{http_code}\\n' http://127.0.0.1:8080/ || true
systemctl is-active x-ui
pm2 list
echo DONE
`;
    const result = await exec(conn, remote);
    process.exit(result.code);
  } finally {
    conn.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
