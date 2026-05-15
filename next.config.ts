import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // public/user-guides/ is a static dir; Next.js won't auto-serve its
      // index.html for the bare /user-guides path, so map it explicitly.
      { source: '/user-guides', destination: '/user-guides/index.html' },
    ];
  },
};

export default nextConfig;
