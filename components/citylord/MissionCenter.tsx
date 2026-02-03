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
import { fetchUserMissions, claimMissionReward } from "@/app/actions/mission"

// --- Types ---

type MissionType = "daily" | "weekly" | "achievement" | "one_time"
type MissionStatus = "locked" | "active" | "completed" | "claimed" | "todo" | "ongoing" | "in-progress"
type MissionDifficulty = "easy" | "medium" | "hard" | "legendary"

interface MissionReward {
  type: "xp" | "coins" | "both" | "badge"
  xpAmount?: number
  coinsAmount?: number
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

  const progressPercent = maxProgress > 0 ? Math.min((progress / maxProgress) * 100, 100) : 0
  const isCompleted = status === "completed" || status === "claimed"
  const isLocked = status === "locked"
  const canClaim = status === "completed"
  // Treat todo/ongoing/in-progress as active (not locked, not completed)
  const isActive = status === "active" || status === "ongoing" || status === "todo" || status === "in-progress"

  const handleClaim = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canClaim || isClaiming) return

    setIsClaiming(true)
    // await new Promise(resolve => setTimeout(resolve, 500)) // Remove artificial delay
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
              {(reward.type === "xp" || reward.type === "both") && (
                <div className="flex items-center gap-1 rounded-full bg-[#22c55e]/10 px-2.5 py-1">
                  <Zap className="h-3.5 w-3.5 text-[#22c55e]" />
                  <span className="text-xs font-medium text-[#22c55e]">
                    +{reward.xpAmount} 经验
                  </span>
                </div>
              )}
              {(reward.type === "coins" || reward.type === "both") && (
                <div className="flex items-center gap-1 rounded-full bg-yellow-400/10 px-2.5 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                  <span className="text-xs font-medium text-yellow-400">
                    +{reward.coinsAmount} 金币
                  </span>
                </div>
              )}
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

