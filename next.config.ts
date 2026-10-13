import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Excel imports are sent to a server action as base64. (Vercel itself caps a request at 4.5 MB.)
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
