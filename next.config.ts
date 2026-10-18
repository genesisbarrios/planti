import type { NextConfig } from "next";

// Cache Components is intentionally off: every Planti page is per-user and
// driven by fresh sensor data, so standard request-time rendering is simpler
// and avoids caching data that must reflect the latest reading.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
