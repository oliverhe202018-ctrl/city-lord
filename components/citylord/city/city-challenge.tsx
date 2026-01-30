"use client"

import { useState, useEffect } from "react"
import {
  Trophy,
  Target,
  Clock,
  ChevronRight,
  ChevronLeft,
  X,
  Zap,
  Star,
  CheckCircle2,
  Play,
  Pause,
  MapPin,
} from "lucide-react"
import {
  type CityChallenge,
  type Language,
  getCityTheme,
  getLocalizedText,
  getDifficultyColor,
  getDifficultyBgColor,
} from "@/lib/citylord/city-config"

// ============================================================
// Challenge Card Component
// ============================================================

interface ChallengeCardProps {
  challenge: CityChallenge
  language?: Language
  progress?: number
  status?: "locked" | "available" | "active" | "completed"
  onClick?: () => void
}

export function ChallengeCard({
  challenge,
  language = "zh",
  progress = 0,
  status = "available",
  onClick,
}: ChallengeCardProps) {
  const theme = getCityTheme(challenge.cityId)
  const progressPercent = Math.min((progress / challenge.goals[0].target) * 100, 100)
  const isCompleted = status === "completed"
  const isLocked = status === "locked"
  const isActive = status === "active"

  const difficultyLabels = {
    easy: { zh: "简单", en: "Easy" },
    medium: { zh: "中等", en: "Medium" },
    hard: { zh: "困难", en: "Hard" },
    legendary: { zh: "传奇", en: "Legendary" },
  }

  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        isLocked
          ? "cursor-not-allowed border-white/5 bg-white/5 opacity-50"
          : isCompleted
            ? "border-green-500/30 bg-green-500/10"
            : isActive
              ? "border-cyan-400/50 bg-cyan-400/10"
              : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            isCompleted
              ? "bg-green-500/20"
              : isActive
                ? "bg-cyan-400/20"
                : isLocked
                  ? "bg-white/10"
                  : getDifficultyBgColor(challenge.difficulty)
          }`}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          ) : isActive ? (
            <Play className="h-6 w-6 text-cyan-400" />
          ) : isLocked ? (
            <span className="text-xl">🔒</span>
          ) : (
            <Target className={`h-6 w-6 ${getDifficultyColor(challenge.difficulty)}`} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Title and Badges */}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${getDifficultyBgColor(challenge.difficulty)} ${getDifficultyColor(challenge.difficulty)}`}
            >
              {difficultyLabels[challenge.difficulty][language]}
            </span>
            {challenge.seasonOnly && (
              <span className="shrink-0 rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                {language === "zh" ? "赛季限定" : "Season"}
              </span>
            )}
            {isActive && (
              <span className="shrink-0 rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                {language === "zh" ? "进行中" : "Active"}
              </span>
            )}
          </div>

          <h3 className="truncate font-bold text-white">
            {getLocalizedText(challenge.title, language)}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-white/60">
            {getLocalizedText(challenge.description, language)}
          </p>

          {/* Progress */}
          {(isActive || isCompleted) && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-white/50">
                  {language === "zh" ? "进度" : "Progress"}
                </span>
                <span className={isCompleted ? "text-green-400" : "text-cyan-400"}>
                  {progress}/{challenge.goals[0].target}{" "}
                  {getLocalizedText(challenge.goals[0].unit, language)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isCompleted ? "bg-green-500" : "bg-cyan-400"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Rewards Preview */}
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-cyan-400">
              <Zap className="h-3 w-3" />
              {challenge.rewards.xp} XP
            </span>
            <span className="flex items-center gap-1 text-yellow-400">
              🪙 {challenge.rewards.coins}
            </span>
            {challenge.rewards.badge && (
              <span className="flex items-center gap-1 text-purple-400">
                🏅 {language === "zh" ? "徽章" : "Badge"}
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
// Challenge Detail Page
// ============================================================

interface ChallengeDetailProps {
  challenge: CityChallenge
  language?: Language
  progress?: number
  status?: "locked" | "available" | "active" | "completed"
  onClose?: () => void
  onStart?: () => void
  onPause?: () => void
  onClaim?: () => void
}

export function ChallengeDetail({
  challenge,
  language = "zh",
  progress = 0,
  status = "available",
  onClose,
  onStart,
  onPause,
  onClaim,
}: ChallengeDetailProps) {
  const theme = getCityTheme(challenge.cityId)
  const progressPercent = Math.min((progress / challenge.goals[0].target) * 100, 100)
  const isCompleted = status === "completed"
  const isActive = status === "active"

  if (!theme) return null

  const difficultyLabels = {
    easy: { zh: "简单", en: "Easy" },
    medium: { zh: "中等", en: "Medium" },
    hard: { zh: "困难", en: "Hard" },
    legendary: { zh: "传奇", en: "Legendary" },
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0f1a]">
      {/* Header */}
      <div
        className="relative h-48 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
        }}
      >
        <div className="absolute inset-0 bg-black/30" />
        
        {/* Back Button */}
        <button
          onClick={onClose}
          className="absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Challenge Info */}
        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="mb-2 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyBgColor(challenge.difficulty)} ${getDifficultyColor(challenge.difficulty)}`}
            >
              {difficultyLabels[challenge.difficulty][language]}
            </span>
            {challenge.seasonOnly && (
              <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs font-medium text-yellow-400">
                {language === "zh" ? "赛季限定" : "Season Only"}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {getLocalizedText(challenge.title, language)}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-32 pt-6">
        {/* Description */}
        <p className="mb-6 text-white/70">
          {getLocalizedText(challenge.description, language)}
        </p>

        {/* Progress Section */}
        {(isActive || isCompleted) && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">
              {language === "zh" ? "挑战进度" : "Challenge Progress"}
            </h3>
            {challenge.goals.map((goal, i) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-white/60">
                    {goal.type === "distance" && (language === "zh" ? "跑步距离" : "Running Distance")}
                    {goal.type === "area" && (language === "zh" ? "占领面积" : "Captured Area")}
                    {goal.type === "hexes" && (language === "zh" ? "占领领地" : "Captured Territories")}
                    {goal.type === "streak" && (language === "zh" ? "连续天数" : "Streak Days")}
                    {goal.type === "speed" && (language === "zh" ? "平均配速" : "Average Pace")}
                  </span>
                  <span className={isCompleted ? "text-green-400" : "text-cyan-400"}>
                    {progress}/{goal.target} {getLocalizedText(goal.unit, language)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCompleted ? "bg-green-500" : "bg-cyan-400"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rules */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">
            {language === "zh" ? "挑战规则" : "Challenge Rules"}
          </h3>
          <ul className="space-y-2">
            {challenge.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                {getLocalizedText(rule, language)}
              </li>
            ))}
          </ul>
        </div>

        {/* Rewards */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">
            {language === "zh" ? "挑战奖励" : "Rewards"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-cyan-400/10 p-3 text-center">
              <Zap className="mx-auto mb-1 h-6 w-6 text-cyan-400" />
              <p className="text-lg font-bold text-white">{challenge.rewards.xp}</p>
              <p className="text-xs text-white/50">XP</p>
            </div>
            <div className="rounded-xl bg-yellow-400/10 p-3 text-center">
              <span className="mb-1 block text-2xl">🪙</span>
              <p className="text-lg font-bold text-white">{challenge.rewards.coins}</p>
              <p className="text-xs text-white/50">{language === "zh" ? "金币" : "Coins"}</p>
            </div>
            {challenge.rewards.badge && (
              <div className="rounded-xl bg-purple-400/10 p-3 text-center">
                <span className="mb-1 block text-2xl">🏅</span>
                <p className="text-sm font-bold text-white">
                  {getLocalizedText(challenge.rewards.badge, language)}
                </p>
                <p className="text-xs text-white/50">{language === "zh" ? "徽章" : "Badge"}</p>
              </div>
            )}
            {challenge.rewards.title && (
              <div className="rounded-xl bg-orange-400/10 p-3 text-center">
                <span className="mb-1 block text-2xl">👑</span>
                <p className="text-sm font-bold text-white">
                  {getLocalizedText(challenge.rewards.title, language)}
                </p>
                <p className="text-xs text-white/50">{language === "zh" ? "称号" : "Title"}</p>
              </div>
            )}
          </div>
        </div>

        {/* Duration & Requirements */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <Clock className="mb-2 h-5 w-5 text-white/50" />
            <p className="text-xs text-white/50">
              {language === "zh" ? "挑战时长" : "Duration"}
            </p>
            <p className="font-bold text-white">
              {challenge.duration} {language === "zh" ? "小时" : "hours"}
            </p>
          </div>
          {challenge.requirements.minLevel && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Star className="mb-2 h-5 w-5 text-white/50" />
              <p className="text-xs text-white/50">
                {language === "zh" ? "等级要求" : "Level Required"}
              </p>
              <p className="font-bold text-white">Lv.{challenge.requirements.minLevel}+</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action */}
      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0a0f1a]/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-xl">
        {isCompleted ? (
          <button
            onClick={onClaim}
            className="w-full rounded-2xl bg-green-500 py-4 text-center font-bold text-white transition-all hover:bg-green-600"
          >
            {language === "zh" ? "领取奖励" : "Claim Rewards"}
          </button>
        ) : isActive ? (
          <div className="flex gap-3">
            <button
              onClick={onPause}
              className="flex-1 rounded-2xl border border-white/20 bg-white/5 py-4 text-center font-bold text-white transition-all hover:bg-white/10"
            >
              <Pause className="mx-auto h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="flex-[3] rounded-2xl py-4 text-center font-bold text-white transition-all hover:opacity-90"
              style={{
                background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
              }}
            >
              {language === "zh" ? "继续挑战" : "Continue"}
            </button>
          </div>
        ) : (
          <button
            onClick={onStart}
            className="w-full rounded-2xl py-4 text-center font-bold text-white transition-all hover:opacity-90"
            style={{
              background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
            }}
          >
            {language === "zh" ? "开始挑战" : "Start Challenge"}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Challenge Start Popup (Transition)
// ============================================================

interface ChallengeStartPopupProps {
  challenge: CityChallenge
  language?: Language
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ChallengeStartPopup({
  challenge,
  language = "zh",
  isOpen,
  onClose,
  onConfirm,
}: ChallengeStartPopupProps) {
  const theme = getCityTheme(challenge.cityId)
  const [countdown, setCountdown] = useState(3)
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    if (isStarting && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (isStarting && countdown === 0) {
      onConfirm()
    }
  }, [isStarting, countdown, onConfirm])

  if (!isOpen || !theme) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Popup */}
      <div className="relative w-full max-w-sm animate-scale-in overflow-hidden rounded-3xl bg-[#0f172a]">
        {/* Header with gradient */}
        <div
          className="p-6 text-center"
          style={{
            background: `linear-gradient(135deg, ${theme.gradientFrom}40, ${theme.gradientTo}40)`,
          }}
        >
          <span className="mb-2 block text-5xl">{theme.icon}</span>
          <h2 className="text-xl font-bold text-white">
            {getLocalizedText(challenge.title, language)}
          </h2>
          <p className="mt-1 text-sm text-white/60">
            {getLocalizedText(challenge.description, language)}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {isStarting ? (
            <div className="py-8 text-center">
              <div
                className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full text-5xl font-bold text-white animate-pulse"
                style={{
                  background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                }}
              >
                {countdown > 0 ? countdown : "GO!"}
              </div>
              <p className="text-white/60">
                {language === "zh" ? "准备开始..." : "Get ready..."}
              </p>
            </div>
          ) : (
            <>
              {/* Goals Preview */}
              <div className="mb-4 rounded-xl bg-white/5 p-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  {language === "zh" ? "挑战目标" : "Challenge Goals"}
                </h4>
                {challenge.goals.map((goal, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-white/70">
                      {goal.type === "distance" && (language === "zh" ? "跑步距离" : "Distance")}
                      {goal.type === "area" && (language === "zh" ? "占领面积" : "Area")}
                      {goal.type === "hexes" && (language === "zh" ? "占领领地" : "Territories")}
                      {goal.type === "streak" && (language === "zh" ? "连续天数" : "Streak")}
                    </span>
                    <span className="font-bold text-white">
                      {goal.target} {getLocalizedText(goal.unit, language)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Duration */}
              <div className="mb-6 flex items-center justify-center gap-2 text-sm text-white/50">
                <Clock className="h-4 w-4" />
                <span>
                  {language === "zh" ? "限时" : "Time Limit"}: {challenge.duration}{" "}
                  {language === "zh" ? "小时" : "hours"}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-white/20 bg-white/5 py-3 font-medium text-white transition-all hover:bg-white/10"
                >
                  {language === "zh" ? "取消" : "Cancel"}
                </button>
                <button
                  onClick={() => setIsStarting(true)}
                  className="flex-1 rounded-xl py-3 font-medium text-white transition-all hover:opacity-90"
                  style={{
                    background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                  }}
                >
                  {language === "zh" ? "开始" : "Start"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// City Leaderboard
// ============================================================

interface CityLeaderboardProps {
  cityId: string
  language?: Language
  onClose?: () => void
}

export function CityLeaderboard({
  cityId,
  language = "zh",
  onClose,
}: CityLeaderboardProps) {
  const theme = getCityTheme(cityId)
  const [timeFilter, setTimeFilter] = useState<"season" | "week" | "all">("season")

  if (!theme) return null

  // Mock leaderboard data
  const leaderboardData = [
    { rank: 1, name: "SpeedRunner", area: 156780, level: 25, isYou: false },
    { rank: 2, name: "CityHunter", area: 142350, level: 23, isYou: false },
    { rank: 3, name: "NightOwl", area: 128900, level: 21, isYou: false },
    { rank: 4, name: "GridMaster", area: 115600, level: 20, isYou: false },
    { rank: 5, name: "Runner_01", area: 100620, level: 18, isYou: true },
    { rank: 6, name: "FlashStep", area: 98500, level: 17, isYou: false },
    { rank: 7, name: "TerritoryKing", area: 87200, level: 16, isYou: false },
    { rank: 8, name: "UrbanExplorer", area: 76500, level: 15, isYou: false },
  ]

  const formatArea = (area: number) => {
    if (area >= 10000) {
      return `${(area / 1000).toFixed(1)} km²`
    }
    return `${area.toLocaleString()} m²`
  }

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
            {getLocalizedText(theme.name, language)} {language === "zh" ? "排行榜" : "Leaderboard"}
          </h1>
        </div>

        {/* Time Filter */}
        <div className="relative mt-4 flex justify-center gap-2 px-4">
          {(["season", "week", "all"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                timeFilter === filter
                  ? "bg-white text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {filter === "season" && (language === "zh" ? "本赛季" : "Season")}
              {filter === "week" && (language === "zh" ? "本周" : "This Week")}
              {filter === "all" && (language === "zh" ? "总榜" : "All Time")}
            </button>
          ))}
        </div>
      </div>

      {/* Your Rank Card */}
      <div className="mx-4 -mt-4 mb-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/20 text-lg font-bold text-cyan-400">
            #5
          </div>
          <div className="flex-1">
            <p className="font-bold text-white">{language === "zh" ? "你的排名" : "Your Rank"}</p>
            <p className="text-sm text-white/60">
              {formatArea(100620)} {language === "zh" ? "占领面积" : "captured"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-cyan-400">{language === "zh" ? "距上一名" : "To next rank"}</p>
            <p className="font-bold text-white">{formatArea(15000)}</p>
          </div>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="px-4 pb-8">
        {/* Top 3 */}
        <div className="mb-6 flex justify-center gap-4">
          {leaderboardData.slice(0, 3).map((player, i) => {
            const positions = [1, 0, 2] // Silver, Gold, Bronze order
            const pos = positions[i]
            const actualPlayer = leaderboardData[pos]
            const sizes = ["h-24 w-24", "h-28 w-28 -mt-4", "h-24 w-24"]
            const colors = ["bg-gray-400", "bg-yellow-400", "bg-orange-400"]
            const icons = ["🥈", "🥇", "🥉"]

            return (
              <div key={actualPlayer.rank} className="flex flex-col items-center">
                <div
                  className={`${sizes[i]} mb-2 flex items-center justify-center rounded-full border-4 ${
                    actualPlayer.isYou ? "border-cyan-400" : "border-white/20"
                  } bg-white/10 text-2xl font-bold text-white`}
                >
                  {actualPlayer.name[0]}
                </div>
                <span className="text-2xl">{icons[i]}</span>
                <p className={`font-bold ${actualPlayer.isYou ? "text-cyan-400" : "text-white"}`}>
                  {actualPlayer.name}
                </p>
                <p className="text-xs text-white/50">{formatArea(actualPlayer.area)}</p>
              </div>
            )
          })}
        </div>

        {/* Rest of list */}
        <div className="space-y-2">
          {leaderboardData.slice(3).map((player) => (
            <div
              key={player.rank}
              className={`flex items-center gap-3 rounded-2xl border p-4 ${
                player.isYou
                  ? "border-cyan-400/30 bg-cyan-400/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <span className="w-8 text-center text-lg font-bold text-white/50">
                #{player.rank}
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-bold text-white">
                {player.name[0]}
              </div>
              <div className="flex-1">
                <p className={`font-bold ${player.isYou ? "text-cyan-400" : "text-white"}`}>
                  {player.name}
                  {player.isYou && (
                    <span className="ml-2 text-xs text-cyan-400">
                      ({language === "zh" ? "你" : "You"})
                    </span>
                  )}
                </p>
                <p className="text-xs text-white/50">Lv.{player.level}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-white">{formatArea(player.area)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
