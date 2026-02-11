const DJANGO_API_BASE = process.env.DJANGO_API_BASE || 'http://127.0.0.1:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid Next's automatic `/path/ -> /path` redirects.
  // This is especially important for proxied Django/DRF endpoints that conventionally end with `/`.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const raw = process.env.DJANGO_API_BASE || "";

    if (!raw) {
      console.warn(
        "DJANGO_API_BASE is not defined. Set it in frontend/.env.local (e.g. DJANGO_API_BASE=http://127.0.0.1:8000)"
      );
      return [];
    }

    // Normalize: remove trailing slash and optional trailing /api
    const base = raw.replace(/\/$/, "").replace(/\/api$/, "");

    return [
      {
        source: "/api/:path*",
        destination: `${base}/api/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
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
        protocol: "https",
        hostname: "**",
        pathname: "/media/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${DJANGO_API_BASE.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;