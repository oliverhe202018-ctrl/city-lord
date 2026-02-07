import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xiangfei.citylord',
  appName: 'City Lord',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // 预留给后续插件配置
  }
};

export default config;
