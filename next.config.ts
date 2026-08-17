import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Freebuff preview serves the dev server through a
  // `*.daytonaproxy01.net` proxy origin. Without this, Next.js blocks
  // cross-origin requests to its dev assets (JS chunks, HMR), leaving the
  // preview without working JavaScript. Development-only: this option is
  // ignored by production builds on Vercel.
  allowedDevOrigins: ["*.daytonaproxy01.net"],
};

export default nextConfig;
