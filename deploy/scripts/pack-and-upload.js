/**
 * Pack project (excluding heavy/local junk) and upload via SSH/SFTP + extract.
 * Password: DEPLOY_SSH_PASS. Never logs the password.
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
const REMOTE_DIR = process.env.DEPLOY_REMOTE_DIR || "/opt/portal-advokatov";
const ARCHIVE = path.join(process.env.TEMP || process.env.TMP, "portal-advokatov-deploy.tgz");

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
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      stream.on("data", (d) => {
        const s = d.toString();
        stdout += s;
        process.stdout.write(s);
      });
      stream.stderr.on("data", (d) => {
        const s = d.toString();
        stderr += s;
        process.stderr.write(s);
      });
      stream.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
    });
  });
}

function upload(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      console.log(`Uploading ${local} -> ${remote} ...`);
      sftp.fastPut(local, remote, (e) => (e ? reject(e) : resolve()));
    });
  });
}

console.log("Packing from", ROOT);
const excludes = [
  "--exclude=node_modules",
  "--exclude=.next",
  "--exclude=.git",
  "--exclude=.cursor",
  "--exclude=.pgdata",
  "--exclude=.tmp-research",
  "--exclude=_vpn_setup",
  "--exclude=data/raw",
  "--exclude=data/tmp",
  "--exclude=.env",
  "--exclude=.env.local",
  "--exclude=.env.production",
  "--exclude=*.pem",
  "--exclude=tsconfig.tsbuildinfo",
  "--exclude=agent-transcripts",
];

// Prefer tar.exe (Windows 10+) or bsdtar
const tarCmd = process.platform === "win32" ? "tar" : "tar";
const r = spawnSync(
  tarCmd,
  ["-czf", ARCHIVE, ...excludes, "-C", ROOT, "."],
  { stdio: "inherit", shell: false }
);
if (r.status !== 0) {
  console.error("tar failed", r.status);
  process.exit(1);
}
const sizeMb = (fs.statSync(ARCHIVE).size / 1024 / 1024).toFixed(1);
console.log(`Archive size: ${sizeMb} MB`);

(async () => {
  const conn = await connect();
  try {
    await exec(conn, `mkdir -p '${REMOTE_DIR}' /tmp`);
    await upload(conn, ARCHIVE, "/tmp/portal-advokatov-deploy.tgz");
    await exec(
      conn,
      `mkdir -p '${REMOTE_DIR}' && tar -xzf /tmp/portal-advokatov-deploy.tgz -C '${REMOTE_DIR}' && rm -f /tmp/portal-advokatov-deploy.tgz && chown -R portal:portal '${REMOTE_DIR}' 2>/dev/null || chown -R root:root '${REMOTE_DIR}' && ls -la '${REMOTE_DIR}' | head`
    );
    console.log("Upload + extract OK");
  } finally {
    conn.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
