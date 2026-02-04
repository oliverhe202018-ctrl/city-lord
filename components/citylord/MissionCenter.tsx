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
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"
import useSWR from 'swr'
import { useMutation, useQueryClient } from "@tanstack/react-query"

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
  type: MissionType | string
  frequency?: string
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

export function MissionCenter({ initialData }: { initialData?: any[] }) {
  const [activeFilter, setActiveFilter] = useState<"daily" | "weekly" | "all">("all")
  const { addExperience, addCoins, userId } = useGameStore()
  const isHydrated = useHydration()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Use SWR for fetching missions
  const { data: rawMissions, isLoading: loading } = useSWR(
    userId ? ['userMissions', userId] : null,
    () => fetchUserMissions(),
    {
      fallbackData: initialData,
      revalidateOnFocus: true,
      refreshInterval: 0 // Missions don't change that often unless user acts
    }
  )

  // Format missions data
  const missions = React.useMemo(() => {
    if (!rawMissions) return []
    
    return rawMissions.map((m: any) => {
      const hasXp = m.reward.reward_experience > 0
      const hasCoins = m.reward.reward_coins > 0
      
      let rewardType: "xp" | "coins" | "both" = "xp"
      let rewardLabel = "经验"
      let rewardAmount = m.reward.reward_experience

      if (hasXp && hasCoins) {
        rewardType = "both"
        rewardLabel = "奖励"
        rewardAmount = 0 
      } else if (hasCoins) {
        rewardType = "coins"
        rewardLabel = "金币"
        rewardAmount = m.reward.reward_coins
      }

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        type: m.type,
        frequency: m.frequency,
        status: m.status as MissionStatus,
        progress: m.current,
        maxProgress: m.target,
        reward: {
          type: rewardType,
          xpAmount: m.reward.reward_experience,
          coinsAmount: m.reward.reward_coins,
          label: rewardLabel
        },
        difficulty: "medium",
        icon: m.type === 'DISTANCE' ? Footprints :
              m.type === 'HEX_COUNT' ? Hexagon :
              m.type === 'RUN_COUNT' ? Trophy : Target
      } as MissionData
    })
  }, [rawMissions])

  const claimMutation = useMutation({
    mutationFn: async ({ id, reward }: { id: string, reward: MissionReward }) => {
      return await claimMissionReward(id)
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        const { reward } = variables
        
        // Optimistic Update or Invalidate
        queryClient.invalidateQueries({ queryKey: ['userMissions', userId] })

        // Show toast
        if (result.data?.bonus) {
             const bonus = result.data.bonus
             toast.success(
               <div className="flex flex-col gap-1">
                 <span className="font-bold">领取成功！</span>
                 <span className="text-sm opacity-90">获得 +{result.data.new_experience - (result.data.reward_experience || 0)} 经验, +{result.data.new_coins - (result.data.reward_coins || 0)} 金币</span>
                 <span className="text-xs text-yellow-300 font-bold bg-yellow-500/20 px-2 py-1 rounded w-fit">
                   阵营加成 +{bonus.percentage}%
                 </span>
               </div>
             )
        } else {
             toast.success("任务完成！", {
               description: `获得 ${reward.label}`
             })
        }

        // Update local store
        if (reward.xpAmount) addExperience(reward.xpAmount)
        if (reward.coinsAmount) addCoins(reward.coinsAmount)
      } else {
        toast.error("领取失败", { description: result.error })
      }
    },
    onError: () => {
      toast.error("领取失败", { description: "网络错误，请稍后重试" })
    }
  })

  const handleClaimReward = (id: string, reward: MissionReward) => {
    claimMutation.mutate({ id, reward })
  }

  // Simplified Claim All
  const handleClaimAll = async () => {
    const claimable = missions.filter(m => m.status === "completed")
    if (claimable.length === 0) return

    for (const mission of claimable) {
       handleClaimReward(mission.id, mission.reward)
    }
  }

  const filteredMissions = missions.filter(m => {
    if (activeFilter === "all") return true
    
    // Prefer using frequency field if available
    if (m.frequency) {
        if (activeFilter === "daily") return m.frequency === "daily"
        if (activeFilter === "weekly") return m.frequency === "weekly"
    }

    // Fallback for legacy/missing frequency
    if (activeFilter === "daily") return m.type === "daily" || (m.type as any) === "RUN_COUNT" || (m.type as any) === "DISTANCE"
    if (activeFilter === "weekly") return m.type === "weekly"
    return true
  })

  if (!isHydrated) return null

  // Check login state via userId from store
  if (!userId) {
     return (
        <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
          <p className="text-white/60">请先登录以查看任务</p>
          <Button asChild className="bg-[#39ff14] text-black hover:bg-[#39ff14]/90">
             <Link href="/login"><LogIn className="mr-2 h-4 w-4" /> 去登录</Link>
          </Button>
        </div>
     )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#39ff14] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0f172a] px-4 pb-24 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">任务中心</h1>
          <p className="text-sm text-white/60">完成挑战获取奖励</p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2">
          {/* Claim All Button */}
          {missions.some(m => m.status === "completed") && (
            <CyberButton 
              size="sm" 
              onClick={handleClaimAll}
              className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-yellow-500/50"
            >
              <Gift className="w-4 h-4 mr-1" />
              一键领取
            </CyberButton>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {(["all", "daily", "weekly"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all whitespace-nowrap ${
              activeFilter === filter
                ? "bg-[#39ff14] text-black shadow-[0_0_10px_rgba(57,255,20,0.4)]"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {filter === "all" ? "全部" : filter === "daily" ? "每日任务" : "每周挑战"}
          </button>
        ))}
      </div>

      {/* Mission List */}
      <div className="space-y-4">
        {filteredMissions.length > 0 ? (
          filteredMissions.map((mission) => (
            <MissionCard
              key={mission.id}
              {...mission}
              onClaim={handleClaimReward}
              onClick={() => {
                if (mission.status === "completed") {
                  handleClaimReward(mission.id, mission.reward)
                } else if (mission.status !== "claimed") {
                  router.push('/')
                  toast.info("前往地图完成任务")
                }
              }}
            />
          ))
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-white/5 p-4">
              <Trophy className="h-8 w-8 text-white/20" />
            </div>
            <p className="text-white/40">暂无任务</p>
          </div>
        )}
      </div>
    </div>
  )
}
