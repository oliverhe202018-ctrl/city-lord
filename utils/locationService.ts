import { registerPlugin } from '@capacitor/core';
import { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export const LocationService = {
  // 启动跑步记录
  startTracking: async (authToken?: string) => {
    try {
      const syncConfig = authToken ? {
        url: `${process.env.NEXT_PUBLIC_API_URL || ''}/api/run/native-sync`,
        headers: { Authorization: `Bearer ${authToken}` },
        autoSync: true,
        autoSyncThreshold: 5, // Sync every 5 items
        batchSync: true,
        maxDaysToKeep: 1,
      } : {};

      // 1. 先添加 Watcher
      const watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "正在记录您的领地征程...",
          backgroundTitle: "City Lord 跑步中",
          requestPermissions: true, // 自动申请权限
          stale: false,
          distanceFilter: 5, // 5米更新一次
          ...syncConfig
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
