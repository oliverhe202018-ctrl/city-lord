'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { ClubActivity } from '@/lib/types/club-chat.types'

interface ActivityReminderProps {
    activities: ClubActivity[]
}

const ONE_HOUR_MS = 60 * 60 * 1000
const CHECK_INTERVAL_MS = 60 * 1000 // Check every minute

/**
 * Client-side reminder for upcoming activities.
 * Shows a toast notification when any registered activity starts within 1 hour.
 * Tracks which activities have already triggered reminders to avoid duplicates.
 */
export function ActivityReminder({ activities }: ActivityReminderProps) {
    const remindedRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        if (activities.length === 0) return

        function checkReminders() {
            const now = Date.now()

            activities.forEach((activity) => {
                if (remindedRef.current.has(activity.id)) return

                const startMs = new Date(activity.startTime).getTime()
                const timeDiff = startMs - now

                // Remind if activity starts within 1 hour and hasn't started yet
                if (timeDiff > 0 && timeDiff <= ONE_HOUR_MS) {
                    remindedRef.current.add(activity.id)

                    const minutes = Math.round(timeDiff / 60_000)
                    toast.info(
                        `🎯 活动提醒：「${activity.title}」将在 ${minutes} 分钟后开始`,
                        {
                            duration: 8000,
                            id: `activity-reminder-${activity.id}`,
                        }
                    )
                }
            })
        }

        // Run immediately
        checkReminders()

        // Then check periodically
        const interval = setInterval(checkReminders, CHECK_INTERVAL_MS)

        return () => clearInterval(interval)
    }, [activities])

    // This is a headless component — no visible UI
    return null
}
