import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
