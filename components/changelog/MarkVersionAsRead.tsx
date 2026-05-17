'use client'
import { useEffect } from 'react'
import { markVersionAsRead } from '@/app/actions/changelog/unread-actions'
import { useChangelogNotification } from '@/components/changelog/ChangelogNotificationProvider'

export function MarkVersionAsRead({ versionId }: { versionId: string }) {
    const { refreshUnread } = useChangelogNotification()

    useEffect(() => {
        markVersionAsRead(versionId).then(refreshUnread)
    }, [versionId]) // eslint-disable-line react-hooks/exhaustive-deps

    return null
}
