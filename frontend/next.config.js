/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid Next's automatic `/path/ -> /path` redirects.
  // This is especially important for proxied Django/DRF endpoints that conventionally end with `/`.
  skipTrailingSlashRedirect: true,

  async rewrites() {
    // Read from .env.local (DJANGO_API_BASE=...) with a stricter, non-hardcoded approach.
    const raw = (process.env.DJANGO_API_BASE || "").trim();

    if (!raw) {
      throw new Error(
        "DJANGO_API_BASE is not defined. Set it in frontend/.env.local (e.g. http://127.0.0.1:8000)"
      );
    }

    // Normalize: remove trailing slash and optional trailing /api
    const base = raw.replace(/\/+$/, "").replace(/\/api$/, "");

    return [
      {
        source: "/api/:path*",
        destination: `${base}/api/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${base}/media/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `${base}/static/:path*`,
      },
    ];
  },

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
    ],
  },
};

module.exports = nextConfig;