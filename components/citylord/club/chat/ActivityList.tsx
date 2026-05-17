'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
    CalendarDays,
    MapPin,
    Users,
    Plus,
    Loader2,
    ChevronDown,
    Clock,
    CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getClubActivities, registerForActivity, cancelRegistration } from '@/app/actions/club-activity.actions'
import { cn } from '@/lib/utils'
import { PushPrompt } from '@/components/citylord/notifications/PushPrompt'
import type { ClubActivity, MembershipInfo } from '@/lib/types/club-chat.types'
import { CreateActivityDialog } from './CreateActivityDialog'
import { ActivityRegistration } from './ActivityRegistration'
import { ActivityReminder } from './ActivityReminder'

// ─── Status Helper ─────────────────────────────────────────────
function getActivityStatus(startTime: string, endTime: string): {
    label: string
    color: string
    dotColor: string
} {
    const now = Date.now()
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()

    if (now < start) {
        return { label: '即将开始', color: 'text-blue-400', dotColor: 'bg-blue-400' }
    }
    if (now >= start && now <= end) {
        return { label: '进行中', color: 'text-green-400', dotColor: 'bg-green-400' }
    }
    return { label: '已结束', color: 'text-white/30', dotColor: 'bg-white/20' }
}

function formatTime(iso: string): string {
    const d = new Date(iso)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const hours = d.getHours().toString().padStart(2, '0')
    const mins = d.getMinutes().toString().padStart(2, '0')
    return `${month}/${day} ${hours}:${mins}`
}

// ─── Props ─────────────────────────────────────────────────────
interface ActivityListProps {
    clubId: string
    currentUserId: string
    membership: MembershipInfo
}

