import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.citytour.app',
  appName: 'City Lord',
  webDir: 'public',
  server: {
    url: "https://cl.4567666.xyz",
    cleartext: true
  }
};

export default config;
