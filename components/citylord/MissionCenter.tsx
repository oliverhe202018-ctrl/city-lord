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
import { useMissions, MissionWithStatus } from "@/hooks/useMissions"

// --- Types ---

type MissionType = "daily" | "weekly" | "achievement" | "one_time" | "once" | "infinite"
type MissionStatus = "locked" | "active" | "completed" | "claimed" | "todo" | "ongoing" | "in-progress" | "pending"
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
  isCompleted: boolean
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
    <div 
      className={`relative w-full overflow-hidden rounded-2xl border p-4 transition-all active:scale-[0.99] ${
        isCompleted 
          ? "border-primary/30 bg-primary/5" 
          : "border-border bg-card/60"
      }`}
      onClick={() => onClick?.(id)}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
          isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          <Icon className="h-6 w-6" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className={`font-bold truncate ${isCompleted ? "text-primary" : "text-foreground"}`}>
              {title}
            </h3>
            {timeRemaining && !isCompleted && (
              <span className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                <Clock className="h-3 w-3" />
                {timeRemaining}
              </span>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {description}
          </p>

          {/* Progress Bar */}
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
                isCompleted ? "bg-primary" : "bg-primary/80"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{progress} / {maxProgress}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
        </div>
      </div>

      {/* Bottom Action / Reward */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-md ${difficultyConfig[difficulty].bg} ${difficultyConfig[difficulty].color}`}>
            {difficultyConfig[difficulty].label}
          </span>
          <span className="flex items-center gap-1 text-xs font-medium text-yellow-500">
            <Zap className="h-3 w-3" />
            {reward.label}
          </span>
        </div>

        {canClaim ? (
          <button
            onClick={handleClaim}
            disabled={isClaiming}
            className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isClaiming ? "领取中..." : "领取奖励"}
          </button>
        ) : isCompleted ? (
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" />
            已完成
          </span>
        ) : (
          <div className="h-6" /> // Spacer
        )}
      </div>
    </div>
  )
}

// --- Mission Center Page Component ---

export function MissionCenter({ initialData }: { initialData?: any[] }) {
  const [activeFilter, setActiveFilter] = useState<"daily" | "weekly" | "all">("all")
  const { addExperience, addCoins, userId } = useGameStore()
  const isHydrated = useHydration()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Use standardized hook
  const { missions: rawMissions, loading, refresh } = useMissions()
  
  // Coalesce
  const currentRawMissions = rawMissions || []
  const isLoading = loading && rawMissions.length === 0

  // Format missions data
  const missions = React.useMemo(() => {
    if (!currentRawMissions) return []
    
    return currentRawMissions.map((m: any) => {
      const hasXp = false // m.reward_experience > 0 (TODO: check if these fields exist in config)
      const hasCoins = m.points_reward > 0
      
      let rewardType: "xp" | "coins" | "both" = "coins"
      let rewardLabel = "积分"
      let rewardAmount = m.points_reward

      // TODO: If we add XP back to mission_configs, uncomment this
      /*
      if (hasXp && hasCoins) {
        rewardType = "both"
        rewardLabel = "奖励"
        rewardAmount = 0 
      } else if (hasXp) {
        rewardType = "xp"
        rewardLabel = "经验"
        rewardAmount = m.reward_experience
      }
      */

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        type: m.frequency, // Use frequency as type for now or map it
        frequency: m.frequency,
        status: m.status as MissionStatus,
        progress: m.progress?.progress || 0, // Use progress from joined user_mission
        maxProgress: 1, // Default to 1 if no target in config (TODO: add target to config?)
        reward: {
          type: rewardType,
          xpAmount: 0, // m.reward_experience
          coinsAmount: m.points_reward,
          label: rewardLabel
        },
        difficulty: "medium",
        icon: m.frequency === 'daily' ? Footprints : Trophy,
        isCompleted: m.isCompleted
      } as MissionData
    })
  }, [currentRawMissions])

  const claimMutation = useMutation({
    mutationFn: async ({ id, reward }: { id: string, reward: MissionReward }) => {
      // Use the actual server action
      const result = await claimMissionReward(id)
      if (!result.success) throw new Error(result.error)
      return { success: true, data: result.data }
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        const { reward } = variables
        
        // Revalidate SWR
        refresh()

        // Show toast
        const data = result.data as any
        
        if (data?.bonus) {
             const bonus = data.bonus
             toast.success(
               <div className="flex flex-col gap-1">
                 <span className="font-bold">领取成功！</span>
                 <span className="text-sm opacity-90">获得 +{reward.coinsAmount} 积分</span>
                 <span className="text-xs text-yellow-300 font-bold bg-yellow-500/20 px-2 py-1 rounded w-fit">
                   阵营加成 +{bonus.percentage}%
                 </span>
               </div>
             )
        } else {
             toast.success("领取成功！", {
               description: `获得 +${reward.coinsAmount} 积分`
             })
        }

        // Update local store
        if (reward.xpAmount) addExperience(reward.xpAmount)
        if (reward.coinsAmount) addCoins(reward.coinsAmount)
      } else {
        toast.error("领取失败")
      }
    },
    onError: (error: any) => {
      toast.error("领取失败", { description: error.message || "网络错误，请稍后重试" })
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

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#39ff14] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-background px-4 pb-24 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">任务中心</h1>
          <p className="text-sm text-muted-foreground">完成挑战获取奖励</p>
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
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
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
                  // Instead of redirecting to home, close the drawer/modal if possible or just toast
                  // If this is a page, maybe we want to go to map?
                  // But user complaint is "forced redirect to /".
                  // If we are in a modal/drawer over the map, closing it is better.
                  // Assuming MissionCenter is used in a tab/drawer context:
                  toast.info("请关闭任务面板，在地图上完成任务", {
                      description: "点击底部导航栏返回地图"
                  })
                }
              }}
            />
          ))
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Trophy className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground">今日任务已刷新，敬请期待</p>
          </div>
        )}
      </div>
    </div>
  )
}