export function ActivityList({ clubId, currentUserId, membership }: ActivityListProps) {
    const [activities, setActivities] = useState<ClubActivity[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
    const [hasMore, setHasMore] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [registeringId, setRegisteringId] = useState<string | null>(null)

    const canCreate = membership.role === 'owner' || membership.role === 'admin'

    // ── Load activities ────────────────────────────────────────
    const loadActivities = useCallback(async () => {
        setIsLoading(true)
        const result = await getClubActivities({ clubId, limit: 20 })
        setIsLoading(false)

        if (result.success) {
            setActivities(result.data.items)
            setNextCursor(result.data.nextCursor)
            setHasMore(!!result.data.nextCursor)
        } else {
            toast.error(result.message)
        }
    }, [clubId])

    useEffect(() => {
        loadActivities()
    }, [loadActivities])

    // ── Load more ──────────────────────────────────────────────
    const handleLoadMore = useCallback(async () => {
        if (!nextCursor || isLoadingMore) return
        setIsLoadingMore(true)
        const result = await getClubActivities({ clubId, cursor: nextCursor, limit: 20 })
        setIsLoadingMore(false)

        if (result.success) {
            setActivities((prev) => [...prev, ...result.data.items])
            setNextCursor(result.data.nextCursor)
            setHasMore(!!result.data.nextCursor)
        } else {
            toast.error(result.message)
        }
    }, [clubId, nextCursor, isLoadingMore])

    // ── Register / Cancel ──────────────────────────────────────
    const handleRegister = useCallback(async (activityId: string) => {
        setRegisteringId(activityId)
        const result = await registerForActivity(activityId)
        setRegisteringId(null)

        if (result.success) {
            toast.success('报名成功')
            setActivities((prev) =>
                prev.map((a) =>
                    a.id === activityId
                        ? { ...a, myRegistrationStatus: 'registered', registrationCount: a.registrationCount + 1 }
                        : a
                )
            )
        } else {
            toast.error(result.message)
        }
    }, [])

    const handleCancel = useCallback(async (activityId: string) => {
        setRegisteringId(activityId)
        const result = await cancelRegistration(activityId)
        setRegisteringId(null)

        if (result.success) {
            toast.success('已取消报名')
            setActivities((prev) =>
                prev.map((a) =>
                    a.id === activityId
                        ? { ...a, myRegistrationStatus: 'canceled', registrationCount: Math.max(0, a.registrationCount - 1) }
                        : a
                )
            )
        } else {
            toast.error(result.message)
        }
    }, [])

    // ── Activity created callback ──────────────────────────────
    const handleActivityCreated = useCallback((activity: ClubActivity) => {
        setActivities((prev) => {
            // Insert in sorted order by startTime
            const newList = [...prev, activity].sort(
                (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
            )
            return newList
        })
        setShowCreateDialog(false)
    }, [])

    // ── Loading state ──────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                <p className="mt-2 text-sm text-white/40">加载活动中...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Header with create button */}
            <div className="sticky top-0 z-10 flex items-center justify-between bg-zinc-950/95 backdrop-blur px-4 py-3 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white/70">
                    活动列表 <span className="text-white/30">({activities.length})</span>
                </h2>
                {canCreate && (
                    <button
                        onClick={() => setShowCreateDialog(true)}
                        className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        发起活动
                    </button>
                )}
            </div>

            <div className="py-2">
                <PushPrompt />
            </div>

            {/* Activity Reminder for upcoming activities */}
            <ActivityReminder
                activities={activities.filter(
                    (a) => a.myRegistrationStatus === 'registered'
                )}
            />

            {/* Empty state */}
            {activities.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center py-16">
                    <CalendarDays className="h-10 w-10 text-white/15 mb-3" />
                    <p className="text-sm text-white/40">暂无活动</p>
                    {canCreate && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCreateDialog(true)}
                            className="mt-3 border-white/10 text-white/50 text-xs"
                        >
                            创建第一个活动
                        </Button>
                    )}
                </div>
            )}

            {/* Activity cards */}
            <div className="space-y-2 p-3">
                {activities.map((activity) => {
                    const status = getActivityStatus(activity.startTime, activity.endTime)
                    const isExpanded = expandedId === activity.id
                    const isRegistered = activity.myRegistrationStatus === 'registered'
                    const isActionLoading = registeringId === activity.id

                    return (
                        <div
                            key={activity.id}
                            className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden transition-all duration-200"
                        >
                            {/* Card header */}
                            <button
                                onClick={() => setExpandedId(isExpanded ? null : activity.id)}
                                className="w-full text-left px-4 py-3 hover:bg-white/[0.02] transition-colors"
                                id={`activity-${activity.id}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${status.color}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${status.dotColor}`} />
                                                {status.label}
                                            </span>
                                        </div>
                                        <h3 className="text-sm font-semibold text-white truncate">
                                            {activity.title}
                                        </h3>
                                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-white/40">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatTime(activity.startTime)} - {formatTime(activity.endTime)}
                                            </span>
                                            {activity.location && (
                                                <span className="flex items-center gap-1 truncate max-w-[120px]">
                                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                                    {activity.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="flex items-center gap-1 text-[11px] text-white/40">
                                            <Users className="h-3 w-3" />
                                            {activity.registrationCount}
                                            {activity.maxParticipants && `/${activity.maxParticipants}`}
                                        </span>
                                        <ChevronDown
                                            className={`h-4 w-4 text-white/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''
                                                }`}
                                        />
                                    </div>
                                </div>
                            </button>

                            {/* Expanded content */}
                            {isExpanded && (
                                <div className="px-4 pb-3 border-t border-white/5 pt-3 space-y-3">
                                    {/* Description */}
                                    {activity.description && (
                                        <p className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap">
                                            {activity.description}
                                        </p>
                                    )}

                                    {/* Registration action */}
                                    <div className="flex items-center gap-2">
                                        {isRegistered ? (
                                            <>
                                                <span className="flex items-center gap-1 text-xs text-green-400">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    已报名
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={isActionLoading}
                                                    onClick={() => handleCancel(activity.id)}
                                                    className="h-7 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-400/10"
                                                    id={`cancel-reg-${activity.id}`}
                                                >
                                                    {isActionLoading ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        '取消报名'
                                                    )}
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                size="sm"
                                                disabled={isActionLoading}
                                                onClick={() => handleRegister(activity.id)}
                                                className="h-7 text-xs bg-blue-500/80 hover:bg-blue-500 text-white"
                                                id={`register-${activity.id}`}
                                            >
                                                {isActionLoading ? (
                                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                ) : (
                                                    <CalendarDays className="h-3 w-3 mr-1" />
                                                )}
                                                报名参加
                                            </Button>
                                        )}
                                    </div>

                                    {/* Registration list inline */}
                                    <ActivityRegistration activityId={activity.id} />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Load more */}
            {hasMore && (
                <div className="flex justify-center py-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={isLoadingMore}
                        onClick={handleLoadMore}
                        className="text-xs text-white/40 hover:text-white/60"
                        id="load-more-activities"
                    >
                        {isLoadingMore ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                            <ChevronDown className="h-3.5 w-3.5 mr-1" />
                        )}
                        加载更多
                    </Button>
                </div>
            )}

            {/* Create dialog */}
            {showCreateDialog && (
                <CreateActivityDialog
                    clubId={clubId}
                    onClose={() => setShowCreateDialog(false)}
                    onCreated={handleActivityCreated}
                />
            )}
        </div>
    )
}
