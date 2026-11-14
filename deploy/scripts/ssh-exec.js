/**
 * Minimal SSH/SCP helper (password auth). Password from env DEPLOY_SSH_PASS only.
 * Usage:
 *   node ssh-exec.js exec "command"
 *   node ssh-exec.js upload localPath remotePath
 *   node ssh-exec.js inventory
 */
const fs = require("fs");
const path = require("path");
const { Client } = require(path.join(
  process.env.TEMP || process.env.TMP || "/tmp",
  "portal-ssh-tools",
  "node_modules",
  "ssh2"
));

const HOST = process.env.DEPLOY_SSH_HOST || "130.78.12.100";
const USER = process.env.DEPLOY_SSH_USER || "root";
const PASS = process.env.DEPLOY_SSH_PASS;
const PORT = Number(process.env.DEPLOY_SSH_PORT || 22);

if (!PASS) {
  console.error("DEPLOY_SSH_PASS is required");
  process.exit(1);
}

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("error", reject)
      .connect({
        host: HOST,
        port: PORT,
        username: USER,
        password: PASS,
        readyTimeout: 20000,
        algorithms: {
          // tolerate older VPS crypto
        },
      });
  });
}

function exec(conn, command, { pty = false } = {}) {
  return new Promise((resolve, reject) => {
    conn.exec(command, { pty }, (err, stream) => {
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
      stream.on("close", (code) => {
        resolve({ code: code ?? 0, stdout, stderr });
      });
    });
  });
}

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(localPath, remotePath, (e) => {
        if (e) reject(e);
        else resolve();
      });
    });
  });
}

async function ensureRemoteDir(conn, remoteDir) {
  await exec(conn, `mkdir -p ${JSON.stringify(remoteDir).slice(1, -1)}`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    console.error("Usage: node ssh-exec.js <exec|upload|inventory> ...");
    process.exit(1);
  }

  let conn;
  try {
    conn = await connect();
  } catch (e) {
    console.error("SSH_CONNECT_FAILED:", e.message || e);
    process.exit(2);
  }

  try {
    if (cmd === "inventory") {
      const script = [
        "echo '=== ss -tulnp ==='",
        "ss -tulnp || netstat -tulnp || true",
        "echo '=== docker ps ==='",
        "docker ps -a --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}\\t{{.Status}}' 2>/dev/null || echo 'docker missing'",
        "echo '=== systemctl ==='",
        "for u in x-ui xray hysteria hysteria2 nginx caddy docker; do printf '%s: ' \"$u\"; systemctl is-active \"$u\" 2>/dev/null || echo inactive/missing; done",
        "echo '=== listening focus ==='",
        "ss -tulnp | grep -E ':(80|443|8080|2096|2097|3000|5432)\\b' || true",
        "echo '=== UDP 443 detail ==='",
        "ss -ulnp | grep ':443' || echo 'no UDP 443'",
        "echo '=== TCP 443 detail ==='",
        "ss -tlnp | grep ':443' || echo 'no TCP 443'",
        "echo '=== disk ==='",
        "df -h / | tail -1",
        "echo '=== os ==='",
        "cat /etc/os-release | head -5",
      ].join("; ");
      const r = await exec(conn, script);
      process.exit(r.code);
    }

    if (cmd === "exec") {
      const command = args.join(" ");
      const r = await exec(conn, command, { pty: true });
      process.exit(r.code);
    }

    if (cmd === "upload") {
      const [localPath, remotePath] = args;
      if (!localPath || !remotePath) {
        console.error("upload requires localPath remotePath");
        process.exit(1);
      }
      const remoteDir = path.posix.dirname(remotePath.replace(/\\/g, "/"));
      await exec(conn, `mkdir -p '${remoteDir.replace(/'/g, `'\\''`)}'`);
      await uploadFile(conn, localPath, remotePath);
      console.log(`uploaded ${localPath} -> ${remotePath}`);
      process.exit(0);
    }

    console.error("Unknown command:", cmd);
    process.exit(1);
  } finally {
    conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
