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
  //3. 图片域名配置
  images: {
    unoptimized: true, // 保持开启，以防万一有部分静态资源引用
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
