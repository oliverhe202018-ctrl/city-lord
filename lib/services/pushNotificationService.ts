/**
 * Push Notification Service (Removed - Rescue Branch)
 * 原版本已将所有 Firebase 依赖和注册逻辑彻底切断。
 * 第一批次救援版本：只保留签名，不再触发任何原生注册请求。
 */

export async function initPushNotifications(): Promise<void> {
    console.debug('[PushNotification] Completely disabled in rescue-no-firebase branch.');
}

