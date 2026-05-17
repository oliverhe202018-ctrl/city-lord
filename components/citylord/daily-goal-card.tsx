"use client"

import { Target, Footprints, Hexagon, Flame, ChevronRight, Zap } from "lucide-react"
import { formatArea } from "@/lib/citylord/area-utils"

interface DailyGoalCardProps {
  areaGoal: number // in m²
  areaProgress: number // in m²
  distanceGoal: number
  distanceProgress: number
  streak: number
  onViewDetails?: () => void
  isMinimized?: boolean
}

export function DailyGoalCard({
  areaGoal = 1300, // 5 hexes = 1300 m²
  areaProgress = 520, // 2 hexes = 520 m²
  distanceGoal = 3,
  distanceProgress = 1.2,
  streak = 7,
  onViewDetails,
  isMinimized = false,
}: DailyGoalCardProps) {
  const areaPercent = Math.min((areaProgress / areaGoal) * 100, 100)
  const distancePercent = Math.min((distanceProgress / distanceGoal) * 100, 100)
  const isAreaComplete = areaProgress >= areaGoal
  const isDistanceComplete = distanceProgress >= distanceGoal

  const formattedGoal = formatArea(areaGoal)
  const formattedProgress = formatArea(areaProgress)

  if (isMinimized) {
    return (
      <div 
        onClick={onViewDetails}
        className="flex h-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-xl"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#22c55e]/20">
          <Target className="h-4 w-4 text-[#22c55e]" />
        </div>
        <div className="flex-grow overflow-hidden">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-white">今日目标</p>
            <div className="flex items-center gap-1 rounded-full bg-orange-500/20 px-1.5 py-0.5">
              <Flame className="h-3 w-3 text-orange-400" />
              <span className="text-xs font-bold text-orange-400">{streak}</span>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1 flex-grow overflow-hidden rounded-full bg-white/10">
              <div 
                className="h-full rounded-full bg-cyan-400"
                style={{ width: `${areaPercent}%` }}
              />
            </div>
            <div className="h-1 flex-grow overflow-hidden rounded-full bg-white/10">
              <div 
                className="h-full rounded-full bg-purple-400"
                style={{ width: `${distancePercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#22c55e]/20">
            <Target className="h-4 w-4 text-[#22c55e]" />
          </div>
          <div>
            <h3 className="font-bold text-white">今日目标</h3>
            <p className="text-xs text-white/50">完成目标获取双倍经验</p>
          </div>
        </div>
        
        {/* Streak Badge */}
        <div className="flex items-center gap-1 rounded-full bg-orange-500/20 px-2.5 py-1">
          <Flame className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-bold text-orange-400">{streak}天</span>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {/* Area Goal */}
        <div className={`rounded-xl p-3 transition-all ${
          isAreaComplete 
            ? "border border-[#22c55e]/30 bg-[#22c55e]/10" 
            : "bg-white/5"
        }`}>
          <div className="mb-2 flex items-center justify-between">
            <Hexagon className={`h-5 w-5 ${isAreaComplete ? "text-[#22c55e]" : "text-cyan-400"}`} />
            {isAreaComplete && (
              <span className="rounded-full bg-[#22c55e]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#22c55e]">
                完成
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-white">
            {formattedProgress.value}
            <span className="text-sm font-normal text-white/40">/{formattedGoal.value}</span>
          </p>
          <p className="mb-2 text-xs text-white/50">面积目标 ({formattedGoal.unit})</p>
          
          {/* Progress Bar */}
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                isAreaComplete ? "bg-[#22c55e]" : "bg-cyan-400"
              }`}
              style={{ width: `${areaPercent}%` }}
            />
          </div>
        </div>

        {/* Distance Goal */}
        <div className={`rounded-xl p-3 transition-all ${
          isDistanceComplete 
            ? "border border-[#22c55e]/30 bg-[#22c55e]/10" 
            : "bg-white/5"
        }`}>
          <div className="mb-2 flex items-center justify-between">
            <Footprints className={`h-5 w-5 ${isDistanceComplete ? "text-[#22c55e]" : "text-purple-400"}`} />
            {isDistanceComplete && (
              <span className="rounded-full bg-[#22c55e]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#22c55e]">
                完成
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-white">
            {distanceProgress.toFixed(1)}
            <span className="text-sm font-normal text-white/40">/{distanceGoal}km</span>
          </p>
          <p className="mb-2 text-xs text-white/50">里程目标</p>
          
          {/* Progress Bar */}
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                isDistanceComplete ? "bg-[#22c55e]" : "bg-purple-400"
              }`}
              style={{ width: `${distancePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bonus XP Indicator */}
      {(isAreaComplete || isDistanceComplete) && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[#22c55e]/10 py-2">
          <Zap className="h-4 w-4 text-[#22c55e]" />
          <span className="text-sm font-medium text-[#22c55e]">
            {isAreaComplete && isDistanceComplete 
              ? "全部完成！双倍经验已激活" 
              : "继续加油，完成全部目标获取双倍经验"}
          </span>
        </div>
      )}

      {/* View Details Button */}
      <button
        onClick={onViewDetails}
        className="flex w-full items-center justify-center gap-1 rounded-xl bg-white/5 py-2.5 text-sm text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]"
      >
        查看更多任务
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
