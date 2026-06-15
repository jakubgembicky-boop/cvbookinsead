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
  outputFileTracingIncludes: {
    '/**': ['./data/**/*'],
  },
};

export default nextConfig;
