"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Trophy, Medal, Star, Shield, ArrowUp, ArrowDown, MapPin, Zap, Loader2, ChevronDown, User } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { getSocialLeaderboard, type LeaderboardEntry } from "@/app/actions/leaderboard"
import { useAuth } from "@/hooks/useAuth"

const ITEM_HEIGHT = 76
const PAGE_SIZE = 50

type TabKey = "distance" | "territory" | "social"

const TAB_CONFIG: { key: TabKey; label: string; activeClass: string; icon: typeof Zap; scoreLabel: string }[] = [
    { key: "distance", label: "里程榜", activeClass: "bg-primary text-primary-foreground", icon: Zap, scoreLabel: "分" },
    { key: "territory", label: "领地榜", activeClass: "bg-emerald-500 text-white", icon: MapPin, scoreLabel: "㎡" },
    { key: "social", label: "社交榜", activeClass: "bg-cyan-500 text-white", icon: Star, scoreLabel: "分" },
]

export function Leaderboard() {
    const [activeTab, setActiveTab] = useState<TabKey>("distance")
    const [isLoading, setIsLoading] = useState(true)
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const parentRef = useRef<HTMLDivElement>(null)
    const { user } = useAuth()

    // Filter out zero-score entries
    const items = useMemo(() => entries.filter(e => e.score > 0), [entries])

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ITEM_HEIGHT,
        overscan: 5,
    })

    const loadData = useCallback(async (pageNum: number) => {
        setIsLoading(true)
        try {
            const data = await getSocialLeaderboard(user?.id, pageNum, PAGE_SIZE, activeTab)
            if (pageNum === 1) {
                setEntries(data)
            } else {
                setEntries(prev => [...prev, ...data])
            }
            setHasMore(data.length === PAGE_SIZE)
        } catch (error) {
            console.error("Failed to load leaderboard:", error)
        } finally {
            setIsLoading(false)
        }
    }, [user?.id, activeTab])

    useEffect(() => {
        setPage(1)
        setEntries([])
        loadData(1)
    }, [activeTab, loadData])

    const handleLoadMore = useCallback(() => {
        if (!isLoading && hasMore) {
            const nextPage = page + 1
            setPage(nextPage)
            loadData(nextPage)
        }
    }, [isLoading, hasMore, page, loadData])

    const myRank = useMemo(() => items.find(e => e.is_me), [items])
    const activeConfig = TAB_CONFIG.find(t => t.key === activeTab)!

    return (
        <div className="flex flex-col space-y-4">
            {/* 3-tab selector */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-muted/20 border border-border/50">
                {TAB_CONFIG.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.key ? `${tab.activeClass} shadow-sm` : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="space-y-3 min-h-[300px]">
                {isLoading && items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="mt-4 text-sm text-muted-foreground animate-pulse">加载榜单中...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-4 rounded-full bg-muted/50 p-4 border border-border">
                            <Trophy className="h-10 w-10 text-muted-foreground/60" />
                        </div>
                        <p className="font-semibold text-foreground/80">虚位以待</p>
                        <p className="text-sm text-muted-foreground mt-1 mb-5">快去完成挑战，成为榜单第一人！</p>
                        <button className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold active:scale-95 transition-transform" onClick={() => window.location.href = '/'}>
                            即刻出发
                        </button>
                    </div>
                ) : (
                    <div
                        ref={parentRef}
                        className="max-h-[400px] overflow-y-auto rounded-xl"
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
                                const idx = virtualRow.index
                                const Icon = activeConfig.icon
                                return (
                                    <div
                                        key={virtualRow.key}
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: "100%",
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                    >
                                        <div className={`flex items-center gap-3 p-3 rounded-2xl border shadow-sm transition-all hover:shadow-md mb-2 ${entry.is_me ? 'bg-primary/5 border-primary/50' : 'bg-card border-border hover:border-primary/30'}`}>
                                            <div className="w-8 text-center font-black italic text-lg opacity-80">
                                                {idx === 0 ? <Medal className="w-6 h-6 text-yellow-500 mx-auto drop-shadow-sm" /> :
                                                    idx === 1 ? <Medal className="w-6 h-6 text-gray-400 mx-auto drop-shadow-sm" /> :
                                                        idx === 2 ? <Medal className="w-6 h-6 text-amber-600 mx-auto drop-shadow-sm" /> :
                                                            <span className="text-muted-foreground">{idx + 1}</span>}
                                            </div>

                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted border-2 border-background shadow-inner overflow-hidden">
                                                {entry.avatar_url ? (
                                                    <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User className="w-6 h-6 text-muted-foreground" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold truncate max-w-[150px] sm:max-w-[200px] ${entry.is_me ? 'text-primary' : ''}`}>{entry.name}</span>
                                                    {entry.is_me && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/20 text-primary shrink-0">我</span>}
                                                </div>
                                                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-1">
                                                    <Icon className="w-3.5 h-3.5" />
                                                    <span>
                                                        {entry.score} {activeConfig.scoreLabel}
                                                    </span>
                                                    {entry.secondary_info && (
                                                        <span className="text-muted-foreground/60 ml-1 text-[10px]">
                                                            ({entry.secondary_info})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                {entry.change === "up" && <div className="bg-green-500/10 p-1 rounded-full"><ArrowUp className="w-4 h-4 text-green-500" /></div>}
                                                {entry.change === "down" && <div className="bg-red-500/10 p-1 rounded-full"><ArrowDown className="w-4 h-4 text-red-500" /></div>}
                                                {entry.change === "same" && <div className="w-5 h-1.5 bg-muted rounded-full mx-auto" />}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Load More */}
            {hasMore && items.length > 0 && (
                <button
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                    {isLoading ? "加载中..." : "加载更多"}
                </button>
            )}

            {/* Current User Sticky Bar */}
            <div className="sticky bottom-0 mt-4 p-4 rounded-t-2xl bg-gradient-to-r from-primary/20 to-cyan-500/20 backdrop-blur-md border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 text-center font-black italic">{myRank?.rank || '-'}</div>
                    <div className="font-bold">{myRank?.name || '我'}</div>
                </div>
                <div className="font-black text-primary text-xl">
                    {myRank?.score || 0} <span className="text-sm font-normal">{activeConfig.scoreLabel}</span>
                </div>
            </div>
        </div>
    )
}
