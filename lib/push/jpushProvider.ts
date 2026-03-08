/**
 * JPush (极光推送) Provider — No-Op Stub
 *
 * 预留极光推送接入层。当前所有方法均为空实现，
 * 等后续接入 jpush-react-native 或 jpush-capacitor-plugin 后替换。
 *
 * 接入时需要：
 * 1. 安装极光 SDK（如 jpush-react-native 或对应 Capacitor 插件）
 * 2. 在 init() 中调用 JPush.init({ appKey: process.env.JPUSH_APP_KEY })
 * 3. 在 setAlias() 中调用 JPush.setAlias({ sequence: 1, alias })
 * 4. 在 setTags() 中调用 JPush.setTags({ sequence: 2, tags })
 * 5. 注册各 listener 并在 cleanup() 中移除
 * 6. upsert token 到 device_tokens 表，provider 填 'jpush'
 *
 * 环境变量：
 * - JPUSH_APP_KEY — 极光应用 AppKey
 * - JPUSH_MASTER_SECRET — 极光 Master Secret（仅服务端使用）
 * - JPUSH_APNS_PRODUCTION — iOS 推送环境 (true=生产, false=开发)
 */

import type {
    PushProvider,
    TokenRefreshCallback,
    NotificationCallback,
    PushNotificationPayload,
} from './pushProvider'

export class JpushPushProvider implements PushProvider {
    readonly name = 'jpush' as const

    async init(): Promise<void> {
        console.debug('[PushProvider:JPush] init — stub (SDK not yet integrated)')
        console.debug('[PushProvider:JPush] To integrate, install jpush SDK and implement this provider')

        // TODO: 接入极光 SDK 后替换以下逻辑
        // const appKey = process.env.JPUSH_APP_KEY
        // if (!appKey) {
        //   console.warn('[PushProvider:JPush] JPUSH_APP_KEY not configured')
        //   return
        // }
        // await JPush.init({ appKey, channel: 'default', isProduction: false })
    }

    async getToken(): Promise<string | null> {
        // TODO: return JPush.getRegistrationID()
        return null
    }

    async setAlias(alias: string): Promise<void> {
        console.debug(`[PushProvider:JPush] setAlias("${alias}") — stub`)
        // TODO: await JPush.setAlias({ sequence: Date.now(), alias })
    }

    async setTags(tags: string[]): Promise<void> {
        console.debug(`[PushProvider:JPush] setTags(${JSON.stringify(tags)}) — stub`)
        // TODO: await JPush.setTags({ sequence: Date.now(), tags })
    }

    onTokenRefresh(_callback: TokenRefreshCallback): void {
        // TODO: JPush.addListener('registrationId', (id) => callback(id))
        console.debug('[PushProvider:JPush] onTokenRefresh — stub')
    }

    onNotificationReceived(_callback: NotificationCallback): void {
        // TODO: JPush.addListener('notificationReceived', (notification) => callback({...}))
        console.debug('[PushProvider:JPush] onNotificationReceived — stub')
    }

    onNotificationClicked(
        _callback: (payload: PushNotificationPayload & { route?: string }) => void
    ): void {
        // TODO: JPush.addListener('notificationOpened', (notification) => callback({...}))
        console.debug('[PushProvider:JPush] onNotificationClicked — stub')
    }

    cleanup(): void {
        // TODO: JPush.removeAllListeners()
        console.debug('[PushProvider:JPush] cleanup — stub')
    }
}
