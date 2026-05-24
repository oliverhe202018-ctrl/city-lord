import type { CapacitorConfig } from '@capacitor/cli';

import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

// 动态环境配置：基于 CAP_ENV 环境变量
const isProduction = process.env.CAP_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.citylord.game.pro',
  appName: 'City Lord',
  webDir: 'out',
  server: {
    url: isProduction ? 'https://cl1.4567666.xyz' : 'http://10.0.2.2:3000',
    cleartext: !isProduction,
    androidScheme: 'https',
    allowNavigation: isProduction
      ? ['cl1.4567666.xyz', '*.cl1.4567666.xyz']
      : ['localhost', '10.0.2.2', '127.0.0.1']
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      backgroundColor: '#00000000',
    },
    Keyboard: {
      resize: KeyboardResize.None,
      resizeOnFullScreen: false,
      style: KeyboardStyle.Dark
    },
    // 显式声明 AMapLocation 插件节点
    AMapLocation: {
      // 插件配置项
    }
  }
};

export default config;
