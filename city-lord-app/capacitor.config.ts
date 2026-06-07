import type { CapacitorConfig } from '@capacitor/cli';

const isProd = process.env.CAP_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.citylord.app',
  appName: 'City Lord',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
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
/*
  server: isProd ? {
    url: 'https://cl1.6543666.xyz',
    cleartext: true,
    allowNavigation: [
      'cl1.6543666.xyz',
      '*.cl1.6543666.xyz'
    ]
  } : {
    url: 'http://10.0.2.2:3000',
    cleartext: true
  }
*/
};

export default config;
