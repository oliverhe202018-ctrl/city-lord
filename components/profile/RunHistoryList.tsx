'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Footprints, TrendingUp, Loader2, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { getRuns, type RunRecord } from '@/app/actions/profile'

interface RunHistoryListProps {
    userId: string
    initialRuns?: RunRecord[]
    initialCursor?: string | null
}

export function RunHistoryList({ userId, initialRuns, initialCursor }: RunHistoryListProps) {
    const [runs, setRuns] = useState<RunRecord[]>(initialRuns ?? [])
    const [cursor, setCursor] = useState<string | null>(initialCursor ?? null)
    const [loading, setLoading] = useState(!initialRuns)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const observerRef = useRef<IntersectionObserver | null>(null)
    const sentinelRef = useRef<HTMLDivElement | null>(null)

    // Initial load
    useEffect(() => {
        if (initialRuns) return
        loadRuns()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])

    const loadRuns = useCallback(async (existingCursor?: string) => {
        try {
            if (existingCursor) {
                setLoadingMore(true)
            } else {
                setLoading(true)
            }
            setError(null)

            const result = await getRuns(userId, existingCursor)

            if (existingCursor) {
                setRuns(prev => [...prev, ...result.runs])
            } else {
                setRuns(result.runs)
            }
            setCursor(result.nextCursor)
        } catch (e) {
            console.error('Failed to load runs:', e)
            setError('加载失败')
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }, [userId])

    // Infinite scroll observer
    useEffect(() => {
        if (!cursor) return

        observerRef.current = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && cursor && !loadingMore) {
                    loadRuns(cursor)
                }
            },
            { threshold: 0.1 }
        )

        if (sentinelRef.current) {
            observerRef.current.observe(sentinelRef.current)
        }

        return () => observerRef.current?.disconnect()
    }, [cursor, loadingMore, loadRuns])

    if (loading) {
        return (
            <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
            </div>
        )
    }

    return (
        <div className="p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                跑步记录
            </h2>

            {runs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm bg-card/30 rounded-2xl border border-border/50 border-dashed">
                    <Footprints className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p>暂无跑步记录</p>
                    <p className="text-xs mt-1 text-muted-foreground/50">快去跑一场吧！</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {runs.map(run => (
                        <RunCard key={run.id} run={run} />
                    ))}

                    {/* Infinite scroll sentinel */}
                    {cursor && (
                        <div ref={sentinelRef} className="py-4 flex justify-center">
                            {loadingMore ? (
                                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                            ) : (
                                <span className="text-xs text-muted-foreground">继续滚动加载更多</span>
                            )}
                        </div>
                    )}

                    {!cursor && runs.length > 0 && (
                        <div className="py-4 text-center text-xs text-muted-foreground/50">
                            — 已加载全部记录 —
                        </div>
                    )}

                    {/* Error retry */}
                    {error && (
                        <button
                            onClick={() => loadRuns(cursor ?? undefined)}
                            className="w-full py-3 flex items-center justify-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            点击重试
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

function RunCard({ run }: { run: RunRecord }) {
    return (
        <div className="rounded-2xl border border-border bg-card/50 p-3 transition-all hover:bg-card/80">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex items-center justify-center border border-white/5">
                        <Footprints className="w-6 h-6 text-cyan-400/60" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-foreground">
                                {run.distanceKm.toFixed(2)} km
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                {run.paceMinPerKm}/km
                            </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {new Date(run.createdAt).toLocaleDateString('zh-CN')} ·{' '}
                            {new Date(run.createdAt).toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-sm font-mono font-medium text-foreground">
                        {run.durationStr}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1 mt-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>{run.calories} kcal</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
