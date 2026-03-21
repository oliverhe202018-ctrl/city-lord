import { isCapacitorAvailable, safeAMapStartTracking, safeAMapStopTracking } from "@/lib/capacitor/safe-plugins";

export const LocationService = {
  // 启动跑步记录
  startTracking: async (userId?: string) => {
    try {
      // Capacitor logic skipped in Web View to prevent console spam
      // We only use this in native app context
      if (typeof window !== 'undefined' && !isCapacitorAvailable()) {
          console.log('[LocationService] Web environment detected, skipping native background geolocation');
          return 'web-watcher-id';
      }

      // Start the native iOS/Android Foreground Service via AMapLocationPlugin
      // This guarantees WakeLock, persistent notification, and 2s interval tracking
      const result = await safeAMapStartTracking({
          notificationTitle: "City Lord 跑步中",
          notificationBody: "正在记录您的领地征程...",
          interval: 2000,
          startedAt: Date.now()
      });

      if (!result.success) {
          console.warn('[LocationService] Native tracking failed to start (might be web/simulator)', result.reason);
          return 'web-watcher-id';
      }

      // The native service will broadcast 'locationUpdate' events via the plugin listener,
      // which are caught by GlobalLocationProvider in _app.tsx or useSafeGeolocation.
      
      return 'native-amap-tracking';
    } catch (e) {
      console.error("Start tracking failed", e);
      throw e;
    }
  },

  // 停止跑步记录
  stopTracking: async (watcherId: string) => {
    if (watcherId === 'web-watcher-id') return;
    try {
        console.log('[LocationService] Stopping native tracking...');
        await safeAMapStopTracking();
    } catch (e) {
      console.warn("Stop tracking failed or already stopped", e);
    }
  },

  // Check status (Optional helper)
  checkStatus: async () => {
      // Not directly exposed by plugin usually, but we can try to re-request permissions or just assume alive
      // Or check internal state if we maintained it
  }
};
