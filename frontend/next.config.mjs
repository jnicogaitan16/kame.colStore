import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  skipTrailingSlashRedirect: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.wompi.co https://checkout.wompi.co https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.r2.dev https://*.r2.cloudflarestorage.com https://kame-colstore.onrender.com https://res.cloudinary.com",
              "connect-src 'self' https://api.wompi.co https://*.sentry.io https://*.ingest.sentry.io",
              "frame-src https://checkout.wompi.co https://challenges.cloudflare.com",
              "font-src 'self' data:",
            ].join("; "),
          },
        ],
      },
    ];
  },

  images: {
    unoptimized: process.env.NEXT_ENABLE_IMAGE_OPTIMIZATION !== "true",
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/media/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/media/**" },
      { protocol: "http", hostname: "192.168.20.128", port: "8000", pathname: "/media/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "*.trycloudflare.com", pathname: "/media/**" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com", pathname: "/**" },
      { protocol: "https", hostname: "*.r2.dev", pathname: "/**" },
      { protocol: "https", hostname: "kame-colstore.onrender.com", pathname: "/**" },
    ],
  },
};

/** En `next dev`, el wrapper de Sentry (webpack plugin, tunnelRoute, etc.) puede romper HMR y servir 404 en `/_next/static`. En producción sí aplica. */
const sentryBuildOptions = {
  org: "kamecol",
  project: "kamecol-frontend",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  tunnelRoute: "/monitoring",
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
};

export default process.env.NODE_ENV === "production"
  ? withSentryConfig(nextConfig, sentryBuildOptions)
  : nextConfig;
