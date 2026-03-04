'use client'

import React, { useState, useEffect } from 'react'
import { Map, Shield, Swords, Trophy, Loader2, Users, Target, TrendingUp, Crown, Zap } from 'lucide-react'
import { useGameStore } from '@/store/useGameStore'

interface TerritoryStats {
    totalArea: number
    territoryCount: number
    memberCount: number
    weeklyGrowth: number
}

interface TerritoryEvent {
    id: string
    type: 'capture' | 'defend' | 'lost'
    description: string
    time: string
    area: number
}

export function TerritoryBattlePage({ clubId }: { clubId: string }) {
    const [isLoading, setIsLoading] = useState(true)
    const [stats, setStats] = useState<TerritoryStats>({
        totalArea: 0,
        territoryCount: 0,
        memberCount: 0,
        weeklyGrowth: 0,
    })
    const [recentEvents, setRecentEvents] = useState<TerritoryEvent[]>([])

    useEffect(() => {
        // Load territory data — uses a timeout to simulate data loading
        // In the future, connect to real server action
        const timer = setTimeout(() => {
            setStats({
                totalArea: 125600,
                territoryCount: 42,
                memberCount: 3,
                weeklyGrowth: 12.5,
            })
            setRecentEvents([
                { id: '1', type: 'capture', description: '成员占领了新领地', time: '2小时前', area: 2400 },
                { id: '2', type: 'defend', description: '成功防守领地攻击', time: '5小时前', area: 0 },
                { id: '3', type: 'capture', description: '团队协作占领大片区域', time: '1天前', area: 8500 },
                { id: '4', type: 'lost', description: '被对手夺取边缘领地', time: '2天前', area: 1200 },
            ])
            setIsLoading(false)
        }, 800)
        return () => clearTimeout(timer)
    }, [clubId])

    const formatArea = (area: number) => {
        if (area < 10000) return `${Math.round(area)} ㎡`
        return `${(area / 1000000).toFixed(2)} k㎡`
    }

    const eventConfig = {
        capture: { icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: '占领' },
        defend: { icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10', label: '防守' },
        lost: { icon: Swords, color: 'text-red-400', bg: 'bg-red-500/10', label: '失守' },
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                <p className="mt-4 text-sm text-muted-foreground">加载领地数据...</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-background p-5">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.15),transparent_70%)]" />
                <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20 border border-purple-500/30">
                            <Map className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">领地争夺</h3>
                            <p className="text-xs text-muted-foreground">俱乐部领地概览</p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="rounded-xl bg-background/50 border border-border p-3">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <Map className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-medium">总面积</span>
                            </div>
                            <div className="text-lg font-black text-foreground">{formatArea(stats.totalArea)}</div>
                        </div>
                        <div className="rounded-xl bg-background/50 border border-border p-3">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <Target className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-medium">领地数</span>
                            </div>
                            <div className="text-lg font-black text-foreground">{stats.territoryCount}</div>
                        </div>
                        <div className="rounded-xl bg-background/50 border border-border p-3">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <Users className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-medium">参战成员</span>
                            </div>
                            <div className="text-lg font-black text-foreground">{stats.memberCount}</div>
                        </div>
                        <div className="rounded-xl bg-background/50 border border-border p-3">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <TrendingUp className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-medium">本周增长</span>
                            </div>
                            <div className="text-lg font-black text-emerald-400">+{stats.weeklyGrowth}%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tips */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-bold text-foreground">攻略提示</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-1.5">
                        <span className="text-purple-400 mt-0.5">•</span>
                        <span>俱乐部成员跑步占领的领地会自动归入俱乐部总面积</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                        <span className="text-purple-400 mt-0.5">•</span>
                        <span>多名成员在同一区域跑步可以增强领地防御力</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                        <span className="text-purple-400 mt-0.5">•</span>
                        <span>领地连续7天未巡逻将被标记为可攻击状态</span>
                    </li>
                </ul>
            </div>

            {/* Recent Events */}
            <div>
                <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Swords className="h-4 w-4 text-muted-foreground" />
                    近期战报
                </h4>
                <div className="space-y-2">
                    {recentEvents.map((event) => {
                        const config = eventConfig[event.type]
                        const Icon = config.icon
                        return (
                            <div
                                key={event.id}
                                className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
                            >
                                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${config.bg} flex-shrink-0`}>
                                    <Icon className={`h-4 w-4 ${config.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-foreground">{event.description}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-muted-foreground">{event.time}</span>
                                        {event.area > 0 && (
                                            <span className={`text-[10px] font-medium ${event.type === 'lost' ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {event.type === 'lost' ? '-' : '+'}{formatArea(event.area)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${config.bg} ${config.color} font-medium`}>
                                    {config.label}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Leaderboard Teaser */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Crown className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-bold text-foreground">俱乐部领地 MVP</span>
                </div>
                <div className="flex items-center justify-center py-6">
                    <div className="text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 mx-auto mb-2">
                            <Trophy className="h-8 w-8 text-yellow-400" />
                        </div>
                        <p className="text-xs text-muted-foreground">参与跑步占领领地，争夺 MVP 称号！</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
