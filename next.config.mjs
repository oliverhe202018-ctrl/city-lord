import path from 'path';
import { fileURLToPath } from 'url';
import { withSentryConfig } from '@sentry/nextjs';
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

  // 2. 移除 Static Export 模式，避免与 Server Actions 冲突

  // 3. 图片域名配置
  images: {
    unoptimized: true,
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

  // CORS Configuration for Mobile APK Development
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },

  // 4. Turbopack 配置
  turbopack: {},
};

export default withSentryConfig(withPWA(nextConfig), {
  // Sentry 配置
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // 在错误日志里记录 React 组件名
  reactComponentAnnotation: { enabled: true },

  // 避免广告拦截器屏蔽 Sentry 请求
  tunnelRoute: "/monitoring",

  // 生产环境不暴露源码
  hideSourceMaps: true,

  // 构建时不输出 Sentry 日志
  silent: true,

  // 禁用自动上传 source maps（需先配置 Sentry auth token）
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
});
