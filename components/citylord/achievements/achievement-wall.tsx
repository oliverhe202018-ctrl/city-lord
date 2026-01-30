"use client"

import React from "react"

import { useState } from "react"
import {
  Trophy,
  Star,
  Lock,
  Crown,
  Zap,
  Footprints,
  Hexagon,
  Swords,
  MapPin,
  Flame,
  Target,
  Users,
  Medal,
  Gift,
} from "lucide-react"
import { formatArea, getAreaEquivalent, hexCountToArea } from "@/lib/citylord/area-utils"

type AchievementCategory = "all" | "running" | "territory" | "social" | "special"
type AchievementRarity = "common" | "rare" | "epic" | "legendary"

interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ElementType
  category: AchievementCategory
  rarity: AchievementRarity
  progress: number
  maxProgress: number
  unlocked: boolean
  unlockedAt?: string
  rewards: {
    xp?: number
    coins?: number
    title?: string
    badge?: string
  }
}

const rarityConfig: Record<
  AchievementRarity,
  { color: string; bg: string; border: string; label: string }
> = {
  common: {
    color: "text-gray-400",
    bg: "bg-gray-400/20",
    border: "border-gray-400/30",
    label: "普通",
  },
  rare: {
    color: "text-blue-400",
    bg: "bg-blue-400/20",
    border: "border-blue-400/30",
    label: "稀有",
  },
  epic: {
    color: "text-purple-400",
    bg: "bg-purple-400/20",
    border: "border-purple-400/30",
    label: "史诗",
  },
  legendary: {
    color: "text-yellow-400",
    bg: "bg-yellow-400/20",
    border: "border-yellow-400/30",
    label: "传奇",
  },
}

const sampleAchievements: Achievement[] = [
  {
    id: "1",
    title: "初出茅庐",
    description: "完成你的第一次跑步",
    icon: Footprints,
    category: "running",
    rarity: "common",
    progress: 1,
    maxProgress: 1,
    unlocked: true,
    unlockedAt: "2025-01-15",
    rewards: { xp: 50, coins: 20 },
  },
  {
    id: "2",
    title: "马拉松英雄",
    description: "累计跑步距离达到42.195公里",
    icon: Medal,
    category: "running",
    rarity: "epic",
    progress: 35,
    maxProgress: 42,
    unlocked: false,
    rewards: { xp: 500, coins: 200, badge: "马拉松徽章" },
  },
  {
    id: "3",
    title: "领地先锋",
    description: "占领超过 2,600 m² 的领地",
    icon: Hexagon,
    category: "territory",
    rarity: "common",
    progress: 2600,
    maxProgress: 2600,
    unlocked: true,
    unlockedAt: "2025-01-18",
    rewards: { xp: 100, coins: 50 },
  },
  {
    id: "4",
    title: "城市霸主",
    description: "同时拥有超过 130,000 m² (0.13 km²) 的领地",
    icon: Crown,
    category: "territory",
    rarity: "legendary",
    progress: 40560,
    maxProgress: 130000,
    unlocked: false,
    rewards: { xp: 2000, coins: 1000, title: "城市霸主", badge: "王冠徽章" },
  },
  {
    id: "5",
    title: "战斗大师",
    description: "赢得100场领地争夺战",
    icon: Swords,
    category: "territory",
    rarity: "rare",
    progress: 52,
    maxProgress: 100,
    unlocked: false,
    rewards: { xp: 300, coins: 150 },
  },
  {
    id: "6",
    title: "社交达人",
    description: "添加20个好友",
    icon: Users,
    category: "social",
    rarity: "rare",
    progress: 12,
    maxProgress: 20,
    unlocked: false,
    rewards: { xp: 200, coins: 100 },
  },
  {
    id: "7",
    title: "连续7天",
    description: "连续7天完成跑步",
    icon: Flame,
    category: "running",
    rarity: "rare",
    progress: 4,
    maxProgress: 7,
    unlocked: false,
    rewards: { xp: 250, badge: "火焰徽章" },
  },
  {
    id: "8",
    title: "探险家",
    description: "探索50%的地图迷雾",
    icon: MapPin,
    category: "territory",
    rarity: "epic",
    progress: 34,
    maxProgress: 50,
    unlocked: false,
    rewards: { xp: 400, coins: 200, title: "探险家" },
  },
  {
    id: "9",
    title: "挑战之王",
    description: "完成50次好友挑战",
    icon: Target,
    category: "social",
    rarity: "epic",
    progress: 23,
    maxProgress: 50,
    unlocked: false,
    rewards: { xp: 500, coins: 250, badge: "挑战者徽章" },
  },
  {
    id: "10",
    title: "创世先驱",
    description: "成为前1000名注册用户",
    icon: Star,
    category: "special",
    rarity: "legendary",
    progress: 1,
    maxProgress: 1,
    unlocked: true,
    unlockedAt: "2025-01-01",
    rewards: { xp: 1000, coins: 500, title: "创世先驱", badge: "创世徽章" },
  },
]

interface AchievementCardProps {
  achievement: Achievement
  onSelect?: (achievement: Achievement) => void
}

