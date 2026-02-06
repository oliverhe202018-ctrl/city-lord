import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.citytour.app',
  appName: 'City Lord',
  webDir: 'public',
  server: {
    url: "https://cl.4567666.xyz",
    cleartext: true,
    allowNavigation: [
      "*.city-tour.dev",
      "*.vercel.app",
      "cl.4567666.xyz",
      "*.4567666.xyz"
    ]
  }
};

export default config;
