import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@my-agents/domain', '@my-agents/infrastructure', '@my-agents/application'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

export default nextConfig;
