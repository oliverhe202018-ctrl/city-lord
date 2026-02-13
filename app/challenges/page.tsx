"use client"

import React, { useState, useEffect } from "react"
import { useCity } from "@/contexts/CityContext"
import { fetchUserMissions, claimMissionReward } from "@/app/actions/mission"
import { fetchUserAchievements } from "@/app/actions/achievement"
import type { Challenge, Achievement } from "@/types/city"
import { toast } from "sonner"
import {
  ChallengeCard,
  ChallengeList,
  ChallengeDetailModal,
  ChallengeStartTransition,
  ChallengeCompleteAnimation,
} from "@/components/challenges"
import {
  AchievementGallery,
  AchievementUnlockModal,
  AchievementUnlockBanner,
} from "@/components/achievements"
import { Swords, Trophy, Sparkles } from "lucide-react"
import { useHydration } from "@/hooks/useHydration"

/**
 * 挑战与成就演示页面
 */
export default function ChallengesPage() {
  const { currentCity, isLoading: isCityLoading } = useCity()
  const hydrated = useHydration()
  const [activeTab, setActiveTab] = useState<"challenges" | "achievements">("challenges")
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)
  const [showChallengeStart, setShowChallengeStart] = useState(false)
  const [showChallengeComplete, setShowChallengeComplete] = useState(false)
  const [unlockedAchievement, setUnlockedAchievement] = useState<Achievement | null>(null)
  
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])

  useEffect(() => {
    async function loadData() {
      // Check cache first
      const cachedChallenges = localStorage.getItem('cached_challenges')
      const cachedAchievements = localStorage.getItem('cached_achievements')
      
      if (cachedChallenges) {
        try {
            setChallenges(JSON.parse(cachedChallenges))
        } catch (e) { console.error('Cache parse error', e) }
      }
      
      if (cachedAchievements) {
        try {
            setAchievements(JSON.parse(cachedAchievements))
        } catch (e) { console.error('Cache parse error', e) }
      }

      if (!currentCity) return

      try {
        // Load Missions
        const missionsData = await fetchUserMissions()
        const mappedChallenges: Challenge[] = missionsData.map((m) => ({
          id: m.id,
          cityId: currentCity.id,
          name: m.title,
          description: m.description,
          type: (['conquest', 'defense', 'exploration', 'social', 'daily'].includes(m.type) ? m.type : 'conquest') as any,
          objective: { type: 'tiles', target: m.target, current: m.current }, // Default to 'tiles' if unknown
          rewards: {
            experience: m.reward.reward_experience || 0,
            points: m.reward.reward_coins || 0
          },
          status: (m.status === 'completed' || m.status === 'claimed') ? 'completed' : 'available',
          startDate: new Date().toISOString(), // Default to now
          endDate: new Date(Date.now() + 86400000 * 7).toISOString(), // Default to 7 days later
          progress: { current: m.current || 0, max: m.target || 100 },
          isMainQuest: m.type === 'main',
          isTimeLimited: false,
          priority: 1
        }))
        setChallenges(mappedChallenges)
        localStorage.setItem('cached_challenges', JSON.stringify(mappedChallenges))

        // Load Achievements
        const achievementsData = await fetchUserAchievements()
        const mappedAchievements: Achievement[] = achievementsData.map((a) => ({
          id: a.achievementId,
          cityId: currentCity.id,
          name: a.name,
          description: a.description,
          type: (['milestone', 'collection', 'dominance', 'social', 'special', 'speed', 'conquest', 'exploration', 'endurance'].includes(a.type) ? a.type : 'special') as any,
          tier: (['bronze', 'silver', 'gold', 'platinum', 'diamond'].includes(a.tier) ? a.tier : 'bronze') as any,
          conditions: { type: 'tiles_captured', threshold: a.condition.threshold }, // Simplified mapping
          rewards: {
            badge: a.rewards.badge || "default_badge",
            experience: a.rewards.experience || 0,
            points: a.rewards.points || 0,
            title: undefined
          },
          isCompleted: a.isCompleted,
          completedAt: a.completedAt || undefined,
          progress: { current: a.progress, max: a.condition.threshold }
        }))
        setAchievements(mappedAchievements)
        localStorage.setItem('cached_achievements', JSON.stringify(mappedAchievements))
      } catch (error: any) {
        if (error?.name !== 'AbortError' && error?.digest !== 'NEXT_REDIRECT') {
          console.error("Failed to load challenges/achievements:", error)
        }
      }
    }
    loadData()
  }, [currentCity])

  // 等待 hydration 和城市加载完成
  if (!hydrated || isCityLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white/60">加载中...</div>
      </div>
    )
  }

  const handleStartChallenge = () => {
    setShowChallengeStart(true)
  }

  const handleChallengeComplete = () => {
    setShowChallengeComplete(true)
  }

  const handleUnlockAchievement = () => {
    // 模拟解锁一个成就
    const randomAchievement = achievements[Math.floor(Math.random() * achievements.length)]
    setUnlockedAchievement(randomAchievement)
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* 头部 */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/95 backdrop-blur-xl px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{currentCity?.name || "城市"} - 挑战与成就</h1>
              <p className="text-sm text-white/60">完成挑战，解锁成就</p>
            </div>
            <button
              onClick={handleUnlockAchievement}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/10 border border-purple-500/30 hover:from-purple-500/30 hover:to-pink-500/20 transition-all"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white">模拟解锁</span>
            </button>
          </div>

          {/* 标签切换 */}
          <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
            <button
              onClick={() => setActiveTab("challenges")}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === "challenges"
                  ? "text-white bg-gradient-to-r from-white/10 to-white/5"
                  : "text-white/60 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <Swords className="w-4 h-4" />
              挑战任务
            </button>
            <button
              onClick={() => setActiveTab("achievements")}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === "achievements"
                  ? "text-white bg-gradient-to-r from-white/10 to-white/5"
                  : "text-white/60 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <Trophy className="w-4 h-4" />
              成就系统
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-4xl mx-auto p-4">
        {activeTab === "challenges" ? (
          <div className="space-y-6">
            {/* 主线任务 */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-yellow-400">⚡</span> 主线任务
              </h2>
              <ChallengeList
                challenges={challenges.filter((c) => c.isMainQuest)}
                onSelect={setSelectedChallenge}
              />
            </div>

            {/* 日常任务 */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>📅</span> 日常任务
              </h2>
              <ChallengeList
                challenges={challenges.filter((c) => c.type === "daily")}
                onSelect={setSelectedChallenge}
              />
            </div>

            {/* 其他任务 */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>🎯</span> 其他任务
              </h2>
              <ChallengeList
                challenges={challenges.filter(
                  (c) => !c.isMainQuest && c.type !== "daily"
                )}
                onSelect={setSelectedChallenge}
              />
            </div>
          </div>
        ) : (
          <AchievementGallery achievements={achievements} onUnlock={handleUnlockAchievement} />
        )}
      </div>

      {/* 挑战详情弹窗 */}
      {selectedChallenge && (
        <ChallengeDetailModal
          challenge={selectedChallenge}
          isOpen={!!selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
          onStart={handleStartChallenge}
        />
      )}

      {/* 挑战开始动画 */}
      <ChallengeStartTransition
        challenge={{
          name: selectedChallenge?.name || "挑战",
          type: selectedChallenge?.type || "conquest",
          description: selectedChallenge?.description || "",
        }}
        isActive={showChallengeStart}
        onComplete={() => setShowChallengeStart(false)}
      />

      {/* 挑战完成动画 */}
      <ChallengeCompleteAnimation
        challenge={{
          name: selectedChallenge?.name || "挑战",
          type: selectedChallenge?.type || "conquest",
          rewards: selectedChallenge?.rewards || { experience: 500, points: 1000 },
        }}
        isActive={showChallengeComplete}
        onComplete={() => setShowChallengeComplete(false)}
      />

      {/* 成就解锁弹窗 */}
      {unlockedAchievement && (
        <AchievementUnlockModal
          achievement={unlockedAchievement}
          isOpen={!!unlockedAchievement}
          onClose={() => setUnlockedAchievement(null as any)}
          onClaim={() => setUnlockedAchievement(null as any)}
        />
      )}

      {/* 演示提示 */}
      <div className="fixed bottom-4 left-4 right-4 z-50 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-blue-400 mb-1">演示模式</p>
            <p className="text-xs text-white/60 leading-relaxed">
              点击&quot;模拟解锁&quot;按钮可以随机解锁一个成就。点击挑战卡片可以查看详情并开始挑战。
            </p>
          </div>
          <button
            onClick={() => setShowChallengeComplete(true)}
            className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-all"
          >
            完成挑战
          </button>
        </div>
      </div>
    </div>
  )
}
