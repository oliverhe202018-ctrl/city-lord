"use client"

import { useState } from "react"
import {
  MapPin,
  ChevronRight,
  Zap,
  Clock,
  Signal,
  Activity,
  Target,
  TrendingUp,
} from "lucide-react"
import {
  getCityTheme,
  getCurrentSeason,
  getLocalizedText,
  type Language,
} from "@/lib/citylord/city-config"

import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { LogIn } from "lucide-react"
import { useEffect } from "react"

function LoginStatusPrompt() {
  const [isLoggedIn, setIsLoggedIn] = useState(true) // Assume logged in to prevent flash
  
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session)
    }
    checkUser()
  }, [])

  if (isLoggedIn) return null

  return (
    <Link href="/login" className="absolute top-3 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-[#22c55e] text-black px-4 py-2 rounded-full font-bold shadow-lg animate-pulse hover:animate-none hover:scale-105 transition-transform">
        <LogIn className="w-4 h-4" />
        <span className="text-xs">登录保存进度</span>
      </div>
    </Link>
  )
}

interface MapHeaderProps {
  cityId: string
  language?: Language
  isRunning?: boolean
  runningStats?: {
    distance: number
    pace: string
    time: string
    area: number
  }
  onCityClick?: () => void
  onSeasonClick?: () => void
  onActivityClick?: () => void
}

export function MapHeader({
  cityId,
  language = "zh",
  isRunning = false,
  runningStats,
  onCityClick,
  onSeasonClick,
  onActivityClick,
}: MapHeaderProps) {
  const theme = getCityTheme(cityId)
  const season = getCurrentSeason(cityId)

  if (!theme) return null

  // Calculate days remaining in season
  const getDaysRemaining = () => {
    if (!season) return 0
    const now = new Date()
    const end = new Date(season.endDate)
    const diff = end.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const daysRemaining = getDaysRemaining()
  const seasonProgress = season ? ((90 - daysRemaining) / 90) * 100 : 0

  return (
    <div className="absolute left-0 right-0 top-0 z-30 pt-[env(safe-area-inset-top)]">
      {/* Main Header Bar */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* City Badge */}
        <button
          onClick={onCityClick}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-black/80"
        >
          <span className="text-lg">{theme.icon}</span>
          <div className="text-left">
            <p className="text-sm font-bold text-white">
              {getLocalizedText(theme.name, language)}
            </p>
            {season && (
              <p className="text-[10px]" style={{ color: theme.primaryColor }}>
                {getLocalizedText(season.theme, language)}
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-white/40" />
        </button>

        {/* Login Prompt (if not running) */}
        {!isRunning && (
           <LoginStatusPrompt />
        )}

        {/* Running Stats (when running) */}
        {isRunning && runningStats && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#22c55e]/30 bg-black/60 px-4 py-2 backdrop-blur-xl">
            <div className="flex items-center gap-1">
              <Activity className="h-4 w-4 text-[#22c55e]" />
              <span className="font-mono text-sm font-bold text-white">
                {runningStats.distance.toFixed(2)} km
              </span>
            </div>
            <div className="h-4 w-px bg-white/20" />
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-sm font-bold text-white">
                {runningStats.pace}
              </span>
            </div>
          </div>
        )}

        {/* GPS Signal (when not running shows season info) */}
        {!isRunning && (
          <div className="flex items-center gap-2">
            {/* Activity Button */}
            {season?.specialEvents[0] && (
              <button
                onClick={onActivityClick}
                className="flex items-center gap-2 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 backdrop-blur-xl transition-all hover:bg-yellow-400/20"
              >
                <Zap className="h-4 w-4 text-yellow-400" />
                <span className="text-xs font-medium text-yellow-400">
                  {season.specialEvents[0].bonus}
                </span>
              </button>
            )}

            {/* GPS Signal */}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-xl">
              <Signal className="h-4 w-4 text-[#22c55e]" />
              <span className="text-xs text-[#22c55e]">GPS</span>
            </div>
          </div>
        )}
      </div>

      {/* Season Progress Bar (when not running) */}
      {!isRunning && season && (
        <button
          onClick={onSeasonClick}
          className="mx-4 mb-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-xl transition-all hover:border-white/20"
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${theme.primaryColor}20` }}
          >
            <Target className="h-5 w-5" style={{ color: theme.primaryColor }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-white">
                {getLocalizedText(season.name, language)}
              </span>
              <span className="flex items-center gap-1 text-xs text-white/50">
                <Clock className="h-3 w-3" />
                {daysRemaining} {language === "zh" ? "天" : "days"}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${seasonProgress}%`,
                  background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                }}
              />
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
        </button>
      )}

      {/* Running Time Display (when running) */}
      {isRunning && runningStats && (
        <div className="mx-4 mb-2 rounded-2xl border border-[#22c55e]/30 bg-black/60 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/50">
                {language === "zh" ? "时间" : "Time"}
              </p>
              <p className="font-mono text-2xl font-bold text-white">{runningStats.time}</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/50">
                {language === "zh" ? "距离" : "Distance"}
              </p>
              <p className="font-mono text-2xl font-bold text-[#22c55e]">
                {runningStats.distance.toFixed(2)}
                <span className="ml-1 text-sm font-normal text-white/40">km</span>
              </p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/50">
                {language === "zh" ? "面积" : "Area"}
              </p>
              <p className="font-mono text-2xl font-bold text-cyan-400">
                {runningStats.area}
                <span className="ml-1 text-sm font-normal text-white/40">m²</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Activity Event Banner
// ============================================================

interface ActivityBannerProps {
  cityId: string
  language?: Language
  onClose?: () => void
  onViewDetails?: () => void
}

export function ActivityBanner({
  cityId,
  language = "zh",
  onClose,
  onViewDetails,
}: ActivityBannerProps) {
  const theme = getCityTheme(cityId)
  const season = getCurrentSeason(cityId)

  if (!theme || !season?.specialEvents[0]) return null

  const event = season.specialEvents[0]

  return (
    <div
      className="mx-4 mt-2 overflow-hidden rounded-2xl border"
      style={{
        borderColor: `${theme.primaryColor}40`,
        background: `linear-gradient(135deg, ${theme.primaryColor}20, transparent)`,
      }}
    >
      <div className="flex items-center gap-3 p-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${theme.primaryColor}30` }}
        >
          <Zap className="h-6 w-6" style={{ color: theme.primaryColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">
            {getLocalizedText(event.name, language)}
          </p>
          <p className="text-sm text-white/60">
            {event.bonus} - {event.endDate}
          </p>
        </div>
        <button
          onClick={onViewDetails}
          className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
          style={{
            background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
          }}
        >
          {language === "zh" ? "查看" : "View"}
        </button>
      </div>
    </div>
  )
}
