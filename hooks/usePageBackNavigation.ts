import { useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBackNavigationContext } from '@/contexts/BackNavigationContext'

/**
 * Hook to provide unified back navigation logic for pages that need custom back behavior.
 *
 * 变更说明（Batch Android-Back）：
 * 不再直接调用 App.addListener。改为向 BackNavigationContext 注册 handler，
 * 实际的 backButton 监听已集中至 layout.tsx 的 GlobalBackButtonHandler。
 *
 * @param fallbackUrl The URL to navigate to when no history exists and no returnTo param.
 * @returns { goBack: () => void }
 */
export function usePageBackNavigation(fallbackUrl: string = '/social') {
    const router      = useRouter()
    const searchParams = useSearchParams()
    const { registerHandler, unregisterHandler } = useBackNavigationContext()

    // 每个 hook 实例的稳定 ID，不随 render 变化
    const idRef = useRef(`back-nav-${Math.random().toString(36).slice(2)}`)

    const goBack = useCallback(() => {
        // 1. Explicit returnTo if present and safe
        const returnToParam = searchParams.get('returnTo')
        if (
            returnToParam &&
            returnToParam.startsWith('/') &&
            !returnToParam.startsWith('//')
        ) {
            router.replace(returnToParam)
            return
        }
        // 2. Safe in-app back check
        if (typeof window !== 'undefined' && window.history.length > 2) {
            router.back()
            return
        }
        // 3. Ultimate Fallback
        router.push(fallbackUrl)
    }, [router, searchParams, fallbackUrl])

    // 向 Context 注册，组件卸载时自动注销
    useEffect(() => {
        const id = idRef.current
        registerHandler(id, goBack)
        return () => unregisterHandler(id)
    }, [goBack, registerHandler, unregisterHandler])

    return { goBack }
}
