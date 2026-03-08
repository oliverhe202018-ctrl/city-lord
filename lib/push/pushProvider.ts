/**
 * Push Provider Abstraction Layer
 *
 * 提供统一的推送通知接口，支持多厂商切换（FCM / JPush / Noop）。
 * 通过 NEXT_PUBLIC_PUSH_PROVIDER 环境变量选择具体实现。
 *
 * 设计原则：
 * - 业务代码只依赖 PushProvider 接口，不直接依赖厂商 SDK
 * - 未配置任何 provider 时自动降级为 NoopPushProvider
 * - 每个 provider 实现自己的 init/cleanup 生命周期
 */

// ============================================================
// PushProvider Interface
// ============================================================

export interface PushNotificationPayload {
    title?: string
    body?: string
    data?: Record<string, string>
}

export type TokenRefreshCallback = (token: string) => void
export type NotificationCallback = (payload: PushNotificationPayload) => void

export interface PushProvider {
    /** Provider 名称标识 */
    readonly name: 'fcm' | 'jpush' | 'noop'

    /**
     * 初始化推送服务（请求权限、注册 token 等）。
     * 应在 App 启动时调用一次。
     */
    init(): Promise<void>

    /**
     * 获取当前设备的推送 token。
     * 未注册成功或不支持时返回 null。
     */
    getToken(): Promise<string | null>

    /**
     * 设置用户别名（用于定向推送）。
     * 极光推送的核心绑定方式之一。
     */
    setAlias(alias: string): Promise<void>

    /**
     * 设置用户标签（用于分组推送）。
     * 例如按城市、阵营等分组。
     */
    setTags(tags: string[]): Promise<void>

    /**
     * 注册 token 刷新回调。
     * FCM/JPush 都可能在运行时更新 token。
     */
    onTokenRefresh(callback: TokenRefreshCallback): void

    /**
     * 注册前台通知接收回调。
     * App 在前台时收到推送通知。
     */
    onNotificationReceived(callback: NotificationCallback): void

    /**
     * 注册通知点击/Action 回调。
     * 用户点击推送通知时触发。
     */
    onNotificationClicked(callback: (payload: PushNotificationPayload & { route?: string }) => void): void

    /**
     * 清理所有 listener 和资源。
     * 在组件卸载时调用。
     */
    cleanup(): void
}

// ============================================================
// NoopPushProvider — 默认空实现
// ============================================================

export class NoopPushProvider implements PushProvider {
    readonly name = 'noop' as const

    async init(): Promise<void> {
        console.debug('[PushProvider:Noop] init — no-op (push not configured)')
    }

    async getToken(): Promise<string | null> {
        return null
    }

    async setAlias(_alias: string): Promise<void> {
        console.debug('[PushProvider:Noop] setAlias — no-op')
    }

    async setTags(_tags: string[]): Promise<void> {
        console.debug('[PushProvider:Noop] setTags — no-op')
    }

    onTokenRefresh(_callback: TokenRefreshCallback): void {
        // no-op
    }

    onNotificationReceived(_callback: NotificationCallback): void {
        // no-op
    }

    onNotificationClicked(_callback: (payload: PushNotificationPayload & { route?: string }) => void): void {
        // no-op
    }

    cleanup(): void {
        // no-op
    }
}

// ============================================================
// Provider Registry — Singleton
// ============================================================

let _providerInstance: PushProvider | null = null

/**
 * 获取当前配置的 PushProvider 实例（单例）。
 *
 * 选择逻辑：
 * - NEXT_PUBLIC_PUSH_PROVIDER='fcm'   → FcmPushProvider
 * - NEXT_PUBLIC_PUSH_PROVIDER='jpush' → JpushPushProvider
 * - 其它 / 未设置                      → NoopPushProvider
 */
export async function getPushProvider(): Promise<PushProvider> {
    if (_providerInstance) return _providerInstance

    const providerName = process.env.NEXT_PUBLIC_PUSH_PROVIDER || 'noop'

    switch (providerName) {
        case 'fcm': {
            const { FcmPushProvider } = await import('./fcmProvider')
            _providerInstance = new FcmPushProvider()
            break
        }
        case 'jpush': {
            const { JpushPushProvider } = await import('./jpushProvider')
            _providerInstance = new JpushPushProvider()
            break
        }
        default: {
            _providerInstance = new NoopPushProvider()
            break
        }
    }

    console.debug(`[PushProvider] Using provider: ${_providerInstance!.name}`)
    return _providerInstance!
}

/**
 * 重置 provider 实例（用于测试或切换 provider）。
 */
export function resetPushProvider(): void {
    if (_providerInstance) {
        _providerInstance.cleanup()
        _providerInstance = null
    }
}
