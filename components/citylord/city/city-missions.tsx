"use client"

import React from "react"

import { useState, useEffect } from "react"
import {
  Target,
  ChevronLeft,
  ChevronRight,
  Zap,
  Clock,
  CheckCircle2,
  MapPin,
  Globe,
  Calendar,
  Flame,
  Gift,
  Sparkles,
} from "lucide-react"
import {
  getCityTheme,
  getLocalizedText,
  type Language,
} from "@/lib/citylord/city-config"

// ============================================================
// Mission Types
// ============================================================

export interface Mission {
  id: string
  type: "daily" | "city" | "global"
  cityId?: string
  title: { zh: string; en: string }
  description: { zh: string; en: string }
  steps: {
    description: { zh: string; en: string }
    target: number
    current: number
    unit: { zh: string; en: string }
  }[]
  rewards: {
    xp: number
    coins: number
    bonus?: string
  }
  expiresAt?: string
  status: "available" | "in_progress" | "completed" | "claimed"
}

// ============================================================
// Mission Filter Tabs
// ============================================================

interface MissionFilterProps {
  filter: "all" | "daily" | "city" | "global"
  onFilterChange: (filter: "all" | "daily" | "city" | "global") => void
  cityId?: string
  language?: Language
}

export function MissionFilter({
  filter,
  onFilterChange,
  cityId,
  language = "zh",
}: MissionFilterProps) {
  const theme = cityId ? getCityTheme(cityId) : null

  const filters: { id: "all" | "daily" | "city" | "global"; icon: React.ReactNode; label: { zh: string; en: string } }[] = [
    { id: "all", icon: <Target className="h-4 w-4" />, label: { zh: "全部", en: "All" } },
    { id: "daily", icon: <Calendar className="h-4 w-4" />, label: { zh: "今日", en: "Today" } },
    { id: "city", icon: <MapPin className="h-4 w-4" />, label: { zh: "城市", en: "City" } },
    { id: "global", icon: <Globe className="h-4 w-4" />, label: { zh: "全局", en: "Global" } },
  ]

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {filters.map((f) => (
        <button
          key={f.id}
          onClick={() => onFilterChange(f.id)}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            filter === f.id
              ? "text-white"
              : "bg-white/5 text-white/60 hover:bg-white/10"
          }`}
          style={
            filter === f.id && theme
              ? { background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})` }
              : filter === f.id
                ? { background: "linear-gradient(90deg, #22c55e, #14b8a6)" }
                : {}
          }
        >
          {f.icon}
          {f.label[language]}
        </button>
      ))}
    </div>
  )
}

// ============================================================
// Mission Card
// ============================================================

interface MissionCardProps {
  mission: Mission
  language?: Language
  onClick?: () => void
}

