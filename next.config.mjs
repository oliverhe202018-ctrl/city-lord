import path from 'path';
import { fileURLToPath } from 'url';
import withPWAInit from "@ducanh2912/next-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // 1. Static Assets (Images, Audio, Fonts) -> Cache First
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|mp3|wav|woff2?|ttf|eot)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          },
        },
      },
      // 2. Next.js Static Resources (_next/static) -> Stale While Revalidate
      {
        urlPattern: /_next\/static\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-static-js-assets',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
        },
      },
      // 3. API Routes -> Network First (or StaleWhileRevalidate if we want offline access)
      // Since we use TanStack Query for data persistence, we can rely on NetworkFirst here
      // to get fresh data when online, and let TanStack handle the offline cache via IDB.
      // HOWEVER, for App Shell architecture, critical APIs could be SWR.
      // Let's stick to NetworkFirst for API to ensure freshness, as Query will handle the persistence layer.
      {
        urlPattern: /\/api\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'apis',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
          networkTimeoutSeconds: 10, // Fallback to cache if network is slow
        },
      },
      // 4. Document/Pages -> Stale While Revalidate (Instant App Shell)
      {
        urlPattern: ({ request, url }) => request.mode === 'navigate',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'pages',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60, 
          },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 忽略 TypeScript 类型错误
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 2. 启用 Standalone 模式
  output: 'standalone',

  // 3. 图片域名配置
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // 4. Turbopack 配置
  turbopack: {},
};

export default withPWA(nextConfig);
