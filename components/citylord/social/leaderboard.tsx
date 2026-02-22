"use client"

import React, { useState } from "react"
import { Trophy, Medal, Star, Shield, ArrowUp, ArrowDown, MapPin, Zap } from "lucide-react"

export function Leaderboard() {
    const [activeTab, setActiveTab] = useState<"distance" | "territory">("distance")
    const [isLoading, setIsLoading] = useState(true)

    React.useEffect(() => {
        setIsLoading(true)
        const t = setTimeout(() => setIsLoading(false), 600)
        return () => clearTimeout(t)
    }, [activeTab])

    // Mock data for globals
    const mockRankings = [
        { id: "1", name: "跑神阿甘", level: 42, score: 1042.5, trend: "up", avatar: "🏃", faction: "blue", isSelf: false },
        { id: "2", name: "夜跑狂魔", level: 38, score: 985.2, trend: "same", avatar: "🦇", faction: "red", isSelf: false },
        { id: "3", name: "CityLord", level: 35, score: 876.0, trend: "up", avatar: "👑", faction: "blue", isSelf: false },
        { id: "me", name: "我", level: 12, score: 125.4, trend: "up", avatar: "😎", faction: "red", isSelf: true }, // Added self for testing in-row highlight
        { id: "5", name: "风无痕", level: 30, score: 102.8, trend: "up", avatar: "🦅", faction: "blue", isSelf: false },
    ]

    const currentUserRank = { rank: 124, name: "我", score: 125.4, level: 12 }

    return (
        <div className="flex flex-col space-y-4">
            <div className="flex gap-2 p-1 rounded-xl bg-muted/20 border border-border/50">
                <button
                    onClick={() => setActiveTab("distance")}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-bold transition-all ${activeTab === "distance" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    里程榜
                </button>
                <button
                    onClick={() => setActiveTab("territory")}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-bold transition-all ${activeTab === "territory" ? "bg-cyan-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    领地榜
                </button>
            </div>

            <div className="space-y-3 min-h-[300px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-10">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="mt-4 text-sm text-muted-foreground animate-pulse">加载榜单中...</p>
                    </div>
                ) : mockRankings.length === 0 ? (
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
                    mockRankings.map((user, idx) => (
                        <div key={user.id} className={`flex items-center gap-3 p-3 rounded-2xl border shadow-sm transition-all hover:shadow-md ${user.isSelf ? 'bg-primary/5 border-primary/50' : 'bg-card border-border hover:border-primary/30'}`}>
                            <div className="w-8 text-center font-black italic text-lg opacity-80">
                                {idx === 0 ? <Medal className="w-6 h-6 text-yellow-500 mx-auto drop-shadow-sm" /> :
                                    idx === 1 ? <Medal className="w-6 h-6 text-gray-400 mx-auto drop-shadow-sm" /> :
                                        idx === 2 ? <Medal className="w-6 h-6 text-amber-600 mx-auto drop-shadow-sm" /> :
                                            <span className="text-muted-foreground">{idx + 1}</span>}
                            </div>

                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted border-2 border-background shadow-inner text-2xl">
                                {user.avatar}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold truncate max-w-[150px] sm:max-w-[200px] ${user.isSelf ? 'text-primary' : ''}`}>{user.name}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/80 shrink-0">Lv.{user.level}</span>
                                    {user.faction === 'red' && <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />}
                                    {user.faction === 'blue' && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />}
                                </div>
                                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-1">
                                    {activeTab === "distance" ? <Zap className="w-3.5 h-3.5 text-yellow-500" /> : <MapPin className="w-3.5 h-3.5 text-cyan-500" />}
                                    <span className={activeTab === "distance" ? "text-yellow-600 dark:text-yellow-400/80" : "text-cyan-600 dark:text-cyan-400/80"}>
                                        {user.score.toFixed(1)} {activeTab === "distance" ? "km" : "格"}
                                    </span>
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                {user.trend === "up" && <div className="bg-green-500/10 p-1 rounded-full"><ArrowUp className="w-4 h-4 text-green-500" /></div>}
                                {user.trend === "down" && <div className="bg-red-500/10 p-1 rounded-full"><ArrowDown className="w-4 h-4 text-red-500" /></div>}
                                {user.trend === "same" && <div className="w-5 h-1.5 bg-muted rounded-full mx-auto" />}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Current User Sticky Bar */}
            <div className="sticky bottom-0 mt-4 p-4 rounded-t-2xl bg-gradient-to-r from-primary/20 to-cyan-500/20 backdrop-blur-md border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 text-center font-black italic">{currentUserRank.rank}</div>
                    <div className="font-bold">{currentUserRank.name}</div>
                </div>
                <div className="font-black text-primary text-xl">{currentUserRank.score} <span className="text-sm font-normal">{activeTab === "distance" ? "km" : "格"}</span></div>
            </div>
        </div>
    )
}
