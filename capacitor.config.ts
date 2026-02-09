import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.citylord.game.pro',
  appName: 'City Lord',
  webDir: 'out',
  server: {
    url: 'https://cl.4567666.xyz',
    cleartext: true,
    allowNavigation: ['cl.4567666.xyz', '*.cl.4567666.xyz']
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
