import { Capacitor } from '@capacitor/core';

export const isNativeApp = () => {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform();
};

export const loadCapacitorPlugin = async <T>(
  pluginName: string,
  importFn: () => Promise<T>
): Promise<T | null> => {
  if (!isNativeApp()) {
    return null;
  }
  try {
    return await importFn();
  } catch (e) {
    console.warn(`Failed to load Capacitor plugin: ${pluginName}`, e);
    return null;
  }
};
