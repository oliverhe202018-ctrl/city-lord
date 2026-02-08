import { registerPlugin } from '@capacitor/core';
import { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export const LocationService = {
  // 启动跑步记录
  startTracking: async () => {
    try {
      // 1. 先添加 Watcher
      // 关键配置：设置 backgroundTitle 和 backgroundMessage
      // 这会自动触发 Android 的前台服务通知，实现“免始终允许”的后台保活
      const watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "正在记录您的领地征程...",
          backgroundTitle: "City Lord 跑步中",
          requestPermissions: true, // 自动申请权限
          stale: false,
          distanceFilter: 5 // 5米更新一次
        },
        (location, error) => {
          if (error) {
            console.error("Location error:", error);
            return;
          }
          // 发送自定义事件，供 UI 层监听并画线
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('new-location', { detail: location }));
          }
        }
      );
      return watcherId;
    } catch (e) {
      console.error("Start tracking failed", e);
      throw e;
    }
  },

  // 停止跑步记录
  stopTracking: async (watcherId: string) => {
    if (watcherId) {
      await BackgroundGeolocation.removeWatcher({ id: watcherId });
    }
  }
};
