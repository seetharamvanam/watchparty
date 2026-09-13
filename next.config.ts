import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // App Router + API routes. No vercel.json and no output: "export" — do not
  // force a static Output Directory of "public" (that Vercel project setting
  // caused Preview to fail; DevOps is switching Framework Preset to Next.js).
  serverExternalPackages: ["postgres", "ably", "livekit-server-sdk"],
  // Client Ably / LiveKit / hls.js must stay in async chunks. Home never
  // statically imports them; room pages load them after join via next/dynamic.
  webpack: (config, { isServer }) => {
    if (isServer) return config;
    const split = config.optimization?.splitChunks;
    if (!split || typeof split !== "object") return config;
    split.cacheGroups = {
      ...split.cacheGroups,
      watchpartyRealtimeSdks: {
        test: /[\\/]node_modules[\\/](ably|livekit-client|hls\.js)[\\/]/,
        name(module: { context?: string }) {
          const match = module.context?.match(/[\\/]node_modules[\\/](ably|livekit-client|hls\.js)/);
          return `sdk-${(match?.[1] ?? "realtime").replace(".", "")}`;
        },
        chunks: "async",
        priority: 40,
        reuseExistingChunk: true,
      },
    };
    return config;
  },
};

export default nextConfig;