export function MissionCard({
  mission,
  language = "zh",
  onClick,
}: MissionCardProps) {
  const theme = mission.cityId ? getCityTheme(mission.cityId) : null
  const isCompleted = mission.status === "completed" || mission.status === "claimed"
  const isClaimed = mission.status === "claimed"
  const totalSteps = mission.steps.length
  const completedSteps = mission.steps.filter((s) => s.current >= s.target).length
  const overallProgress = mission.steps.reduce((acc, s) => acc + Math.min(s.current / s.target, 1), 0) / totalSteps * 100

  const typeIcons = {
    daily: <Calendar className="h-4 w-4" />,
    city: <MapPin className="h-4 w-4" />,
    global: <Globe className="h-4 w-4" />,
  }

  const typeLabels = {
    daily: { zh: "每日任务", en: "Daily" },
    city: { zh: "城市任务", en: "City" },
    global: { zh: "全局任务", en: "Global" },
  }

  const typeColors = {
    daily: "bg-yellow-400/20 text-yellow-400",
    city: theme ? "" : "bg-cyan-400/20 text-cyan-400",
    global: "bg-purple-400/20 text-purple-400",
  }

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        isCompleted
          ? "border-[#22c55e]/30 bg-[#22c55e]/10"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            isCompleted ? "bg-[#22c55e]/20" : mission.type === "city" && theme ? "" : "bg-white/10"
          }`}
          style={
            !isCompleted && mission.type === "city" && theme
              ? { backgroundColor: `${theme.primaryColor}20` }
              : {}
          }
        >
          {isCompleted ? (
            <CheckCircle2 className="h-6 w-6 text-[#22c55e]" />
          ) : (
            <Target
              className="h-6 w-6"
              style={
                mission.type === "city" && theme
                  ? { color: theme.primaryColor }
                  : { color: "white" }
              }
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Type Badge */}
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                mission.type === "city" && theme
                  ? ""
                  : typeColors[mission.type]
              }`}
              style={
                mission.type === "city" && theme
                  ? {
                      backgroundColor: `${theme.primaryColor}20`,
                      color: theme.primaryColor,
                    }
                  : {}
              }
            >
              {typeIcons[mission.type]}
              {typeLabels[mission.type][language]}
            </span>
            {mission.expiresAt && (
              <span className="flex items-center gap-1 text-[10px] text-white/40">
                <Clock className="h-3 w-3" />
                {mission.expiresAt}
              </span>
            )}
          </div>

          <h3 className="truncate font-bold text-white">
            {getLocalizedText(mission.title, language)}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-white/60">
            {getLocalizedText(mission.description, language)}
          </p>

          {/* Progress */}
          {!isClaimed && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-white/50">
                  {completedSteps}/{totalSteps} {language === "zh" ? "步骤" : "steps"}
                </span>
                <span className={isCompleted ? "text-[#22c55e]" : "text-cyan-400"}>
                  {Math.round(overallProgress)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isCompleted ? "bg-[#22c55e]" : "bg-cyan-400"
                  }`}
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Rewards Preview */}
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-cyan-400">
              <Zap className="h-3 w-3" />
              {mission.rewards.xp} XP
            </span>
            <span className="flex items-center gap-1 text-yellow-400">
              🪙 {mission.rewards.coins}
            </span>
            {mission.rewards.bonus && (
              <span className="flex items-center gap-1 text-purple-400">
                <Gift className="h-3 w-3" />
                {mission.rewards.bonus}
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
// Mission Detail Page
// ============================================================

interface MissionDetailProps {
  mission: Mission
  language?: Language
  onClose?: () => void
  onClaim?: () => void
}

export function MissionDetail({
  mission,
  language = "zh",
  onClose,
  onClaim,
}: MissionDetailProps) {
  const theme = mission.cityId ? getCityTheme(mission.cityId) : null
  const isCompleted = mission.status === "completed"
  const isClaimed = mission.status === "claimed"
  const primaryColor = theme?.primaryColor || "#22c55e"
  const gradientFrom = theme?.gradientFrom || "#22c55e"
  const gradientTo = theme?.gradientTo || "#14b8a6"

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0f1a]">
      {/* Header */}
      <div
        className="relative overflow-hidden pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]"
        style={{
          background: `linear-gradient(135deg, ${gradientFrom}60, ${gradientTo}60)`,
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
          {theme && <span className="mb-2 block text-3xl">{theme.icon}</span>}
          <h1 className="text-2xl font-bold text-white">
            {getLocalizedText(mission.title, language)}
          </h1>
          <p className="mt-2 text-white/70">
            {getLocalizedText(mission.description, language)}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-32 pt-6">
        {/* Steps */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-4 text-sm font-semibold text-white">
            {language === "zh" ? "任务步骤" : "Mission Steps"}
          </h3>
          <div className="space-y-4">
            {mission.steps.map((step, i) => {
              const stepComplete = step.current >= step.target
              const stepProgress = Math.min((step.current / step.target) * 100, 100)

              return (
                <div key={i} className="flex gap-3">
                  {/* Step Number */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      stepComplete ? "bg-[#22c55e]" : "bg-white/10"
                    }`}
                  >
                    {stepComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : (
                      <span className="text-sm font-bold text-white/60">{i + 1}</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <p className={`text-sm ${stepComplete ? "text-white/50 line-through" : "text-white"}`}>
                      {getLocalizedText(step.description, language)}
                    </p>
                    <div className="mt-2">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-white/50">
                          {language === "zh" ? "进度" : "Progress"}
                        </span>
                        <span className={stepComplete ? "text-[#22c55e]" : "text-cyan-400"}>
                          {step.current}/{step.target} {getLocalizedText(step.unit, language)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            stepComplete ? "bg-[#22c55e]" : "bg-cyan-400"
                          }`}
                          style={{ width: `${stepProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Rewards */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-4 text-sm font-semibold text-white">
            {language === "zh" ? "任务奖励" : "Rewards"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-cyan-400/10 p-4 text-center">
              <Zap className="mx-auto mb-2 h-6 w-6 text-cyan-400" />
              <p className="text-xl font-bold text-white">{mission.rewards.xp}</p>
              <p className="text-xs text-white/50">XP</p>
            </div>
            <div className="rounded-xl bg-yellow-400/10 p-4 text-center">
              <span className="mb-2 block text-2xl">🪙</span>
              <p className="text-xl font-bold text-white">{mission.rewards.coins}</p>
              <p className="text-xs text-white/50">{language === "zh" ? "金币" : "Coins"}</p>
            </div>
          </div>
          {mission.rewards.bonus && (
            <div className="mt-3 rounded-xl bg-purple-400/10 p-4 text-center">
              <Gift className="mx-auto mb-2 h-6 w-6 text-purple-400" />
              <p className="font-bold text-white">{mission.rewards.bonus}</p>
              <p className="text-xs text-white/50">{language === "zh" ? "额外奖励" : "Bonus"}</p>
            </div>
          )}
        </div>

        {/* Time Limit */}
        {mission.expiresAt && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-white/50" />
              <div>
                <p className="text-xs text-white/50">
                  {language === "zh" ? "截止时间" : "Expires"}
                </p>
                <p className="font-bold text-white">{mission.expiresAt}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action */}
      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0a0f1a]/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-xl">
        {isClaimed ? (
          <button
            disabled
            className="w-full rounded-2xl bg-white/10 py-4 text-center font-bold text-white/50"
          >
            {language === "zh" ? "已领取" : "Claimed"}
          </button>
        ) : isCompleted ? (
          <button
            onClick={onClaim}
            className="w-full rounded-2xl bg-[#22c55e] py-4 text-center font-bold text-white transition-all hover:bg-[#16a34a]"
          >
            {language === "zh" ? "领取奖励" : "Claim Rewards"}
          </button>
        ) : (
          <button
            onClick={onClose}
            className="w-full rounded-2xl py-4 text-center font-bold text-white transition-all hover:opacity-90"
            style={{
              background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
            }}
          >
            {language === "zh" ? "继续任务" : "Continue"}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Mission Complete Celebration
// ============================================================

interface MissionCompleteCelebrationProps {
  isOpen: boolean
  mission: Mission
  language?: Language
  onClose: () => void
  onClaim: () => void
}

export function MissionCompleteCelebration({
  isOpen,
  mission,
  language = "zh",
  onClose,
  onClaim,
}: MissionCompleteCelebrationProps) {
  const theme = mission.cityId ? getCityTheme(mission.cityId) : null
  const [showParticles, setShowParticles] = useState(false)
  const primaryColor = theme?.primaryColor || "#22c55e"
  const gradientFrom = theme?.gradientFrom || "#22c55e"
  const gradientTo = theme?.gradientTo || "#14b8a6"

  useEffect(() => {
    if (isOpen) {
      setShowParticles(true)
      const timer = setTimeout(() => setShowParticles(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Particles */}
      {showParticles && (
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(30)].map((_, i) => (
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
              <Sparkles className="h-4 w-4" style={{ color: primaryColor }} />
            </div>
          ))}
        </div>
      )}

      {/* Popup */}
      <div className="relative w-full max-w-sm animate-scale-in overflow-hidden rounded-3xl bg-[#0f172a]">
        {/* Header */}
        <div
          className="p-8 text-center"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom}40, ${gradientTo}40)`,
          }}
        >
          <div
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-4xl"
            style={{
              backgroundColor: `${primaryColor}20`,
              boxShadow: `0 0 40px ${primaryColor}60`,
            }}
          >
            <Flame className="animate-bounce" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {language === "zh" ? "任务完成！" : "Mission Complete!"}
          </h2>
          <p className="mt-2 text-white/70">
            {getLocalizedText(mission.title, language)}
          </p>
        </div>

        {/* Rewards */}
        <div className="p-6">
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-cyan-400/10 p-4 text-center">
              <Zap className="mx-auto mb-2 h-8 w-8 text-cyan-400" />
              <p className="text-2xl font-bold text-white">+{mission.rewards.xp}</p>
              <p className="text-xs text-white/50">XP</p>
            </div>
            <div className="rounded-xl bg-yellow-400/10 p-4 text-center">
              <span className="mb-2 block text-3xl">🪙</span>
              <p className="text-2xl font-bold text-white">+{mission.rewards.coins}</p>
              <p className="text-xs text-white/50">{language === "zh" ? "金币" : "Coins"}</p>
            </div>
          </div>

          {mission.rewards.bonus && (
            <div className="mb-6 rounded-xl bg-purple-400/10 p-4 text-center">
              <Gift className="mx-auto mb-2 h-6 w-6 text-purple-400" />
              <p className="font-bold text-white">{mission.rewards.bonus}</p>
            </div>
          )}

          <button
            onClick={() => {
              onClaim()
              onClose()
            }}
            className="w-full rounded-2xl py-4 text-center font-bold text-white transition-all hover:opacity-90"
            style={{
              background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
            }}
          >
            {language === "zh" ? "太棒了！" : "Awesome!"}
          </button>
        </div>
      </div>
    </div>
  )
}
