'use client'

import { useState, useEffect } from 'react'
import { Loader2, Users } from 'lucide-react'
import { getActivityRegistrations } from '@/app/actions/club-activity.actions'
import type { ClubActivityRegistration } from '@/lib/types/club-chat.types'

interface ActivityRegistrationProps {
    activityId: string
}

export function ActivityRegistration({ activityId }: ActivityRegistrationProps) {
    const [registrations, setRegistrations] = useState<ClubActivityRegistration[] | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function load() {
            setIsLoading(true)
            const result = await getActivityRegistrations(activityId)
            if (cancelled) return
            setIsLoading(false)

            if (result.success) {
                setRegistrations(result.data)
            } else {
                setRegistrations([])
            }
        }

        load()
        return () => { cancelled = true }
    }, [activityId])

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-white/30 text-xs py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                加载报名列表...
            </div>
        )
    }

    if (!registrations || registrations.length === 0) {
        return (
            <div className="text-xs text-white/25 py-1">
                暂无报名
            </div>
        )
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-xs text-white/40">
                <Users className="h-3 w-3" />
                已报名 ({registrations.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
                {registrations.map((reg) => (
                    <div
                        key={reg.id}
                        className="flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1"
                    >
                        {reg.user.avatarUrl ? (
                            <img
                                src={reg.user.avatarUrl}
                                alt=""
                                className="h-4 w-4 rounded-full object-cover"
                            />
                        ) : (
                            <div className="h-4 w-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white/40">
                                {(reg.user.nickname || '?')[0]}
                            </div>
                        )}
                        <span className="text-[11px] text-white/60 max-w-[80px] truncate">
                            {reg.user.nickname || '未设置昵称'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
