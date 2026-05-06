'use client'

/**
 * WeeklyChartClient — Recharts bar chart for weekly running distances.
 *
 * ⚠️  MUST be imported ONLY via Next.js dynamic() with { ssr: false }.
 *     Recharts accesses CSS variables (cssCalc) during module init,
 *     which crashes Next.js SSR / Vercel pre-render if imported directly.
 *
 *     Correct usage (in StatsGrid.tsx):
 *       const WeeklyChartDynamic = dynamic(
 *         () => import('@/components/profile/WeeklyChartClient').then(m => m.WeeklyChart),
 *         { ssr: false }
 *       )
 */

import React from 'react'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { WeeklyDistance } from '@/app/actions/profile'

interface WeeklyChartProps {
    data: WeeklyDistance[]
}

export function WeeklyChart({ data }: WeeklyChartProps) {
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
                            backgroundColor: '#1f2937',
                            borderColor: '#374151',
                            color: '#f3f4f6',
                            borderRadius: '8px',
                            fontSize: '12px',
                        }}
                        itemStyle={{ color: '#f3f4f6' }}
                        labelStyle={{ color: '#f3f4f6' }}
                        formatter={(value: number) => [`${value} km`, '距离']}
                    />
                    <Bar
                        dataKey="distance"
                        fill="url(#weeklyBarGradient)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                    />
                    <defs>
                        <linearGradient id="weeklyBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6} />
                        </linearGradient>
                    </defs>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
