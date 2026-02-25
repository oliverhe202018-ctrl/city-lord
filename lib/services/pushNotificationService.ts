/**
 * Push Notification Service
 *
 * 仅在 Capacitor 原生平台（iOS/Android）运行。
 * - 注册 FCM token 并 upsert 到 Supabase device_tokens 表
 * - 监听推送点击，通过 CustomEvent('push-navigate') 事件总线
 *   通知根布局组件执行 router.push() 导航
 */

import { isNativePlatform } from '@/lib/capacitor/safe-plugins'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * 初始化推送通知系统。
 * 须在 App 启动时调用一次（由 PushNotificationBootstrapper 组件挂载）。
 * Web 端调用此方法会直接返回，不执行任何操作。
 */
export async function initPushNotifications(): Promise<void> {
    try {
        const isNative = await isNativePlatform()
        if (!isNative) {
            console.debug('[PushNotification] Not native platform, skipping')
            return
        }

        const { PushNotifications } = await import('@capacitor/push-notifications')

        // 请求推送权限
        const permResult = await PushNotifications.requestPermissions()
        if (permResult.receive !== 'granted') {
            console.debug('[PushNotification] Permission not granted:', permResult.receive)
            return
        }

        // 注册推送
        await PushNotifications.register()

        // 监听 registration 事件 → 拿到 FCM token
        PushNotifications.addListener('registration', async (token) => {
            console.debug('[PushNotification] Token received:', token.value.slice(0, 20) + '...')
            try {
                await upsertDeviceToken(token.value)
            } catch (error) {
                console.error('[PushNotification] Token upsert failed:', error)
                // Sentry 上报将在 Task B 中添加
                try {
                    const Sentry = await import('@sentry/nextjs')
                    Sentry.captureException(error, { tags: { feature: 'push_notifications' } })
                } catch {
                    // Sentry not available yet
                }
            }
        })

        // 监听 registration 失败
        PushNotifications.addListener('registrationError', (error) => {
            console.error('[PushNotification] Registration error:', error)
            try {
                import('@sentry/nextjs').then(Sentry => {
                    Sentry.captureException(new Error(`Push registration failed: ${JSON.stringify(error)}`), {
                        tags: { feature: 'push_notifications' },
                    })
                }).catch(() => { })
            } catch {
                // Sentry not available
            }
        })

        // 监听推送点击 → 通过 CustomEvent 事件总线通知导航
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            const route = notification.notification?.data?.route
            if (route && typeof window !== 'undefined') {
                console.debug('[PushNotification] Deep link navigation:', route)
                window.dispatchEvent(
                    new CustomEvent('push-navigate', { detail: { route } })
                )
            }
        })

        // 监听前台通知（可选：显示 toast 或本地通知）
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.debug('[PushNotification] Foreground notification:', notification.title)
        })

        console.debug('[PushNotification] Initialized successfully')
    } catch (error) {
        console.warn('[PushNotification] Initialization failed silently:', error)
        try {
            const Sentry = await import('@sentry/nextjs')
            Sentry.captureException(error, { tags: { feature: 'push_notifications' } })
        } catch {
            // Sentry not available
        }
    }
}

/**
 * Upsert FCM token 到 device_tokens 表
 */
async function upsertDeviceToken(token: string): Promise<void> {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        console.debug('[PushNotification] No authenticated user, skipping token upsert')
        return
    }

    // 获取平台
    let platform: 'ios' | 'android' = 'android'
    try {
        const { Capacitor } = await import('@capacitor/core')
        const p = Capacitor.getPlatform()
        if (p === 'ios') platform = 'ios'
    } catch { }

    const { error } = await supabase
        .from('device_tokens')
        .upsert(
            {
                user_id: user.id,
                token,
                platform,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id, token' }
        )

    if (error) {
        throw new Error(`device_tokens upsert failed: ${error.message}`)
    }

    console.debug('[PushNotification] Token upserted successfully')
}
