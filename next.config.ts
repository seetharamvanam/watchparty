import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // App Router + API routes. No vercel.json and no output: "export" — do not
  // force a static Output Directory of "public" (that Vercel project setting
  // caused Preview to fail; DevOps is switching Framework Preset to Next.js).
  serverExternalPackages: ["postgres", "ably", "livekit-server-sdk"],
};

export default nextConfig;
