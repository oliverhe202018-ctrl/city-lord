"use client"

import { useState, useEffect } from "react"
import {
  Trophy,
  Star,
  Lock,
  ChevronLeft,
  ChevronRight,
  Zap,
  CheckCircle2,
  Sparkles,
  X,
} from "lucide-react"
import {
  type CityAchievement,
  type Language,
  getCityTheme,
  getCityAchievements,
  getLocalizedText,
  getRarityColor,
  getRarityBgColor,
} from "@/lib/citylord/city-config"

// ============================================================
// Achievement Card
// ============================================================

interface AchievementCardProps {
  achievement: CityAchievement
  language?: Language
  progress?: number
  status?: "locked" | "available" | "unlocked"
  onClick?: () => void
}

export function CityAchievementCard({
  achievement,
  language = "zh",
  progress = 0,
  status = "locked",
  onClick,
}: AchievementCardProps) {
  const theme = getCityTheme(achievement.cityId)
  const progressPercent = Math.min((progress / achievement.requirements.target) * 100, 100)
  const isUnlocked = status === "unlocked"
  const isAvailable = status === "available"
  const isLocked = status === "locked"

  const rarityLabels = {
    common: { zh: "普通", en: "Common" },
    rare: { zh: "稀有", en: "Rare" },
    epic: { zh: "史诗", en: "Epic" },
    legendary: { zh: "传奇", en: "Legendary" },
  }

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        isUnlocked
          ? "border-yellow-400/30 bg-yellow-400/10"
          : isAvailable
            ? "border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10"
            : "border-white/5 bg-white/5 opacity-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl ${
            isUnlocked
              ? "bg-yellow-400/20"
              : isAvailable
                ? getRarityBgColor(achievement.rarity)
                : "bg-white/10"
          }`}
          style={
            isUnlocked && theme
              ? { boxShadow: `0 0 20px ${theme.primaryColor}40` }
              : {}
          }
        >
          {isLocked ? (
            <Lock className="h-6 w-6 text-white/30" />
          ) : (
            achievement.icon
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Rarity Badge */}
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getRarityBgColor(achievement.rarity)} ${getRarityColor(achievement.rarity)}`}
            >
              {rarityLabels[achievement.rarity][language]}
            </span>
            {isUnlocked && (
              <span className="flex items-center gap-1 rounded-full bg-[#22c55e]/20 px-2 py-0.5 text-[10px] font-medium text-[#22c55e]">
                <CheckCircle2 className="h-3 w-3" />
                {language === "zh" ? "已达成" : "Unlocked"}
              </span>
            )}
          </div>

          <h3 className="truncate font-bold text-white">
            {getLocalizedText(achievement.title, language)}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-white/60">
            {getLocalizedText(achievement.description, language)}
          </p>

          {/* Progress */}
          {!isUnlocked && !isLocked && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-white/50">
                  {language === "zh" ? "进度" : "Progress"}
                </span>
                <span className="text-cyan-400">
                  {progress}/{achievement.requirements.target}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Rewards Preview */}
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-cyan-400">
              <Zap className="h-3 w-3" />
              {achievement.rewards.xp} XP
            </span>
            <span className="flex items-center gap-1 text-yellow-400">
              🪙 {achievement.rewards.coins}
            </span>
            {achievement.rewards.title && (
              <span className="flex items-center gap-1 text-orange-400">
                👑 {language === "zh" ? "称号" : "Title"}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-5 w-5 shrink-0 text-white/30" />
      </div>
    </button>
  )
}

// ============================================================
// City Achievement Page
// ============================================================

interface CityAchievementsPageProps {
  cityId: string
  language?: Language
  achievements?: {
    id: string
    progress: number
    status: "locked" | "available" | "unlocked"
  }[]
  onClose?: () => void
  onAchievementClick?: (achievement: CityAchievement) => void
}

