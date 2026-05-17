"use client"

import React, { useState } from "react"
import { useRegion } from "@/contexts/RegionContext"
import { Calendar, Users, Globe, UserCheck, Map, BarChart2, Scale, Swords, Crosshair, Rocket, TrendingDown } from "lucide-react"

type TimeFilter = "today" | "week" | "season"
type ScopeFilter = "city" | "county" | "friends"
type MetricFilter = "overall" | "ratio" | "rivals" | "stealers" | "gainers" | "losers"

interface LeaderboardFilterProps {
  onTimeFilterChange?: (filter: TimeFilter) => void
  onScopeFilterChange?: (filter: ScopeFilter) => void
  onMetricFilterChange?: (filter: MetricFilter) => void
  defaultTimeFilter?: TimeFilter
  defaultScopeFilter?: ScopeFilter
  defaultMetricFilter?: MetricFilter
}

export function LeaderboardFilter({
  onTimeFilterChange,
  onScopeFilterChange,
  onMetricFilterChange,
  defaultTimeFilter = "today",
  defaultMetricFilter = "overall"
}: LeaderboardFilterProps) {
  const { region, updateRegion } = useRegion()
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(defaultTimeFilter)
  const [metricFilter, setMetricFilter] = useState<MetricFilter>(defaultMetricFilter)

  const handleTimeChange = (filter: TimeFilter) => {
    setTimeFilter(filter)
    onTimeFilterChange?.(filter)
  }

  const handleScopeChange = (filter: ScopeFilter) => {
    if (filter === 'city' || filter === 'county') {
      updateRegion({ regionType: filter })
    }
  }

  const handleMetricChange = (filter: MetricFilter) => {
    setMetricFilter(filter)
    onMetricFilterChange?.(filter)
  }

  const timeOptions: { value: TimeFilter; label: string }[] = [
    { value: "today", label: "今日" },
    { value: "week", label: "本周" },
    { value: "season", label: "本赛季" },
  ]

  const scopeOptions: { value: ScopeFilter; label: string; icon: React.ElementType }[] = [
    { value: "city", label: "全市", icon: Globe },
    { value: "county", label: "全区", icon: Map },
    { value: "friends", label: "好友", icon: UserCheck },
  ]

  const metricOptions: { value: MetricFilter; label: string; icon: React.ElementType }[] = [
    { value: "overall", label: "总榜", icon: BarChart2 },
    { value: "ratio", label: "胜率", icon: Scale },
    { value: "rivals", label: "宿敌", icon: Swords },
    { value: "stealers", label: "偷家", icon: Crosshair },
    { value: "gainers", label: "新锐", icon: Rocket },
    { value: "losers", label: "失地", icon: TrendingDown },
  ]

  return (
    <div className="space-y-3">
      {/* Time Filter */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-1.5 backdrop-blur-xl">
        <div className="flex items-center gap-1">
          <Calendar className="ml-2 h-4 w-4 text-white/40" />
          <div className="flex flex-1 gap-1">
            {timeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleTimeChange(option.value)}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-[0.98] ${
                  timeFilter === option.value
                    ? "bg-[#22c55e] text-black shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scope Filter */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-1.5 backdrop-blur-xl">
        <div className="flex items-center gap-1">
          <Users className="ml-2 h-4 w-4 text-white/40" />
          <div className="flex flex-1 gap-1">
            {scopeOptions.map((option) => {
              if (option.value === 'friends') return null;

              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  onClick={() => handleScopeChange(option.value)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-[0.98] ${
                    region?.regionType === option.value
                      ? "bg-[#22c55e] text-black shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Metric Filter (New Grid Layout) */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur-xl">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {metricOptions.map((option) => {
            const Icon = option.icon
            const isActive = metricFilter === option.value
            return (
              <button
                key={option.value}
                onClick={() => handleMetricChange(option.value)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-2 transition-all active:scale-[0.95] ${
                  isActive
                    ? "bg-white/10 text-[#22c55e]"
                    : "text-white/40 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-[#22c55e]" : "text-current"}`} />
                <span className="text-[10px] font-medium tracking-wide">{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Current Filter Summary */}
      <div className="flex items-center justify-center gap-2 text-xs text-white/40">
        <span>显示:</span>
        <span className="rounded-full bg-[#22c55e]/20 px-2 py-0.5 font-medium text-[#22c55e]">
          {timeOptions.find(o => o.value === timeFilter)?.label}
        </span>
        <span>范围:</span>
        <span className="rounded-full bg-[#22c55e]/20 px-2 py-0.5 font-medium text-[#22c55e]">
          {scopeOptions.find(o => o.value === region?.regionType)?.label || "全市"}
        </span>
        <span>维度:</span>
        <span className="rounded-full bg-[#22c55e]/20 px-2 py-0.5 font-medium text-[#22c55e]">
          {metricOptions.find(o => o.value === metricFilter)?.label}
        </span>
      </div>
    </div>
  )
}
