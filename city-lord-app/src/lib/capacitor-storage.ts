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
      console.warn('Preferences get error', e);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await Preferences.set({ key: name, value });
      // Keep it synced to localStorage to help debugging or fallback
      if (typeof window !== 'undefined') {
         window.localStorage.setItem(name, value);
      }
    } catch (e) {
      console.warn('Preferences set error', e);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await Preferences.remove({ key: name });
      if (typeof window !== 'undefined') {
         window.localStorage.removeItem(name);
      }
    } catch (e) {
      console.warn('Preferences remove error', e);
    }
  },
};
