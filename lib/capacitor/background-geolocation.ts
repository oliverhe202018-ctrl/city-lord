import { registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export const configureBackgroundGeolocation = async () => {
    try {
        // High Accuracy and Foreground Service for Android
        // This prevents the OS from killing the process during outdoor runs.
        await BackgroundGeolocation.addWatcher(
            {
                backgroundMessage: "City Lord 正在后台记录您的跑步领地...",
                backgroundTitle: "领地探索中",
                requestPermissions: true,
                stale: false,
                distanceFilter: 5 // 5 meters
            },
            (location, error) => {
                if (error) {
                    console.error('[BackgroundGeolocation] Watcher error:', error);
                    return;
                }
                if (location) {
                    // This is handled by GlobalLocationProvider / useSafeGeolocation
                    // but we keep the watcher active for Foreground Service.
                    console.debug('[BackgroundGeolocation] Point received in background');
                }
            }
        );
        console.log('[BackgroundGeolocation] Configured with High Accuracy & Foreground Service');
    } catch (err) {
        console.error('[BackgroundGeolocation] Configuration failed:', err);
    }
};

export default BackgroundGeolocation;
