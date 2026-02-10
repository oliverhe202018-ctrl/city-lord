import OneSignal from 'onesignal-cordova-plugin';

export const OneSignalConfig = {
    appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "YOUR_ONESIGNAL_APP_ID",
};

export function initOneSignal() {
    if (typeof window === 'undefined') return;

    try {
        // Only run on native platforms where the plugin is available
        // For web, OneSignal has a different SDK (react-onesignal or vanilla JS)
        // But onesignal-cordova-plugin works on native (Android/iOS)
        
        // Check if plugin is available
        if (window.plugins && window.plugins.OneSignal) {
            window.plugins.OneSignal.setAppId(OneSignalConfig.appId);
            
            window.plugins.OneSignal.setNotificationOpenedHandler(function(jsonData) {
                console.log('notificationOpenedCallback: ' + JSON.stringify(jsonData));
            });

            // Prompt for push notifications
            window.plugins.OneSignal.promptForPushNotificationsWithUserResponse(function(accepted) {
                console.log("User accepted notifications: " + accepted);
            });
        } else {
            console.log("OneSignal Cordova Plugin not found (Web mode?)");
        }
    } catch (e) {
        // Suppress errors on devices without GMS or other initialization issues
        console.warn("OneSignal init failed (safely ignored):", e);
    }
}

export function setExternalUserId(userId: string) {
    if (typeof window !== 'undefined' && window.plugins && window.plugins.OneSignal) {
        window.plugins.OneSignal.setExternalUserId(userId);
    }
}
