import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Freebuff preview serves the dev server through a
  // `*.daytonaproxy01.net` proxy origin. Without this, Next.js blocks
  // cross-origin requests to its dev assets (JS chunks, HMR), leaving the
  // preview without working JavaScript. Development-only: this option is
  // ignored by production builds on Vercel.
  allowedDevOrigins: ["*.daytonaproxy01.net"],

  // Security headers applied to every response.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "0",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
