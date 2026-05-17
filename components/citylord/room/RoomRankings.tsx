"use client"

import React, { useState } from "react"
import useSWR from "swr"
import { 
  Trophy, 
  Crown, 
  Medal, 
  Ghost, 
  Loader2, 
  BarChart2, 
  Scale, 
  Swords, 
  Crosshair, 
  Rocket, 
  TrendingDown,
  ChevronRight
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

interface RankingItem {
  rank: number
  userId: string
  name: string
  avatar: string
  value: number | string
}

interface RoomRankingsProps {
  roomId: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const metricOptions = [
  { value: "overall", label: "总榜", icon: BarChart2 },
  { value: "ratio", label: "胜率", icon: Scale },
  { value: "rivals", label: "宿敌", icon: Swords },
  { value: "stealers", label: "偷家", icon: Crosshair },
  { value: "gainers", label: "新锐", icon: Rocket },
  { value: "losers", label: "失地", icon: TrendingDown },
] as const

type MetricFilter = typeof metricOptions[number]["value"]

export function RoomRankings({ roomId }: RoomRankingsProps) {
  const [activeFilter, setActiveFilter] = useState<MetricFilter>("overall")

  const { data, error, isLoading } = useSWR<{ success: boolean; data: RankingItem[] }>(
    `/api/room/rankings?roomId=${roomId}&filter=${activeFilter}`,
    fetcher
  )

  const rankings = data?.success ? data.data : []

  const formatValue = (value: number | string, filter: MetricFilter) => {
    if (filter === "ratio") {
      // Backend returns string like "45.20%" or "0%"
      const numValue = typeof value === "string" ? parseFloat(value) : value
      return `${numValue.toFixed(1)}%`
    }
    
    if (filter === "rivals") {
      return `${value} 次交锋`
    }

    // Area filters: overall, stealers, gainers, losers
    // Backend returns string (km2)
    // Conversion to FT²: 1 km² = 10,763,910.4 FT²
    const km2Value = typeof value === "string" ? parseFloat(value) : (value as number)
    const ft2Value = km2Value * 10763910.4
    
    const formatted = Math.round(ft2Value).toLocaleString()
    return `${formatted} FT²`
  }

  const getRankVisual = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-400 fill-yellow-400/20" />
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-300 fill-slate-300/20" />
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600 fill-amber-600/20" />
    return <span className="text-sm font-medium text-white/40">{rank}</span>
  }

  return (
    <div className="flex h-full flex-col bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
      {/* 1. Metric Filters (Horizontal Scroll) */}
      <div className="px-4 py-4 border-b border-white/5 bg-white/5">
        <ScrollArea orientation="horizontal" className="w-full whitespace-nowrap pb-2">
          <div className="flex gap-2">
            {metricOptions.map((option) => {
              const Icon = option.icon
              const isActive = activeFilter === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => setActiveFilter(option.value)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium transition-all active:scale-[0.95]",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]" 
                      : "text-white/40 hover:text-white/80 hover:bg-white/5 border border-white/5"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* 2. Rankings List */}
      <div className="flex-1 min-h-0 relative">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 animate-pulse">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : rankings.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Ghost className="h-10 w-10 text-white/20" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">暂无数据</h3>
            <p className="text-sm text-white/40 max-w-[200px]">
              快去占领领地吧！
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2 pb-10">
              {rankings.map((item) => {
                const isNegative = typeof item.value === 'string' 
                  ? item.value.startsWith('-') 
                  : item.value < 0
                
                return (
                  <div 
                    key={item.userId}
                    className="group flex items-center gap-4 p-4 rounded-2xl transition-all hover:bg-white/5 border border-transparent hover:border-white/10"
                  >
                    {/* Rank */}
                    <div className="w-8 flex justify-center shrink-0">
                      {getRankVisual(item.rank)}
                    </div>

                    {/* User Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 border border-white/10 bg-white/5">
                        <AvatarImage src={item.avatar} alt={item.name} />
                        <AvatarFallback className="bg-white/5 text-white/40">
                          {item.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-white truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-white/30 uppercase tracking-wider">
                          Lord Edition
                        </span>
                      </div>
                    </div>

                    {/* Value */}
                    <div className="text-right shrink-0">
                      <div className={cn(
                        "text-sm font-bold font-mono tracking-tight",
                        isNegative && activeFilter === "losers" ? "text-red-500" : "text-[#22c55e]"
                      )}>
                        {formatValue(item.value, activeFilter)}
                      </div>
                      <div className="text-[10px] text-white/20">
                        {activeFilter === "ratio" ? "Win Rate" : activeFilter === "rivals" ? "Encounters" : "Territory"}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-white/10 group-hover:text-white/40 transition-colors" />
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