function AchievementCard({ achievement, onSelect }: AchievementCardProps) {
  const config = rarityConfig[achievement.rarity]
  const Icon = achievement.icon
  const progressPercent = (achievement.progress / achievement.maxProgress) * 100

  return (
    <button
      onClick={() => onSelect?.(achievement)}
      className={`relative w-full overflow-hidden rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
        achievement.unlocked
          ? `${config.border} bg-gradient-to-br from-black/60 to-black/40`
          : "border-white/10 bg-black/40"
      }`}
    >
      {/* Unlock glow effect */}
      {achievement.unlocked && (
        <div className={`absolute inset-0 opacity-20 ${config.bg}`} />
      )}

      <div className="relative p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${
              achievement.unlocked ? config.bg : "bg-white/5"
            }`}
          >
            <Icon
              className={`h-7 w-7 ${
                achievement.unlocked ? config.color : "text-white/30"
              }`}
            />
            {!achievement.unlocked && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
                <Lock className="h-5 w-5 text-white/40" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`font-semibold truncate ${
                  achievement.unlocked ? "text-white" : "text-white/60"
                }`}
              >
                {achievement.title}
              </h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${config.bg} ${config.color}`}
              >
                {config.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-white/50 line-clamp-1">
              {achievement.description}
            </p>

            {/* Progress */}
            {!achievement.unlocked && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white/40">
                    {achievement.progress} / {achievement.maxProgress}
                  </span>
                  <span className={config.color}>{Math.round(progressPercent)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${
                      achievement.rarity === "legendary"
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                        : achievement.rarity === "epic"
                          ? "bg-gradient-to-r from-purple-500 to-pink-500"
                          : achievement.rarity === "rare"
                            ? "bg-gradient-to-r from-blue-500 to-cyan-500"
                            : "bg-gray-400"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Unlocked date */}
            {achievement.unlocked && achievement.unlockedAt && (
              <p className="mt-1 text-[10px] text-white/30">
                解锁于 {achievement.unlockedAt}
              </p>
            )}
          </div>
        </div>

        {/* Rewards preview */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {achievement.rewards.xp && (
            <span className="flex items-center gap-1 rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-400">
              <Zap className="h-3 w-3" />
              {achievement.rewards.xp} XP
            </span>
          )}
          {achievement.rewards.coins && (
            <span className="flex items-center gap-1 rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] text-yellow-400">
              <Star className="h-3 w-3" />
              {achievement.rewards.coins}
            </span>
          )}
          {achievement.rewards.badge && (
            <span className="flex items-center gap-1 rounded-full bg-purple-400/10 px-2 py-0.5 text-[10px] text-purple-400">
              <Gift className="h-3 w-3" />
              徽章
            </span>
          )}
          {achievement.rewards.title && (
            <span className="flex items-center gap-1 rounded-full bg-orange-400/10 px-2 py-0.5 text-[10px] text-orange-400">
              <Crown className="h-3 w-3" />
              称号
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

interface AchievementWallProps {
  achievements?: Achievement[]
  onSelectAchievement?: (achievement: Achievement) => void
}

export function AchievementWall({
  achievements = sampleAchievements,
  onSelectAchievement,
}: AchievementWallProps) {
  const [activeCategory, setActiveCategory] = useState<AchievementCategory>("all")
  const [showUnlocked, setShowUnlocked] = useState<boolean | null>(null)

  const categories = [
    { id: "all" as const, label: "全部", icon: Trophy },
    { id: "running" as const, label: "跑步", icon: Footprints },
    { id: "territory" as const, label: "领地", icon: Hexagon },
    { id: "social" as const, label: "社交", icon: Users },
    { id: "special" as const, label: "特殊", icon: Star },
  ]

  const filteredAchievements = achievements.filter((a) => {
    const matchesCategory = activeCategory === "all" || a.category === activeCategory
    const matchesUnlocked =
      showUnlocked === null || a.unlocked === showUnlocked
    return matchesCategory && matchesUnlocked
  })

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const totalCount = achievements.length
  
  // Calculate total territory area from territory achievements
  const totalTerritoryArea = 100620 // Example: user's total territory area in m²
  const formattedTerritoryArea = formatArea(totalTerritoryArea)
  const territoryEquivalent = getAreaEquivalent(totalTerritoryArea)

  return (
    <div className="flex flex-col">
      {/* Header Stats */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/60">成就进度</p>
            <p className="text-2xl font-bold text-white">
              {unlockedCount} <span className="text-white/40">/ {totalCount}</span>
            </p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-yellow-500/30 bg-yellow-500/10">
            <Trophy className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
<div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
  <div
  className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-500"
  style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
  />
  </div>
  {territoryEquivalent && (
  <p className="mt-3 text-center text-xs text-cyan-400">
  已占领 {formattedTerritoryArea.fullText}，{territoryEquivalent}
  </p>
  )}
  </div>

      {/* Category Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white/5 p-1">
        {categories.map((cat) => {
          const Icon = cat.icon
          const isActive = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#22c55e] text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2">
        {[
          { value: null, label: "全部" },
          { value: true, label: "已解锁" },
          { value: false, label: "未解锁" },
        ].map((filter) => (
          <button
            key={String(filter.value)}
            onClick={() => setShowUnlocked(filter.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              showUnlocked === filter.value
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/50 hover:text-white"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Achievement Grid */}
      <div className="grid gap-3">
        {filteredAchievements.map((achievement) => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            onSelect={onSelectAchievement}
          />
        ))}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="mb-3 h-12 w-12 text-white/20" />
          <p className="text-white/60">暂无成就</p>
          <p className="mt-1 text-sm text-white/40">继续努力解锁更多成就吧</p>
        </div>
      )}
    </div>
  )
}
