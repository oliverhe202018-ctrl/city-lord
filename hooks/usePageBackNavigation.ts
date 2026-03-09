import { useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/**
 * Hook to provide unified back navigation logic, especially for pages like profile
 * that can be entered from anywhere. It handles `returnTo` query parameter,
 * safe history fallback, and Capacitor Android physical back button.
 *
 * @param fallbackUrl The ultimate URL to go back to if no history or returnTo exists.
 * @returns { goBack: () => void }
 */
export function usePageBackNavigation(fallbackUrl: string = '/social') {
    const router = useRouter()
    const searchParams = useSearchParams()

    const goBack = useCallback(() => {
        // 1. Explicit returnTo if present and safe
        const returnToParam = searchParams.get('returnTo')
        if (returnToParam && returnToParam.startsWith('/') && !returnToParam.startsWith('//')) {
            router.replace(returnToParam)
            return
        }

        // 2. Safe in-app back check
        if (typeof window !== 'undefined' && window.history.state?.idx > 0) {
            router.back()
            return
        }

        // 3. Ultimate Fallback
        router.replace(fallbackUrl)
    }, [router, searchParams, fallbackUrl])

    // Bind Capacitor Android Hardware Back Button
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return

        // Adds listener for hardware back button on Android
        const backListener = App.addListener('backButton', () => {
            goBack()
        })

        return () => {
            backListener.then(listener => listener.remove())
        }
    }, [goBack])

    return { goBack }
}
