'use client'
import { useChangelogNotification } from './ChangelogNotificationProvider'

export function ChangelogUnreadBadge() {
    const { unreadCount } = useChangelogNotification()
    if (unreadCount === 0) return null

    return (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
        </span>
    )
}
