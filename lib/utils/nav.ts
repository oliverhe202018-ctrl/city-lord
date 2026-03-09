import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

/**
 * Universally opens a user's profile page.
 * 
 * @param router - The Next.js router instance (from useRouter())
 * @param userId - The target user's ID
 * @param returnTo - Optional internal URL to return to (including search params)
 */
export function openUserProfile(router: AppRouterInstance, userId: string | null | undefined, returnTo?: string) {
    if (!userId) return

    const params = new URLSearchParams()
    params.set('userId', userId)

    if (returnTo) {
        // Sanitize returnTo: must be an internal relative path starting with '/'
        // preventing external transitions like 'http://...' or '//malicious.com'
        if (returnTo.startsWith('/') && !returnTo.startsWith('//')) {
            params.set('returnTo', returnTo)
        }
    }

    router.push(`/profile/user?${params.toString()}`)
}
