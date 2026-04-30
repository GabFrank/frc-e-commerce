import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.frc-ecommerce.com' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'http', hostname: 'localhost' },
      // Stub R2 actual mientras no se instale AWS SDK real (ver TODO.md)
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
};

export default nextConfig;
