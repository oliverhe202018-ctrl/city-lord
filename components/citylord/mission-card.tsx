"use client"

import React from "react"

import { useState } from "react"
import { 
  Trophy, 
  Hexagon, 
  Footprints, 
  Clock, 
  Zap, 
  Gift,
  CheckCircle2,
  ChevronRight,
  Flame,
  Target,
  Sparkles,
  Lock
} from "lucide-react"

type MissionType = "daily" | "weekly" | "achievement"
type MissionStatus = "locked" | "active" | "completed" | "claimed"
type MissionDifficulty = "easy" | "medium" | "hard" | "legendary"

interface MissionReward {
  type: "xp" | "coins" | "badge"
  amount: number
  label: string
}

interface MissionCardProps {
  id: string
  title: string
  description: string
  type: MissionType
  status: MissionStatus
  progress: number
  maxProgress: number
  reward: MissionReward
  difficulty?: MissionDifficulty
  timeRemaining?: string
  icon?: React.ElementType
  onClaim?: (id: string) => void
  onClick?: (id: string) => void
}

const difficultyConfig: Record<MissionDifficulty, { color: string; bg: string; label: string }> = {
  easy: { color: "text-green-400", bg: "bg-green-400/20", label: "简单" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-400/20", label: "中等" },
  hard: { color: "text-orange-400", bg: "bg-orange-400/20", label: "困难" },
  legendary: { color: "text-purple-400", bg: "bg-purple-400/20", label: "传奇" },
}

export function MissionCard({
  id,
  title,
  description,
  type,
  status,
  progress,
  maxProgress,
  reward,
  difficulty = "medium",
  timeRemaining,
  icon: CustomIcon,
  onClaim,
  onClick,
}: MissionCardProps) {
  const [isClaiming, setIsClaiming] = useState(false)

  const progressPercent = Math.min((progress / maxProgress) * 100, 100)
  const isCompleted = status === "completed" || status === "claimed"
  const isLocked = status === "locked"
  const canClaim = status === "completed"

  const handleClaim = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canClaim || isClaiming) return
    
    setIsClaiming(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    onClaim?.(id)
    setIsClaiming(false)
  }

  const Icon = CustomIcon || Hexagon
  const diffConfig = difficultyConfig[difficulty]

  const getRewardIcon = () => {
    switch (reward.type) {
      case "xp": return Zap
      case "coins": return Sparkles
      case "badge": return Trophy
      default: return Gift
    }
  }
  const RewardIcon = getRewardIcon()

  return (
    <div
      onClick={() => !isLocked && onClick?.(id)}
      className={`group relative overflow-hidden rounded-2xl border transition-all active:scale-[0.98] ${
        isLocked
          ? "cursor-not-allowed border-white/5 bg-black/20 opacity-60"
          : status === "claimed"
            ? "cursor-default border-[#22c55e]/20 bg-[#22c55e]/5"
            : canClaim
              ? "cursor-pointer border-[#22c55e]/40 bg-[#22c55e]/10"
              : "cursor-pointer border-white/10 bg-black/40 hover:border-white/20 hover:bg-black/50"
      } p-4 backdrop-blur-xl`}
    >
      {/* Glow effect for claimable */}
      {canClaim && (
        <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.15)_0%,transparent_70%)]" />
      )}

      <div className="relative flex items-start gap-3">
        {/* Icon */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            isLocked
              ? "bg-white/5"
              : isCompleted
                ? "bg-[#22c55e]/20"
                : "bg-white/10"
          }`}
        >
          {isLocked ? (
            <Lock className="h-5 w-5 text-white/30" />
          ) : isCompleted ? (
            <CheckCircle2 className="h-6 w-6 text-[#22c55e]" />
          ) : (
            <Icon className={`h-6 w-6 ${diffConfig.color}`} />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className={`truncate font-semibold ${isLocked ? "text-white/40" : "text-white"}`}>
                  {title}
                </h3>
                {type === "daily" && (
                  <span className="shrink-0 rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                    每日
                  </span>
                )}
                {type === "weekly" && (
                  <span className="shrink-0 rounded-full bg-purple-400/20 px-2 py-0.5 text-[10px] font-medium text-purple-400">
                    每周
                  </span>
                )}
              </div>
              <p className={`mt-0.5 text-sm ${isLocked ? "text-white/20" : "text-white/50"}`}>
                {description}
              </p>
            </div>

            {/* Difficulty badge */}
            {!isLocked && type === "achievement" && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${diffConfig.bg} ${diffConfig.color}`}>
                {diffConfig.label}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {!isLocked && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">
                  {progress} / {maxProgress}
                </span>
                {timeRemaining && (
                  <span className="flex items-center gap-1 text-white/40">
                    <Clock className="h-3 w-3" />
                    {timeRemaining}
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isCompleted
                      ? "bg-[#22c55e]"
                      : "bg-gradient-to-r from-[#22c55e]/70 to-[#22c55e]"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer - Reward & Action */}
          <div className="mt-3 flex items-center justify-between">
            {/* Reward */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-[#22c55e]/10 px-2.5 py-1">
                <RewardIcon className="h-3.5 w-3.5 text-[#22c55e]" />
                <span className="text-xs font-medium text-[#22c55e]">
                  +{reward.amount} {reward.label}
                </span>
              </div>
            </div>

            {/* Action button */}
            {canClaim ? (
              <button
                onClick={handleClaim}
                disabled={isClaiming}
                className="flex items-center gap-1.5 rounded-xl bg-[#22c55e] px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-[#22c55e]/90 active:scale-95 disabled:opacity-50"
              >
                {isClaiming ? (
                  <span className="animate-spin">...</span>
                ) : (
                  <>
                    <Gift className="h-4 w-4" />
                    领取
                  </>
                )}
              </button>
            ) : status === "claimed" ? (
              <span className="flex items-center gap-1 text-sm text-[#22c55e]">
                <CheckCircle2 className="h-4 w-4" />
                已领取
              </span>
            ) : !isLocked ? (
              <ChevronRight className="h-5 w-5 text-white/30 transition-transform group-hover:translate-x-1" />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Mission List Component */
interface MissionListProps {
  filter?: "daily" | "weekly" | "all"
}

const sampleMissions: MissionCardProps[] = [
  {
    id: "1",
    title: "占领5个边缘领地",
    description: "将你的领地扩展到城市边界",
    type: "daily",
    status: "active",
    progress: 3,
    maxProgress: 5,
    reward: { type: "xp", amount: 150, label: "经验" },
    difficulty: "medium",
    timeRemaining: "8小时23分",
    icon: Hexagon,
  },
  {
    id: "2",
    title: "跑步5公里",
    description: "完成5公里的跑步距离",
    type: "daily",
    status: "completed",
    progress: 5,
    maxProgress: 5,
    reward: { type: "xp", amount: 100, label: "经验" },
    difficulty: "easy",
    icon: Footprints,
  },
  {
    id: "3",
    title: "连续7天跑步",
    description: "连续一周每天跑步",
    type: "weekly",
    status: "active",
    progress: 4,
    maxProgress: 7,
    reward: { type: "badge", amount: 1, label: "徽章" },
    difficulty: "hard",
    icon: Flame,
  },
  {
    id: "4",
    title: "领地霸主",
    description: "同时拥有100个领地格",
    type: "achievement",
    status: "active",
    progress: 67,
    maxProgress: 100,
    reward: { type: "xp", amount: 500, label: "经验" },
    difficulty: "legendary",
    icon: Target,
  },
  {
    id: "5",
    title: "首战告捷",
    description: "赢得你的第一场领地战斗",
    type: "achievement",
    status: "claimed",
    progress: 1,
    maxProgress: 1,
    reward: { type: "xp", amount: 50, label: "经验" },
    difficulty: "easy",
    icon: Trophy,
  },
]

export function MissionList({ filter = "all" }: MissionListProps) {
  const [missions, setMissions] = useState(sampleMissions)
  const [activeFilter, setActiveFilter] = useState(filter)

  const handleClaim = (id: string) => {
    setMissions(prev =>
      prev.map(m => (m.id === id ? { ...m, status: "claimed" as MissionStatus } : m))
    )
  }

  const filteredMissions = missions.filter(m => {
    if (activeFilter === "all") return true
    return m.type === activeFilter
  })

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 rounded-xl border border-white/10 bg-black/40 p-1 backdrop-blur-xl">
        {(["all", "daily", "weekly"] as const).map((f) => {
          const labels = { all: "全部", daily: "每日", weekly: "每周" }
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeFilter === f
                  ? "bg-[#22c55e] text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {labels[f]}
            </button>
          )
        })}
      </div>

      {/* Mission Cards */}
      <div className="space-y-3">
        {filteredMissions.map((mission) => (
          <MissionCard
            key={mission.id}
            {...mission}
            onClaim={handleClaim}
          />
        ))}
      </div>
    </div>
  )
}
