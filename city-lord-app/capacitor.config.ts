import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.citylord.app',
  appName: 'City Lord',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#000000',
    webContentsDebuggingEnabled: false,
  },
  // [P0 Fix] 纯静态离线模式：彻底移除 server 节点，禁止 WebView 加载远程 URL
  // server: {
  //   url: 'https://cl1.6543666.xyz',
  //   cleartext: true
  // },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    // [P0 Fix] 允许 WebView 导航到 Supabase Auth 回调域名与高德地图域名
    // 防止 capacitor:// 协议下跨域被拦截导致 Crash
  },
};

export default config;
