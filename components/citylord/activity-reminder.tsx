"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

interface ActivityReminderProps {
    activityId: string
    activityTitle: string
    startTime: string // ISO date string
}

/**
 * Client-side activity reminder component.
 * Shows a toast notification 1 hour before the activity starts.
 * Rendered alongside activity detail pages for registered users.
 */
export function ActivityReminder({
    activityId,
    activityTitle,
    startTime,
}: ActivityReminderProps) {
    const hasNotified = useRef(false)

    useEffect(() => {
        const startMs = new Date(startTime).getTime()
        const reminderMs = startMs - 60 * 60 * 1000 // 1 hour before
        const now = Date.now()

        // Already past start time or already notified
        if (now >= startMs || hasNotified.current) return

        // If within the reminder window, show immediately
        if (now >= reminderMs) {
            showReminder()
            return
        }

        // Schedule reminder
        const delay = reminderMs - now
        // Don't schedule if too far in the future (> 24 hours)
        if (delay > 24 * 60 * 60 * 1000) return

        const timeout = setTimeout(showReminder, delay)
        return () => clearTimeout(timeout)

        function showReminder() {
            if (hasNotified.current) return
            hasNotified.current = true
            toast.info(`🏃 活动「${activityTitle}」即将在1小时后开始！`, {
                duration: 10000,
                id: `activity-reminder-${activityId}`,
                action: {
                    label: "查看",
                    onClick: () => {
                        // Could navigate to activity detail
                    },
                },
            })
        }
    }, [activityId, activityTitle, startTime])

    return null
}
