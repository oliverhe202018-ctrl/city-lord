import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.citylord.game.pro',
  appName: 'City Lord',
  webDir: 'out',
  //server: {
    // ⚠️ 关键修改在这里！
    // 把下面的 IP 换成你刚刚查到的电脑 IP
    // 端口号通常是 3000 (Next.js 默认)
  //  url: 'http://192.168.0.101:3000', 
  //  cleartext: true // 允许 http (非 https) 请求
  //}
};

export default config;
