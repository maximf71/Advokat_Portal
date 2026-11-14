import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PM2 on small VPS — skip standalone (heavier file tracing).
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Types already verified locally; skip on VPS to cut peak RAM.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
