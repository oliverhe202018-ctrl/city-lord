import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.citylord.game',
  appName: 'CityLord',
  webDir: 'out', 
  server: {
    // ---------------------------------------------------
    // 模式 A：本地开发 (需要 npm run dev + adb reverse)
    // url: 'http://localhost:3000',
    // cleartext: true,
    // ---------------------------------------------------

    // ---------------------------------------------------
    // 模式 B：远程测试/生产 (不需要本地电脑运行项目)
    // ✅ 这里填你的真实线上域名
    url: 'https://cl.4567666.xyz',
    
    // ✅ 允许 App 跳转到这些域名 (非常重要，否则可能会白屏或跳出到浏览器)
    allowNavigation: [
      'city-lord.vercel.app',
      'cl.4567666.xyz',
      '*.vercel.app' 
    ]
    // ---------------------------------------------------
  }
};

export default config;