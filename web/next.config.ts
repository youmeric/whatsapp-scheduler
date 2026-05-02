import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // "standalone" copies only what's needed for production into .next/standalone,
  // making the Docker image much smaller.
  output: "standalone",

  // Make sure the better-sqlite3 native binding gets included in the standalone
  // build (Next.js's tracer can miss .node files otherwise).
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/better-sqlite3/build/Release/*.node"],
  },

  // better-sqlite3 must be a server-only external (Turbopack/SWC otherwise
  // tries to bundle native code).
  serverExternalPackages: ["better-sqlite3"],
}

export default nextConfig
