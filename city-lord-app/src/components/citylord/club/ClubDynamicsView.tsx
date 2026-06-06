'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Trophy, MapPin, Award, Calendar, Loader2, User } from 'lucide-react'
import { getClubDynamics, type DynamicItem } from '@/app/actions/club-dynamics.actions'

const ICON_MAP: Record<DynamicItem['type'], { icon: typeof UserPlus; color: string; bg: string }> = {
    new_member: { icon: UserPlus, color: 'text-blue-400', bg: 'bg-blue-500/15' },
    rank_change: { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
    activity_created: { icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/15' },
    territory_expanded: { icon: MapPin, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    member_milestone: { icon: Award, color: 'text-amber-400', bg: 'bg-amber-500/15' },
}

function formatRelativeTime(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}天前`
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function ClubDynamicsView({ clubId }: { clubId: string }) {
    const [items, setItems] = useState<DynamicItem[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        async function load() {
            setIsLoading(true)
            try {
                const data = await getClubDynamics(clubId)
                if (!cancelled) setItems(data)
            } catch (e) {
                console.error('[ClubDynamicsView] Failed to load:', e)
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [clubId])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 rounded-full bg-muted/50 p-3 border border-border">
                    <Trophy className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">最近7天暂无俱乐部动态</p>
                <p className="text-xs text-muted-foreground/60 mt-1">邀请好友加入，一起跑步开拓领地吧！</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {items.map((item) => {
                const config = ICON_MAP[item.type] || ICON_MAP.new_member
                const Icon = config.icon
                return (
                    <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                    >
                        {/* Icon or Avatar */}
                        <div className="flex-shrink-0 mt-0.5">
                            {item.avatarUrl ? (
                                <div className="h-8 w-8 rounded-full overflow-hidden bg-muted border border-border">
                                    <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" />
                                </div>
                            ) : (
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${config.bg}`}>
                                    <Icon className={`h-4 w-4 ${config.color}`} />
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted border border-border text-muted-foreground">
                                    {item.title}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                    {formatRelativeTime(item.timestamp)}
                                </span>
                            </div>
                            <p className="text-sm text-foreground/80 mt-1 line-clamp-2">{item.description}</p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
