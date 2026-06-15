import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
      },
    ],
  },
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./data/**/*'],
      '/api/**/*': ['./data/**/*'],
    },
  },
};

export default nextConfig;
