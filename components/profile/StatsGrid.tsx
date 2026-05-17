'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { Footprints, TrendingUp, Timer, Trophy, Hexagon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { ProfileStats, PersonalBest, WeeklyDistance } from '@/app/actions/profile'
// import { RecentPostsFeed } from '@/components/profile/RecentPostsFeed'

// Recharts 依赖 window/DOM CSS 变量 (cssCalc)，必须禁用 SSR，否则 Vercel 预渲染崩溃
const WeeklyChartDynamic = dynamic(
    () => import('@/components/profile/WeeklyChartClient').then((m) => m.WeeklyChart),
    {
        ssr: false,
        loading: () => <div className="h-40 flex items-center justify-center"><Skeleton className="h-32 w-full rounded-xl" /></div>,
    }
)

const RecentPostsFeedDynamic = dynamic(
    () => import('@/components/profile/RecentPostsFeed').then((m) => m.RecentPostsFeed),
    {
        ssr: false,
        loading: () => <div className="mt-6 space-y-3"><Skeleton className="h-24 w-full rounded-2xl" /></div>,
    }
)

interface StatsGridProps {
    stats: ProfileStats | null
    isLoading?: boolean
    userId?: string
}

export function StatsGrid({ stats, isLoading = false, userId }: StatsGridProps) {
    if (isLoading || !stats) {
        return (
            <div className="p-4 space-y-4">
                <Skeleton className="h-5 w-24" />
                <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-2xl" />
                    ))}
                </div>
                <Skeleton className="h-40 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4">
            {/* Main stats grid */}
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                数据统计
            </h2>
            <div className="grid grid-cols-2 gap-3">
                <StatBox
                    icon={<Footprints className="h-4 w-4" />}
                    label="总跑步次数"
                    value={stats.totalRuns.toString()}
                    unit="次"
                    color="text-cyan-400"
                />
                <StatBox
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="总距离"
                    value={stats.totalDistanceKm.toFixed(1)}
                    unit="km"
                    color="text-emerald-400"
                />
                <StatBox
                    icon={<Hexagon className="h-4 w-4" />}
                    label="占领面积"
                    value={stats.areaControlledKm2.toFixed(4)}
                    unit="km²"
                    color="text-cyan-400"
                />
                <StatBox
                    icon={<Trophy className="h-4 w-4" />}
                    label="粉丝"
                    value={stats.followers.toString()}
                    unit="人"
                    color="text-amber-400"
                />
            </div>

            {/* Personal Bests */}
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-6">
                个人最佳 (PB)
            </h2>
            <div className="grid grid-cols-3 gap-2">
                {stats.personalBests.map((pb) => (
                    <PBCard key={pb.distance} pb={pb} />
                ))}
            </div>

            {/* Weekly Chart — dynamically loaded (ssr:false) to avoid Recharts cssCalc SSR crash */}
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-6">
                本周跑量
            </h2>
            <div className="rounded-2xl border border-border bg-card/50 p-3">
                <WeeklyChartDynamic data={stats.weeklyDistances} />
            </div>

            {/* 最新动态区块 */}
            <RecentPostsFeedDynamic userId={userId} />
        </div>
    )
}

// ── Sub-components ──

function StatBox({
    icon,
    label,
    value,
    unit,
    color,
}: {
    icon: React.ReactNode
    label: string
    value: string
    unit: string
    color: string
}) {
    return (
        <div className="rounded-2xl border border-border bg-card/50 p-3">
            <div className={`mb-1 ${color}`}>{icon}</div>
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground leading-tight">
                {value}
                <span className="ml-1 text-xs font-normal text-muted-foreground/60">
                    {unit}
                </span>
            </p>
        </div>
    )
}

function PBCard({ pb }: { pb: PersonalBest }) {
    return (
        <div className="rounded-xl border border-border bg-card/50 p-2.5 text-center">
            <p className="text-xs font-bold text-foreground mb-0.5">{pb.distance}</p>
            <p className="text-sm font-mono text-cyan-400">
                {pb.time ?? '--:--'}
            </p>
        </div>
    )
}

// WeeklyChart has been extracted to '@/components/profile/WeeklyChartClient'
// and is loaded dynamically (ssr: false) above to prevent Recharts cssCalc SSR crash.
