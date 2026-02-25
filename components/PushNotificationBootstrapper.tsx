"use client"

/**
 * PushNotificationBootstrapper
 *
 * 在 App 启动时初始化 FCM 推送注册。
 * 同时监听 push-navigate 自定义事件，执行深度链接导航。
 * 挂载在 layout.tsx 中，与 EarlyGeolocationPreloader 平级。
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { initPushNotifications } from '@/lib/services/pushNotificationService'

export function PushNotificationBootstrapper() {
    const router = useRouter()

    useEffect(() => {
        // 初始化推送通知
        initPushNotifications()

        // 监听来自 pushNotificationService 的深度链接事件
        const handlePushNavigate = (event: Event) => {
            const customEvent = event as CustomEvent<{ route: string }>
            const route = customEvent.detail?.route
            if (route) {
                console.debug('[PushNotificationBootstrapper] Navigating to:', route)
                router.push(route)
            }
        }

        window.addEventListener('push-navigate', handlePushNavigate)

        return () => {
            window.removeEventListener('push-navigate', handlePushNavigate)
        }
    }, [router])

    // 纯逻辑组件，不渲染任何 UI
    return null
}
