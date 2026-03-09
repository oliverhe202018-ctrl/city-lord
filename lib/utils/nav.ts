import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

/**
 * Universally opens a user's profile page.
 * 
 * @param router - The Next.js router instance (from useRouter())
 * @param userId - The target user's ID
 */
export function openUserProfile(router: AppRouterInstance, userId: string | null | undefined) {
    if (!userId) return
    router.push(`/profile/user?userId=${userId}`)
}
