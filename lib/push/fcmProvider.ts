/**
 * FCM Push Provider
 *
 * 封装现有 @capacitor/push-notifications FCM 逻辑为 PushProvider 接口实现。
 * 仅在 Capacitor 原生平台运行，Web 端自动降级为 no-op。
 */

import { isNativePlatform } from '@/lib/capacitor/safe-plugins'
import { createClient } from '@supabase/supabase-js'
import type {
    PushProvider,
    TokenRefreshCallback,
    NotificationCallback,
    PushNotificationPayload,
} from './pushProvider'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export class FcmPushProvider implements PushProvider {
    readonly name = 'fcm' as const

    private _initialized = false
    private _token: string | null = null
    private _listenerHandles: Array<{ remove: () => void }> = []

    async init(): Promise<void> {
        if (this._initialized) {
            console.debug('[PushProvider:FCM] Already initialized, skipping')
            return
        }

        try {
            const isNative = await isNativePlatform()
            if (!isNative) {
                console.debug('[PushProvider:FCM] Not native platform, skipping')
                this._initialized = true
                return
            }

            const { PushNotifications } = await import('@capacitor/push-notifications')

            // 请求推送权限
            const permResult = await PushNotifications.requestPermissions()
            if (permResult.receive !== 'granted') {
                console.debug('[PushProvider:FCM] Permission not granted:', permResult.receive)
                this._initialized = true
                return
            }

            // 注册推送
            await PushNotifications.register()

            // 监听 registration → 拿到 FCM token
            const regHandle = await PushNotifications.addListener('registration', async (token) => {
                console.debug('[PushProvider:FCM] Token received:', token.value.slice(0, 20) + '...')
                this._token = token.value
                try {
                    await this._upsertDeviceToken(token.value)
                } catch (error) {
                    console.error('[PushProvider:FCM] Token upsert failed:', error)
                    this._reportError(error)
                }
            })
            this._listenerHandles.push(regHandle)

            // 监听 registration 失败
            const regErrHandle = await PushNotifications.addListener('registrationError', (error) => {
                console.error('[PushProvider:FCM] Registration error:', error)
                this._reportError(new Error(`FCM registration failed: ${JSON.stringify(error)}`))
            })
            this._listenerHandles.push(regErrHandle)

            this._initialized = true
            console.debug('[PushProvider:FCM] Initialized successfully')
        } catch (error) {
            console.warn('[PushProvider:FCM] Initialization failed silently:', error)
            this._reportError(error)
            this._initialized = true // Mark as initialized to prevent retry loops
        }
    }

    async getToken(): Promise<string | null> {
        return this._token
    }

    async setAlias(_alias: string): Promise<void> {
        // FCM 不原生支持 alias 概念，通过服务端 topic/condition 实现
        console.debug('[PushProvider:FCM] setAlias — FCM uses server-side targeting, no client-side alias')
    }

    async setTags(_tags: string[]): Promise<void> {
        // FCM 通过 topic subscription 实现类似功能
        console.debug('[PushProvider:FCM] setTags — FCM uses topics, not client-side tags')
    }

    onTokenRefresh(callback: TokenRefreshCallback): void {
        // FCM 的 token refresh 通过 'registration' 事件再次触发
        // 因为 init() 已经注册了 registration listener，
        // 这里额外包装一层让外部也能感知
        isNativePlatform().then(async (isNative) => {
            if (!isNative) return
            const { PushNotifications } = await import('@capacitor/push-notifications')
            const handle = await PushNotifications.addListener('registration', (token) => {
                callback(token.value)
            })
            this._listenerHandles.push(handle)
        }).catch(() => { })
    }

    onNotificationReceived(callback: NotificationCallback): void {
        isNativePlatform().then(async (isNative) => {
            if (!isNative) return
            const { PushNotifications } = await import('@capacitor/push-notifications')
            const handle = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
                callback({
                    title: notification.title ?? undefined,
                    body: notification.body ?? undefined,
                    data: notification.data as Record<string, string> | undefined,
                })
            })
            this._listenerHandles.push(handle)
        }).catch(() => { })
    }

    onNotificationClicked(callback: (payload: PushNotificationPayload & { route?: string }) => void): void {
        isNativePlatform().then(async (isNative) => {
            if (!isNative) return
            const { PushNotifications } = await import('@capacitor/push-notifications')
            const handle = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                callback({
                    title: action.notification?.title ?? undefined,
                    body: action.notification?.body ?? undefined,
                    data: action.notification?.data as Record<string, string> | undefined,
                    route: action.notification?.data?.route as string | undefined,
                })
            })
            this._listenerHandles.push(handle)
        }).catch(() => { })
    }

    cleanup(): void {
        for (const handle of this._listenerHandles) {
            try {
                handle.remove()
            } catch (e) {
                console.warn('[PushProvider:FCM] Failed to remove listener:', e)
            }
        }
        this._listenerHandles = []
        this._initialized = false
        this._token = null
    }

    // ─── Private helpers ───

    private async _upsertDeviceToken(token: string): Promise<void> {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            console.debug('[PushProvider:FCM] No authenticated user, skipping token upsert')
            return
        }

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
                    provider: 'fcm',
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id, token' }
            )

        if (error) {
            throw new Error(`device_tokens upsert failed: ${error.message}`)
        }

        console.debug('[PushProvider:FCM] Token upserted successfully')
    }

    private _reportError(error: unknown): void {
        try {
            import('@sentry/nextjs').then(Sentry => {
                Sentry.captureException(error, { tags: { feature: 'push_notifications', provider: 'fcm' } })
            }).catch(() => { })
        } catch {
            // Sentry not available
        }
    }
}
