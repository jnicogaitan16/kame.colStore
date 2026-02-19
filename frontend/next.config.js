/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid Next's automatic `/path/ -> /path` redirects.
  // This is especially important for proxied Django/DRF endpoints that conventionally end with `/`.
  skipTrailingSlashRedirect: true,

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
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
    ],
  },
};

module.exports = nextConfig;