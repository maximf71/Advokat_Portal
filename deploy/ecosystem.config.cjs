/** PM2 — bind Next.js to loopback only (Nginx proxies 80/8080). Never touch VPN ports. */
module.exports = {
  apps: [
    {
      name: "portal-advokatov",
      cwd: "/opt/portal-advokatov",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
      },
      max_memory_restart: "450M",
    },
  ],
};
