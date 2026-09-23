import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by the Dockerfile: emits a self-contained server bundle.
  output: "standalone",
};

export default nextConfig;
