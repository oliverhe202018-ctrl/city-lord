import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * A persistent storage adapter that uses Capacitor Preferences (SharedPreferences on Android,
 * UserDefaults on iOS, IndexedDB/localStorage on Web) for durable storage.
 * 
 * It includes a seamless migration layer from `window.localStorage` so users don't
 * lose their sessions or game state when updating the app.
 */
export const capacitorStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      // [P0 Fix] 强制平台就绪校验，防止 WebView 初始化竞态导致 Crash
      if (!Capacitor.isNativePlatform()) {
        // Web 环境降级使用 localStorage
        if (typeof window !== 'undefined') {
          return window.localStorage.getItem(name);
        }
        return null;
      }

      const { value } = await Preferences.get({ key: name });
      if (value !== null) {
        return value;
      }
      
      // Seamless migration from old localStorage
      if (typeof window !== 'undefined') {
        const fallbackValue = window.localStorage.getItem(name);
        if (fallbackValue !== null) {
          // Found in old storage, migrate it to durable native storage
          await Preferences.set({ key: name, value: fallbackValue });
          return fallbackValue;
        }
      }
      
      return null;
    } catch (e) {
      console.warn('[CapacitorStorage] get error', e);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      // [P0 Fix] 强制平台就绪校验
      if (!Capacitor.isNativePlatform()) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(name, value);
        }
        return;
      }

      await Preferences.set({ key: name, value });
      // Keep it synced to localStorage to help debugging or fallback
      if (typeof window !== 'undefined') {
         window.localStorage.setItem(name, value);
      }
    } catch (e) {
      console.warn('[CapacitorStorage] set error', e);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      // [P0 Fix] 强制平台就绪校验
      if (!Capacitor.isNativePlatform()) {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(name);
        }
        return;
      }

      await Preferences.remove({ key: name });
      if (typeof window !== 'undefined') {
         window.localStorage.removeItem(name);
      }
    } catch (e) {
      console.warn('[CapacitorStorage] remove error', e);
    }
  },
};
