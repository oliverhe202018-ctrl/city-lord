import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.citylord.game.pro',
  appName: 'City Lord',
  webDir: 'out',
  server: {
    url: 'https://cl.4567666.xyz',
    cleartext: true,
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
      resize: "native",
      resizeOnFullScreen: false,
      style: "dark"
    }
  }
};

export default config;
