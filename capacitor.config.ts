import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.citylord.game',
  appName: 'CityLord',
  webDir: 'out', // 或者 'public'，这取决于你的构建输出，但在server模式下这个不太重要
  server: {
    // ✅ 这里填你 Vercel 的真实线上地址
    url: 'https://city-lord.vercel.app', 
    
    // ❌ 删掉 cleartext: true，或者设为 false，因为我们要用 HTTPS
    // cleartext: true 
    
    // ✅ 建议加上这个，允许 App 导航到该域名
    allowNavigation: [
      'city-lord.vercel.app',
      'cl.4567666.xyz'
    ]
  }
};

export default config;
