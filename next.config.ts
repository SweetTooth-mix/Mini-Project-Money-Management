import type { NextConfig } from "next";

// Development only: the preview environment embeds the app in an iframe and
// proxies it from another host. Production keeps DENY + frame-ancestors 'none'.
const isDev = process.env.NODE_ENV === "development";
const devPreviewOrigins = (process.env.DEV_PREVIEW_ORIGINS ?? "")
  .split(",")
  .map((origin) =>
    origin
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, ""),
  )
  .filter(Boolean);

const config: NextConfig = {
  poweredByHeader: false,
  ...(devPreviewOrigins.length ? { allowedDevOrigins: devPreviewOrigins } : {}),
  outputFileTracingIncludes: {
    "/api/reports": ["./templates/excel/*.xlsx", "./scripts/excel/generate.py"],
  },
  outputFileTracingExcludes: { "/api/reports": ["./.venv/**"] },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...(isDev ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(process.env.APP_URL?.startsWith("https://")
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};
export default config;
