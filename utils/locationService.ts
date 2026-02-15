import { isCapacitorAvailable, safeBackgroundGeolocationAddWatcher, safeBackgroundGeolocationRemoveWatcher } from "@/lib/capacitor/safe-plugins";

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

      // Capacitor logic skipped in Web View to prevent console spam
      // We only use this in native app context
      if (typeof window !== 'undefined' && !isCapacitorAvailable()) {
          console.log('[LocationService] Web environment detected, skipping native background geolocation');
          return 'web-watcher-id';
      }

      // 1. 先添加 Watcher
      const watcherId = await safeBackgroundGeolocationAddWatcher(
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
      if (!watcherId) return 'web-watcher-id';
      return watcherId;
    } catch (e) {
      console.error("Start tracking failed", e);
      throw e;
    }
  },

  // 停止跑步记录
  stopTracking: async (watcherId: string) => {
    if (watcherId === 'web-watcher-id') return;
    if (watcherId) {
      try {
        await safeBackgroundGeolocationRemoveWatcher(watcherId);
      } catch (e) {
        console.warn("Stop tracking failed or already stopped", e);
      }
    }
  },

  // Check status (Optional helper)
  checkStatus: async () => {
      // Not directly exposed by plugin usually, but we can try to re-request permissions or just assume alive
      // Or check internal state if we maintained it
  }
};
