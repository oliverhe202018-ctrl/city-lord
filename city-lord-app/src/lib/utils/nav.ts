/**
 * Universally opens a user's profile page.
 * 
 * @param router - The Next.js router instance (from useNavigate())
 * @param userId - The target user's ID
 * @param returnTo - Optional internal URL to return to (including search params)
 */
export function openUserProfile(navigate: any, userId: string | null | undefined, returnTo?: string) {
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

    if (typeof router === 'function') {
        router(`/profile/user?${params.toString()}`)
    } else if (router && typeof router.push === 'function') {
        router.push(`/profile/user?${params.toString()}`)
    }
}
