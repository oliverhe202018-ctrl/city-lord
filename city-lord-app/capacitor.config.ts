import type { CapacitorConfig } from '@capacitor/cli';

const isProd = process.env.CAP_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.citylord.app',
  appName: 'City Lord',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#000000',
    webContentsDebuggingEnabled: false,
    overrideUserAgent: '',
    buildOptions: {
      keystorePassword: '',
      keystoreAlias: '',
      keystoreAliasPassword: '',
    }
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
//   server: {
//     cleartext: true
//   }
};

export default config;