export function CityAchievementsPage({
  cityId,
  language = "zh",
  achievements: userAchievements = [],
  onClose,
  onAchievementClick,
}: CityAchievementsPageProps) {
  const theme = getCityTheme(cityId)
  const cityAchievements = getCityAchievements(cityId)
  const [filter, setFilter] = useState<"all" | "available" | "unlocked">("all")

  if (!theme) return null

  const getAchievementStatus = (id: string) => {
    const userAch = userAchievements.find((a) => a.id === id)
    return userAch?.status || "locked"
  }

  const getAchievementProgress = (id: string) => {
    const userAch = userAchievements.find((a) => a.id === id)
    return userAch?.progress || 0
  }

  const filteredAchievements = cityAchievements.filter((ach) => {
    const status = getAchievementStatus(ach.id)
    if (filter === "all") return true
    return status === filter
  })

  const unlockedCount = userAchievements.filter((a) => a.status === "unlocked").length
  const totalCount = cityAchievements.length

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0f1a]">
      {/* Header */}
      <div
        className="relative overflow-hidden pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]"
        style={{
          background: `linear-gradient(135deg, ${theme.gradientFrom}80, ${theme.gradientTo}80)`,
        }}
      >
        <div className="absolute inset-0 bg-black/20" />

        {/* Back Button */}
        <button
          onClick={onClose}
          className="absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="relative px-4 pt-12 text-center">
          <span className="mb-2 block text-4xl">{theme.icon}</span>
          <h1 className="text-2xl font-bold text-white">
            {getLocalizedText(theme.name, language)} {language === "zh" ? "成就" : "Achievements"}
          </h1>
          <p className="mt-2 text-white/70">
            {unlockedCount}/{totalCount} {language === "zh" ? "已解锁" : "Unlocked"}
          </p>

          {/* Progress Bar */}
          <div className="mx-auto mt-4 max-w-xs">
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="relative mt-4 flex justify-center gap-2 px-4">
          {(["all", "available", "unlocked"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                filter === f
                  ? "bg-white text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {f === "all" && (language === "zh" ? "全部" : "All")}
              {f === "available" && (language === "zh" ? "可达成" : "Available")}
              {f === "unlocked" && (language === "zh" ? "已达成" : "Unlocked")}
            </button>
          ))}
        </div>
      </div>

      {/* Achievement List */}
      <div className="space-y-3 px-4 py-6">
        {filteredAchievements.map((achievement) => (
          <CityAchievementCard
            key={achievement.id}
            achievement={achievement}
            language={language}
            progress={getAchievementProgress(achievement.id)}
            status={getAchievementStatus(achievement.id)}
            onClick={() => onAchievementClick?.(achievement)}
          />
        ))}

        {filteredAchievements.length === 0 && (
          <div className="py-12 text-center">
            <Star className="mx-auto mb-4 h-12 w-12 text-white/20" />
            <p className="text-white/50">
              {language === "zh" ? "没有找到成就" : "No achievements found"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Achievement Unlock Popup
// ============================================================

interface AchievementUnlockPopupProps {
  isOpen: boolean
  onClose: () => void
  achievement: CityAchievement
  language?: Language
  onClaim?: () => void
}

export function AchievementUnlockPopup({
  isOpen,
  onClose,
  achievement,
  language = "zh",
  onClaim,
}: AchievementUnlockPopupProps) {
  const theme = getCityTheme(achievement.cityId)
  const [showParticles, setShowParticles] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShowParticles(true)
      const timer = setTimeout(() => setShowParticles(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen || !theme) return null

  const rarityLabels = {
    common: { zh: "普通", en: "Common" },
    rare: { zh: "稀有", en: "Rare" },
    epic: { zh: "史诗", en: "Epic" },
    legendary: { zh: "传奇", en: "Legendary" },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Particles Effect */}
      {showParticles && (
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random()}s`,
              }}
            >
              <Sparkles
                className="h-4 w-4"
                style={{ color: theme.primaryColor }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Popup */}
      <div className="relative w-full max-w-sm animate-scale-in overflow-hidden rounded-3xl bg-[#0f172a]">
        {/* Glow Effect */}
        <div
          className="absolute -inset-4 opacity-50 blur-3xl"
          style={{
            background: `radial-gradient(circle, ${theme.primaryColor}40, transparent)`,
          }}
        />

        {/* Content */}
        <div className="relative">
          {/* Header */}
          <div
            className="p-8 text-center"
            style={{
              background: `linear-gradient(135deg, ${theme.gradientFrom}40, ${theme.gradientTo}40)`,
            }}
          >
            <div className="mb-4">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${getRarityBgColor(achievement.rarity)} ${getRarityColor(achievement.rarity)}`}
              >
                {rarityLabels[achievement.rarity][language]}
              </span>
            </div>
            <div
              className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl text-5xl"
              style={{
                backgroundColor: `${theme.primaryColor}20`,
                boxShadow: `0 0 40px ${theme.primaryColor}60`,
              }}
            >
              {achievement.icon}
            </div>
            <h2 className="text-2xl font-bold text-white">
              {language === "zh" ? "成就解锁！" : "Achievement Unlocked!"}
            </h2>
            <p className="mt-2 text-lg font-medium" style={{ color: theme.primaryColor }}>
              {getLocalizedText(achievement.title, language)}
            </p>
            <p className="mt-1 text-sm text-white/60">
              {getLocalizedText(achievement.description, language)}
            </p>
          </div>

          {/* Rewards */}
          <div className="p-6">
            <h3 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-white/40">
              {language === "zh" ? "获得奖励" : "Rewards"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-cyan-400/10 p-4 text-center">
                <Zap className="mx-auto mb-2 h-8 w-8 text-cyan-400" />
                <p className="text-2xl font-bold text-white">{achievement.rewards.xp}</p>
                <p className="text-xs text-white/50">XP</p>
              </div>
              <div className="rounded-xl bg-yellow-400/10 p-4 text-center">
                <span className="mb-2 block text-3xl">🪙</span>
                <p className="text-2xl font-bold text-white">{achievement.rewards.coins}</p>
                <p className="text-xs text-white/50">{language === "zh" ? "金币" : "Coins"}</p>
              </div>
            </div>

            {achievement.rewards.title && (
              <div className="mt-3 rounded-xl bg-orange-400/10 p-4 text-center">
                <span className="mb-2 block text-3xl">👑</span>
                <p className="font-bold text-white">
                  {getLocalizedText(achievement.rewards.title, language)}
                </p>
                <p className="text-xs text-white/50">
                  {language === "zh" ? "专属称号" : "Exclusive Title"}
                </p>
              </div>
            )}

            <button
              onClick={onClaim || onClose}
              className="mt-6 w-full rounded-2xl py-4 text-center font-bold text-white transition-all hover:opacity-90"
              style={{
                background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
              }}
            >
              {language === "zh" ? "领取奖励" : "Claim Rewards"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
