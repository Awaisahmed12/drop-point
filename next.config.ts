import type { NextConfig } from "next";

// Where the page loads things from. Report-only until the browser console
// on a preview shows no violations, then rename the header to
// Content-Security-Policy. Supabase, Google Maps/Picker and Vercel's
// preview toolbar are the only third parties.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://maps.googleapis.com https://maps.gstatic.com https://apis.google.com https://accounts.google.com https://www.gstatic.com https://vercel.live`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.googleapis.com https://*.gstatic.com https://*.googleusercontent.com https://*.ggpht.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://www.googleapis.com https://content.googleapis.com https://apis.google.com https://accounts.google.com https://vercel.live wss://ws-us3.pusher.com",
  "frame-src https://docs.google.com https://*.supabase.co https://accounts.google.com https://content.googleapis.com https://vercel.live",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bxfydeqjmfjeanapfhpr.supabase.co',
        pathname: '/storage/v1/object/**', // Allow both public and signed URLs
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(self)',
          },
          {
            // Two years, subdomains too, eligible for the browser preload list.
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
