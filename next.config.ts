import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // IJGB visa ticket artwork + fonts are read from disk at render time
  // (lib/server/ijgb/render.ts). Any route that can send a ticket email
  // (webhooks, verify, crons, resend, free checkout) may render one.
  outputFileTracingIncludes: {
    '/**/*': ['./lib/server/ijgb/assets/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
    ],
  },
};

export default nextConfig;
