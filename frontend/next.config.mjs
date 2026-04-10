import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  skipTrailingSlashRedirect: true,

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
