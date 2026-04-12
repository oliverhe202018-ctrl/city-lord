import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|mp3|wav|woff2?|ttf|eot)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /_next\/static\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-static-js-assets',
          expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /\/api\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'apis',
          expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'pages',
          expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
    ],
  },
});

const CAPACITOR_ORIGINS = [
  'capacitor://localhost',
  'http://localhost',
  'ionic://localhost',
];

const DEV_ORIGINS = process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [];
const allowedOrigins = [...CAPACITOR_ORIGINS, ...DEV_ORIGINS].join(',');

const nextConfig: NextConfig = {
  serverExternalPackages: ['ioredis', '@prisma/client'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000,
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL
          ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
          : '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: allowedOrigins },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization,X-Idempotency-Key' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Max-Age', value: '600' },
        ],
      },
    ];
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        dns: false,
      };
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []),
        'ioredis',
      ];
    }
    return config;
  },
};

export default withSentryConfig(withPWA(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  webpack: {
    reactComponentAnnotation: { enabled: true },
  },
  tunnelRoute: "/monitoring",
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  silent: true,
});
