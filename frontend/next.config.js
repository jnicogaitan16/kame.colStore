/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Local Django dev server (Django commonly serves media from /media/)
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/media/**',
      },

      // NOTE: This is very permissive. Keep only if you intentionally serve /media
      // from arbitrary HTTPS hosts. Prefer restricting this to your real domains.
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/media/**',
      },
    ],
  },
};

module.exports = nextConfig;
