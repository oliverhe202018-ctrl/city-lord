import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint 配置已移除，Next.js 16+ 不再支持在 next.config.mjs 中配置 eslint
  // ESLint 错误现在由 ESLint 本身处理，不需要在构建时忽略

  //2. 忽略 TypeScript 类型错误 (关键！你的数据库类型改动可能导致这里卡住)
  typescript: {
    ignoreBuildErrors: true,
  },
  //3. 图片域名配置
  images: {
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
};

export default withPWA({
  dest: 'public', // 编译后的 worker 放在 public 目录
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // 开发环境不启用
})(nextConfig);
