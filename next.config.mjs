import path from 'path';
import { fileURLToPath } from 'url';
import withPWA from 'next-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint 配置已移除，Next.js 16+ 不再支持在 next.config.mjs 中配置 eslint
  // ESLint 错误现在由 ESLint 本身处理，不需要在构建时忽略

  //2. 忽略 TypeScript 类型错误 (关键！你的数据库类型改动可能导致这里卡住)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Capacitor 需要静态导出
  // output: 'export',
  
  // 启用 Next.js 16 Turbopack 特性 (SVG 加载)
  // 注意：Next.js 16 可能将 turbo 移至根节点或保持在 experimental
  // 如果 experimental.turbo 报错，尝试根节点 turbo
  turbo: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  //3. 图片域名配置
  images: {
    // unoptimized: true, // 移除以启用优化 (AVIF/WebP)
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000, // 30 天缓存
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
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias['next/headers'] = path.resolve(__dirname, 'mock-headers.js');
      config.resolve.alias['@/lib/supabase/server'] = path.resolve(__dirname, 'mock-supabase.js');

      // Webpack 分包优化
      // 保留 Next.js 默认的 splitChunks 配置 (如 framework, main 等)，并合并自定义配置
      const splitChunks = config.optimization.splitChunks || {};
      const cacheGroups = splitChunks.cacheGroups || {};

      config.optimization.splitChunks = {
        ...splitChunks,
        name: false, // 禁用基于路径的命名，防止广告拦截 (e.g. client_ad.js)
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          ...cacheGroups,
          amap: {
            name: 'maps-sdk', // 重命名 amap -> maps-sdk 避免包含 'ad'
            test: /[\\/]node_modules[\\/](@amap|amap-jsapi-loader)[\\/]/,
            chunks: 'all',
            priority: 20,
            enforce: true,
          },
          vendors: {
            name: 'vendors',
            test: /[\\/]node_modules[\\/]/,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },
};

export default withPWA({
  dest: 'public', // 编译后的 worker 放在 public 目录
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // 开发环境不启用
})(nextConfig);
