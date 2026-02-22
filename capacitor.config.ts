import type { CapacitorConfig } from '@capacitor/cli';

import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.citylord.game.pro',
  appName: 'City Lord',
  webDir: 'out',
  server: {
    url: 'https://cl.4567666.xyz',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      'cl.4567666.xyz',
      '*.cl.4567666.xyz'
    ]
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: false,
      style: KeyboardStyle.Dark
    }
  }
};

export default config;
