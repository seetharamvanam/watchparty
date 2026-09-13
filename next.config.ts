import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep native/node clients out of the serverless bundle. Do not pull PGlite/WASM.
  serverExternalPackages: ["postgres", "ably", "livekit-server-sdk"],
};

export default nextConfig;
