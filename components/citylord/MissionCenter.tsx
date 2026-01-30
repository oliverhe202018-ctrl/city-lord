"use client"

import React, { useState } from "react"
import {
  Trophy, Hexagon, Footprints, Clock, Zap, Gift, CheckCircle2,
  ChevronRight, Flame, Target, Sparkles, Lock
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useGameStore, useGameActions } from "@/store/useGameStore"
import { useHydration } from "@/hooks/useHydration"
import { GlassCard } from "@/components/ui/GlassCard"
import { CyberButton } from "@/components/ui/CyberButton"
import { getUserMissions, claimMissionReward, claimAllMissionsRewards } from "@/app/actions/mission"

// --- Types ---

type MissionType = "daily" | "weekly" | "achievement"
type MissionStatus = "locked" | "active" | "completed" | "claimed"
type MissionDifficulty = "easy" | "medium" | "hard" | "legendary"

interface MissionReward {
  type: "xp" | "coins" | "badge"
  amount: number
  label: string
}

interface MissionData {
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
}

const difficultyConfig: Record<MissionDifficulty, { color: string; bg: string; label: string }> = {
  easy: { color: "text-green-400", bg: "bg-green-400/20", label: "简单" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-400/20", label: "中等" },
  hard: { color: "text-orange-400", bg: "bg-orange-400/20", label: "困难" },
  legendary: { color: "text-purple-400", bg: "bg-purple-400/20", label: "传奇" },
}

// --- Mission Card Component ---

interface MissionCardProps extends MissionData {
  onClaim?: (id: string, reward: MissionReward) => void
  onClick?: (id: string) => void
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
    onClaim?.(id, reward)
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
    <GlassCard
      onClick={() => !isLocked && onClick?.(id)}
      className={`group p-4 ${isLocked ? 'opacity-60 grayscale' : ''}`}
      interactive={!isLocked}
    >
      {/* Glow effect for claimable */}
      {canClaim && (
        <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.15)_0%,transparent_70%)] pointer-events-none" />
      )}

      <div className="relative flex items-start gap-3">
        {/* Icon */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isLocked
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
                  className={`h-full rounded-full transition-all duration-500 ${isCompleted
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
              <CyberButton
                size="sm"
                variant="primary"
                onClick={handleClaim}
                isLoading={isClaiming}
                className="bg-[#22c55e] hover:bg-[#22c55e]/90 border-transparent shadow-[0_0_10px_rgba(34,197,94,0.4)]"
              >
                <Gift className="h-4 w-4 mr-1" />
                领取
              </CyberButton>
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
    </GlassCard>
  )
}

// --- Mission Center Page Component ---

const sampleMissions: MissionData[] = [
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

export function MissionCenter() {
  const [missions, setMissions] = useState(sampleMissions)
  const [activeFilter, setActiveFilter] = useState<"daily" | "weekly" | "all">("all")
  const { addExperience } = useGameActions()
  const isHydrated = useHydration()

  React.useEffect(() => {
    async function fetchMissions() {
      try {
        const { data: userMissions } = await getUserMissions()
        if (userMissions?.length) {
          setMissions(prev => prev.map(m => {
            const userMission = userMissions.find((um: any) => um.mission_id === m.id) as any
            if (userMission) {
              return {
                ...m,
                status: userMission.status as MissionStatus,
                progress: userMission.progress
              }
            }
            return m
          }))
        }
      } catch (error) {
        console.error("Failed to fetch missions", error)
      }
    }
    fetchMissions()
  }, [])

  if (!isHydrated) {
    return (
      <div className="h-full overflow-y-auto bg-[#0f172a] px-4 pb-24 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">任务中心</h1>
            <p className="text-sm text-white/60">完成挑战获取奖励</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="text-white/60">加载中...</div>
        </div>
      </div>
    )
  }

  const claimableCount = missions.filter(m => m.status === "completed").length

  const router = useRouter()

  const handleTaskClick = (id: string) => {
    // Navigate based on task type or ID if needed, 
    // for now default to map/home for gameplay tasks
    router.push('/')
    toast.info("前往完成任务")
  }

  const handleClaim = async (id: string, reward: MissionReward) => {
    const mission = missions.find(m => m.id === id)
    if (!mission) return

    try {
      const result = await claimMissionReward(id, mission.title, "xp", reward.amount) // Fixed args: title, type, amount

      if (!result.success) {
        toast.error(result.message || "领取失败")
        return
      }

      setMissions(prev =>
        prev.map(m => (m.id === id ? { ...m, status: "claimed" as MissionStatus } : m))
      )

      // Add XP locally for immediate feedback (optional, since DB is updated)
      if (reward.type === "xp") {
        addExperience(reward.amount)
      }

      toast.success(`领取成功！获得 ${reward.amount} ${reward.label}`, {
        icon: <Gift className="text-green-400" />,
        style: { background: 'rgba(0,0,0,0.8)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
      })
    } catch (error) {
      toast.error("领取失败", {
        description: error instanceof Error ? error.message : "未知错误",
        style: { background: 'rgba(0,0,0,0.8)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
      })
    }
  }

  const handleClaimAll = async () => {
    const claimable = missions.filter(m => m.status === "completed")
    if (claimable.length === 0) return

    try {
      // 调用后端聚合接口
      // Map to correct Task structure if needed, or update claimAllMissionsRewards signature
      // Current usage seems to match expected backend type broadly
      const tasksToClaim = claimable.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        type: m.type as any,
        icon: '',
        target: m.maxProgress,
        current: m.progress,
        reward: {
          points: m.reward.type === 'coins' ? m.reward.amount : 0,
          experience: m.reward.type === 'xp' ? m.reward.amount : 0
        },
        status: m.status as any
      }))

      const results = await claimAllMissionsRewards(tasksToClaim)

      // 根据返回结果更新本地状态
      setMissions(prev =>
        prev.map(prevM => {
          if (results.claimed.includes(prevM.id)) {
            return { ...prevM, status: "claimed" as MissionStatus }
          }
          return prevM
        })
      )

      const totalXp = claimable.reduce((sum, m) => m.reward.type === "xp" ? sum + m.reward.amount : sum, 0)
      if (totalXp > 0) addExperience(totalXp)

      if (results.claimed.length > 0) {
        toast.success(`一键领取成功！共领取 ${results.claimed.length} 个任务`, {
          icon: <Gift className="text-green-400" />,
          style: { background: 'rgba(0,0,0,0.8)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
        })
      } else if (results.failed.length > 0) {
        toast.error("部分任务领取失败，请重试")
      }
    } catch (error) {
      console.error("Failed to claim all missions", error)
      toast.error("一键领取失败，请稍后重试")
    }
  }

  const filteredMissions = missions.filter(m => {
    if (activeFilter === "all") return true
    return m.type === activeFilter
  })

  return (
    <div className="h-full overflow-y-auto bg-[#0f172a] px-4 pb-24 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">任务中心</h1>
          <p className="text-sm text-white/60">完成挑战获取奖励</p>
        </div>

        {claimableCount > 0 && (
          <CyberButton
            variant="primary"
            size="sm"
            onClick={handleClaimAll}
            className="animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.4)] border-green-500/50 bg-green-500 hover:bg-green-400 text-black"
          >
            <Sparkles className="mr-1 h-4 w-4" />
            一键领取 ({claimableCount})
          </CyberButton>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 rounded-xl border border-white/10 bg-black/40 p-1 backdrop-blur-xl">
        {(["all", "daily", "weekly"] as const).map((f) => {
          const labels = { all: "全部", daily: "每日", weekly: "每周" }
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeFilter === f
                ? "bg-[#22c55e] text-black shadow-lg shadow-green-500/20"
                : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
            >
              {labels[f]}
            </button>
          )
        })}
      </div>

      {/* Mission Cards */}
      <div className="space-y-4">
        {filteredMissions.map((mission) => (
          <MissionCard
            key={mission.id}
            {...mission}
            onClaim={handleClaim}
            onClick={handleTaskClick}
          />
        ))}
      </div>
    </div>
  )
}

export default MissionCenter