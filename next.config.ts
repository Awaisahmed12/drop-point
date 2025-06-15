import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  images: {
    domains: ["maps.googleapis.com"],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bxfydeqjmfjeanapfhpr.supabase.co',
        pathname: '/storage/v1/object/public/property-files/**',
      },
    ],
  },
};

export default nextConfig;
