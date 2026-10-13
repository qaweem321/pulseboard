import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server bundle for the Docker image.
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
};

export default nextConfig;
