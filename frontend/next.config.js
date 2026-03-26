/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing from shared/ outside the frontend directory
  experimental: {
    externalDir: true,
  },

  // Compress responses
  compress: true,

  // Faster image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },

  // Reduce JS bundle — remove console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Headers for caching static assets
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/dashboard/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ];
  },
};

module.exports = nextConfig;
