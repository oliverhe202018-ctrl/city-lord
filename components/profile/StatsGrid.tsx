'use client'

import React from 'react'
import { Footprints, TrendingUp, Timer, Trophy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { ProfileStats, PersonalBest, WeeklyDistance } from '@/app/actions/profile'

import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface StatsGridProps {
    stats: ProfileStats | null
    isLoading?: boolean
}

export function StatsGrid({ stats, isLoading = false }: StatsGridProps) {
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
                    icon={<Timer className="h-4 w-4" />}
                    label="关注"
                    value={stats.following.toString()}
                    unit="人"
                    color="text-purple-400"
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

            {/* Weekly Chart */}
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-6">
                本周跑量
            </h2>
            <div className="rounded-2xl border border-border bg-card/50 p-3">
                <WeeklyChart data={stats.weeklyDistances} />
            </div>
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

function WeeklyChart({ data }: { data: WeeklyDistance[] }) {
    if (!data || data.length === 0) {
        return (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                暂无数据
            </div>
        )
    }

    return (
        <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        unit="km"
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                        contentStyle={{
                            backgroundColor: '#1f2937', // gray-800
                            borderColor: '#374151',     // gray-700
                            color: '#f3f4f6',           // gray-100
                            borderRadius: '8px',
                            fontSize: '12px',
                        }}
                        itemStyle={{ color: '#f3f4f6' }}
                        labelStyle={{ color: '#f3f4f6' }}
                        formatter={(value: number) => [`${value} km`, '距离']}
                    />
                    <Bar
                        dataKey="distance"
                        fill="url(#barGradient)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                    />
                    <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6} />
                        </linearGradient>
                    </defs>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