export function MissionCenter() {
  const [missions, setMissions] = useState<MissionData[]>([])
  const [activeFilter, setActiveFilter] = useState<"daily" | "weekly" | "all">("all")
  const { addExperience, addCoins } = useGameActions()
  const isHydrated = useHydration()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  React.useEffect(() => {
    async function fetchMissions() {
      try {
        setLoading(true)
        const userMissions = await fetchUserMissions()
        
        if (userMissions) {
          const formattedMissions: MissionData[] = userMissions.map((m: any) => {
            const hasXp = m.reward.reward_experience > 0
            const hasCoins = m.reward.reward_coins > 0
            
            let rewardType: "xp" | "coins" | "both" = "xp"
            let rewardLabel = "经验"
            let rewardAmount = m.reward.reward_experience

            if (hasXp && hasCoins) {
              rewardType = "both"
              rewardLabel = "奖励"
              rewardAmount = 0 // Not used for display in simple view
            } else if (hasCoins) {
              rewardType = "coins"
              rewardLabel = "金币"
              rewardAmount = m.reward.reward_coins
            }

            return {
              id: m.id,
              title: m.title,
              description: m.description,
              type: m.frequency === 'achievement' ? 'achievement' : (m.frequency || m.type) as MissionType,
              status: m.status as MissionStatus,
              progress: m.current,
              maxProgress: m.target,
              reward: { 
                type: rewardType,
                xpAmount: m.reward.reward_experience,
                coinsAmount: m.reward.reward_coins,
                amount: rewardAmount, // For simple display
                label: rewardLabel 
              },
              difficulty: "medium", // Default
              icon: Hexagon, // Default
            }
          })
          setMissions(formattedMissions)
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError' && error?.digest !== 'NEXT_REDIRECT') {
          console.error("Failed to fetch missions", error)
          toast.error("获取任务列表失败")
        }
      } finally {
        setLoading(false)
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

  // Debug: Manual Initialization
  const handleDebugInit = async () => {
    setLoading(true)
    try {
      toast.info("正在尝试初始化任务...")
      // Force re-fetch which triggers initialization
      const userMissions = await fetchUserMissions()
      if (userMissions && userMissions.length > 0) {
        toast.success(`初始化成功！找到 ${userMissions.length} 个任务`)
        // Update local state
        const formattedMissions: MissionData[] = userMissions.map((m: any) => {
            const hasXp = m.reward.reward_experience > 0
            const hasCoins = m.reward.reward_coins > 0
            
            let rewardType: "xp" | "coins" | "both" = "xp"
            let rewardLabel = "经验"
            let rewardAmount = m.reward.reward_experience

            if (hasXp && hasCoins) {
              rewardType = "both"
              rewardLabel = "奖励"
              rewardAmount = 0 // Not used for display in simple view
            } else if (hasCoins) {
              rewardType = "coins"
              rewardLabel = "金币"
              rewardAmount = m.reward.reward_coins
            }

            return {
              id: m.id,
              title: m.title,
              description: m.description,
              type: m.frequency === 'achievement' ? 'achievement' : (m.frequency || m.type) as MissionType,
              status: m.status as MissionStatus,
              progress: m.current,
              maxProgress: m.target,
              reward: { 
                type: rewardType,
                xpAmount: m.reward.reward_experience,
                coinsAmount: m.reward.reward_coins,
                amount: rewardAmount, // For simple display
                label: rewardLabel 
              },
              difficulty: "medium", // Default
              icon: Hexagon, // Default
            }
          })
          setMissions(formattedMissions)
      } else {
        toast.warning("初始化完成，但未找到任务。请检查数据库 RLS 策略。")
      }
    } catch (e) {
      console.error("Debug Init Failed:", e)
      toast.error("初始化失败，请查看控制台日志")
    } finally {
      setLoading(false)
    }
  }

  const claimableCount = missions.filter(m => m.status === "completed").length

  const handleTaskClick = (id: string) => {
    router.push('/')
    toast.info("前往完成任务")
  }

  const handleClaim = async (id: string, reward: MissionReward) => {
    const mission = missions.find(m => m.id === id)
    if (!mission) return

    try {
      const result = await claimMissionReward(id)

      if (!result.success) {
        toast.error(result.error || "领取失败")
        return
      }

      setMissions(prev =>
        prev.map(m => (m.id === id ? { ...m, status: "claimed" as MissionStatus } : m))
      )

      // Add XP and Coins locally for immediate feedback
      if (reward.type === "xp" || reward.type === "both") {
        addExperience(reward.xpAmount || 0)
      }
      if (reward.type === "coins" || reward.type === "both") {
        addCoins(reward.coinsAmount || 0)
      }

      const rewardText = reward.type === "both" 
        ? `${reward.xpAmount} 经验 + ${reward.coinsAmount} 金币`
        : `${reward.type === 'coins' ? reward.coinsAmount : reward.xpAmount} ${reward.label}`

      // Check for bonus in result
      if (result.data?.bonus) {
        const bonus = result.data.bonus;
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-bold">领取成功！</span>
            <span className="text-sm opacity-90">获得 {rewardText}</span>
            <span className="text-xs text-yellow-300 font-bold bg-yellow-500/20 px-2 py-1 rounded w-fit">
              阵营加成 +{bonus.percentage}%: 额外获得 {bonus.xp} 经验, {bonus.coins} 金币
            </span>
          </div>
        , {
          icon: <Gift className="text-green-400" />,
          style: { background: 'rgba(0,0,0,0.9)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
        })
        
        // Add Bonus locally
        if (bonus.xp > 0) addExperience(bonus.xp)
        if (bonus.coins > 0) addCoins(bonus.coins)
      } else {
        toast.success(`领取成功！获得 ${rewardText}`, {
          icon: <Gift className="text-green-400" />,
          style: { background: 'rgba(0,0,0,0.8)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
        })
      }
    } catch (error) {
      toast.error("领取失败", {
        description: error instanceof Error ? error.message : "未知错误",
        style: { background: 'rgba(0,0,0,0.8)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
      })
    }
  }

  // Simplified Claim All (Sequential for now as backend bulk claim is missing)
  const handleClaimAll = async () => {
    const claimable = missions.filter(m => m.status === "completed")
    if (claimable.length === 0) return

    let claimedCount = 0
    let totalXp = 0
    let totalCoins = 0

    for (const mission of claimable) {
      try {
        const result = await claimMissionReward(mission.id)
        if (result.success) {
           claimedCount++
           totalXp += mission.reward.xpAmount || 0
           totalCoins += mission.reward.coinsAmount || 0
           setMissions(prev => prev.map(m => m.id === mission.id ? { ...m, status: "claimed" } : m))
        }
      } catch (e) {
        console.error(`Failed to claim mission ${mission.id}`, e)
      }
    }

    if (totalXp > 0) addExperience(totalXp)
    if (totalCoins > 0) addCoins(totalCoins)

    if (claimedCount > 0) {
        toast.success(`一键领取成功！共领取 ${claimedCount} 个任务`, {
          icon: <Gift className="text-green-400" />,
          style: { background: 'rgba(0,0,0,0.8)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
        })
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
      {loading ? (
        <div className="py-10 text-center text-white/50">加载中...</div>
      ) : filteredMissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="text-white/50">暂无任务</div>
          <CyberButton 
            variant="secondary" 
            size="sm" 
            onClick={handleDebugInit}
            className="border-white/20 hover:bg-white/10"
          >
            <Sparkles className="mr-2 h-4 w-4 text-cyan-400" />
            手动初始化任务
          </CyberButton>
        </div>
      ) : (
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
      )}
    </div>
  )
}

export default MissionCenter