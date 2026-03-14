/** @type {import('next').NextConfig} */

// Safe progressive migration path for Next image optimization.
// Default stays conservative to avoid breaking media delivery across mixed origins.
// When production URLs and normalizeMediaUrl() are fully validated, enable with:
// NEXT_ENABLE_IMAGE_OPTIMIZATION=true
const imageOptimizationEnabled =
  process.env.NEXT_ENABLE_IMAGE_OPTIMIZATION === "true";

const nextConfig = {
  // Avoid Next's automatic `/path/ -> /path` redirects.
  // This is especially important for proxied Django/DRF endpoints that conventionally end with `/`.
  skipTrailingSlashRedirect: true,

  images: {
    // Keep current safe behavior by default.
    // This allows a controlled rollout once all public image origins are verified.
    unoptimized: !imageOptimizationEnabled,

    // These settings become relevant once optimization is enabled.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,

    // Prep work for future LCP / PDP image tuning.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    remotePatterns: [
      // Local Django media (dev)
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/media/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
        pathname: "/media/**",
      },
      {
        protocol: "http",
        hostname: "192.168.20.128",
        port: "8000",
        pathname: "/media/**",
      },

      // Cloudinary
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },

      // Cloudflare Tunnel (trycloudflare.com)
      {
        protocol: "https",
        hostname: "*.trycloudflare.com",
        pathname: "/media/**",
      },

      // Cloudflare R2 public bucket (e.g. https://<accountid>.r2.cloudflarestorage.com/<bucket>/...)
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
        pathname: "/**",
      },

      // Cloudflare R2 public domain (r2.dev) e.g. https://pub-xxxx.r2.dev/...
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },

      // Render domain (if it serves media as well)
      {
        protocol: "https",
        hostname: "kame-colstore.onrender.com",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;