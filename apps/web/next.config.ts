import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a small production Docker image.
  output: "standalone",
  // Trace workspace files from the monorepo root.
  outputFileTracingRoot: process.cwd().includes("/apps/web")
    ? process.cwd().replace(/\/apps\/web$/, "")
    : undefined,
};

export default nextConfig;
