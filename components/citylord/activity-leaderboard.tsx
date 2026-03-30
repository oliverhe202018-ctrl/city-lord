"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Image from "next/image"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Trophy, Medal, Crown, User, ChevronDown, Loader2 } from "lucide-react"
import { getActivityLeaderboard, type LeaderboardEntry } from "@/app/actions/leaderboard"

interface ActivityLeaderboardProps {
    activityId: string
    activityTitle?: string
}

const ITEM_HEIGHT = 72
const PAGE_SIZE = 50

/** Default fallback for broken avatar images */
const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none'
    const parent = e.currentTarget.parentElement
    if (parent) {
        const fallback = parent.querySelector('[data-fallback]') as HTMLElement
        if (fallback) fallback.style.display = 'flex'
    }
}

/**
 * Activity Leaderboard with virtual scrolling
 * Shows participant rankings for a specific club activity.
 */
export function ActivityLeaderboard({ activityId, activityTitle }: ActivityLeaderboardProps) {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const parentRef = useRef<HTMLDivElement>(null)

    // Memoize entries to avoid unnecessary re-renders during virtual scroll
    const items = useMemo(() => entries, [entries])

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ITEM_HEIGHT,
        overscan: 5,
    })

    const loadData = useCallback(async (pageNum: number) => {
        setIsLoading(true)
        try {
            const data = await getActivityLeaderboard(activityId, pageNum, PAGE_SIZE)
            if (pageNum === 1) {
                setEntries(data)
            } else {
                setEntries((prev) => [...prev, ...data])
            }
            setHasMore(data.length === PAGE_SIZE)
        } catch (error) {
            console.error("Failed to load activity leaderboard:", error)
        } finally {
            setIsLoading(false)
        }
    }, [activityId])

    useEffect(() => {
        setPage(1)
        setEntries([])
        loadData(1)
    }, [activityId, loadData])

    const handleLoadMore = useCallback(() => {
        if (!isLoading && hasMore) {
            const nextPage = page + 1
            setPage(nextPage)
            loadData(nextPage)
        }
    }, [isLoading, hasMore, page, loadData])

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Crown className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
            case 2:
                return <Medal className="w-5 h-5 text-gray-300 drop-shadow-sm" />
            case 3:
                return <Medal className="w-5 h-5 text-amber-600 drop-shadow-sm" />
            default:
                return <span className="text-sm font-bold text-muted-foreground">{rank}</span>
        }
    }

    if (isLoading && items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="mt-4 text-sm text-muted-foreground animate-pulse">加载排行榜中...</p>
            </div>
        )
    }

    if (!isLoading && items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 rounded-full bg-muted/50 p-4 border border-border">
                    <Trophy className="h-10 w-10 text-muted-foreground/60" />
                </div>
                <p className="font-semibold text-foreground/80">暂无排行数据</p>
                <p className="text-sm text-muted-foreground mt-1">等待参与者完成活动后显示排名</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 px-1">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h3 className="font-bold text-lg">
                    {activityTitle ? `${activityTitle} 排行榜` : "活动排行榜"}
                </h3>
                <span className="text-xs text-muted-foreground ml-auto">
                    共 {items.length} 人
                </span>
            </div>

            {/* Podium — Top 3 */}
            {items.length >= 3 && (
                <div className="flex items-end justify-center gap-3 py-4 px-2">
                    {/* 2nd place */}
                    <div className="flex flex-col items-center w-24">
                        <div className="relative">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-300/30 to-gray-400/30 border-2 border-gray-300/50 flex items-center justify-center text-2xl shadow-lg overflow-hidden">
                                {items[1]?.avatar_url ? (
                                    <>
                                        <Image src={items[1].avatar_url} alt="" width={56} height={56} className="w-full h-full object-cover" onError={handleImgError} />
                                        <div data-fallback className="absolute inset-0 items-center justify-center hidden"><User className="w-6 h-6 text-gray-400" /></div>
                                    </>
                                ) : (
                                    <User className="w-6 h-6 text-gray-400" />
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-300 text-white text-xs font-black flex items-center justify-center shadow">2</div>
                        </div>
                        <p className="text-xs font-semibold mt-2 truncate max-w-full">{items[1]?.name}</p>
                        <p className="text-[10px] text-muted-foreground">{items[1]?.score} 分</p>
                    </div>

                    {/* 1st place */}
                    <div className="flex flex-col items-center w-28 -mt-4">
                        <Crown className="w-6 h-6 text-yellow-400 mb-1 animate-pulse" />
                        <div className="relative">
                            <div className="rounded-full bg-gradient-to-br from-yellow-400/30 to-amber-500/30 border-2 border-yellow-400/60 flex items-center justify-center text-3xl shadow-xl ring-2 ring-yellow-400/20 ring-offset-2 ring-offset-background overflow-hidden" style={{ width: '4.5rem', height: '4.5rem' }}>
                                {items[0]?.avatar_url ? (
                                    <>
                                        <Image src={items[0].avatar_url} alt="" width={72} height={72} className="w-full h-full object-cover" onError={handleImgError} />
                                        <div data-fallback className="absolute inset-0 items-center justify-center hidden"><User className="w-7 h-7 text-yellow-400" /></div>
                                    </>
                                ) : (
                                    <User className="w-7 h-7 text-yellow-400" />
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-yellow-400 text-white text-xs font-black flex items-center justify-center shadow">1</div>
                        </div>
                        <p className="text-sm font-bold mt-2 truncate max-w-full">{items[0]?.name}</p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400/80 font-semibold">{items[0]?.score} 分</p>
                    </div>

                    {/* 3rd place */}
                    <div className="flex flex-col items-center w-24">
                        <div className="relative">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600/30 to-amber-700/30 border-2 border-amber-600/50 flex items-center justify-center text-2xl shadow-lg overflow-hidden">
                                {items[2]?.avatar_url ? (
                                    <>
                                        <Image src={items[2].avatar_url} alt="" width={56} height={56} className="w-full h-full object-cover" onError={handleImgError} />
                                        <div data-fallback className="absolute inset-0 items-center justify-center hidden"><User className="w-6 h-6 text-amber-600" /></div>
                                    </>
                                ) : (
                                    <User className="w-6 h-6 text-amber-600" />
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-black flex items-center justify-center shadow">3</div>
                        </div>
                        <p className="text-xs font-semibold mt-2 truncate max-w-full">{items[2]?.name}</p>
                        <p className="text-[10px] text-muted-foreground">{items[2]?.score} 分</p>
                    </div>
                </div>
            )}

            {/* Virtual Scroll List — GPU-accelerated */}
            <div
                ref={parentRef}
                className="max-h-[400px] overflow-y-auto overscroll-contain transform-gpu rounded-xl border border-border/50 bg-card/50 scrollbar-hide"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                    }}
                >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const entry = items[virtualRow.index]
                        if (!entry) return null
                        return (
                            <div
                                key={entry.id || `activity-${entry.rank}-${virtualRow.key}`}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                <div
                                    className={`flex items-center gap-3 px-4 h-full border-b border-border/30 transition-colors hover:bg-muted/30 ${entry.is_me ? "bg-primary/5 border-l-2 border-l-primary" : ""
                                        }`}
                                >
                                    <div className="w-8 flex items-center justify-center shrink-0">
                                        {getRankIcon(entry.rank)}
                                    </div>

                                    <div className="w-10 h-10 rounded-full bg-muted border border-border/50 flex items-center justify-center shrink-0 overflow-hidden relative">
                                        {entry.avatar_url ? (
                                            <>
                                                <Image src={entry.avatar_url} alt="" width={40} height={40} className="w-full h-full object-cover" onError={handleImgError} />
                                                <div data-fallback className="absolute inset-0 bg-muted items-center justify-center hidden">
                                                    <User className="w-5 h-5 text-muted-foreground" />
                                                </div>
                                            </>
                                        ) : (
                                            <User className="w-5 h-5 text-muted-foreground" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-semibold truncate ${entry.is_me ? "text-primary" : ""}`}>
                                            {entry.name}
                                            {entry.is_me && <span className="text-xs ml-1 text-primary">(我)</span>}
                                        </p>
                                        {entry.secondary_info && (
                                            <p className="text-[11px] text-muted-foreground">{entry.secondary_info}</p>
                                        )}
                                    </div>

                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold">{entry.score}</p>
                                        <p className="text-[10px] text-muted-foreground">分</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Load More */}
            {hasMore && (
                <button
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <ChevronDown className="w-4 h-4" />
                    )}
                    {isLoading ? "加载中..." : "加载更多"}
                </button>
            )}
        </div>
    )
}
