"use client"

import { useState, useMemo } from "react"
import {
  MapPin,
  Search,
  ChevronRight,
  X,
  Trophy,
  Target,
  Users,
  Zap,
  Clock,
  Star,
  Globe,
} from "lucide-react"
import {
  CITY_THEMES,
  getCityTheme,
  getCurrentSeason,
  getCityChallenges,
  getLocalizedText,
  type CityTheme,
  type Language,
} from "@/lib/citylord/city-config"

interface CitySwitchProps {
  currentCityId: string
  onCityChange: (cityId: string) => void
  language?: Language
}

// ============================================================
// City Selector Modal
// ============================================================

export function CitySelectorModal({
  isOpen,
  onClose,
  currentCityId,
  onCityChange,
  language = "zh",
}: {
  isOpen: boolean
  onClose: () => void
  currentCityId: string
  onCityChange: (cityId: string) => void
  language?: Language
}) {
  const [searchQuery, setSearchQuery] = useState("")

  const cities = useMemo(() => {
    return Object.values(CITY_THEMES).filter((city) => {
      const name = getLocalizedText(city.name, language).toLowerCase()
      return name.includes(searchQuery.toLowerCase())
    })
  }, [searchQuery, language])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg animate-slide-up rounded-t-3xl bg-[#0f172a] sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">
              {language === "zh" ? "选择城市" : "Select City"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "zh" ? "搜索城市..." : "Search cities..."}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder-white/40 outline-none transition-colors focus:border-cyan-400/50"
            />
          </div>
        </div>

        {/* City List */}
        <div className="max-h-[60vh] overflow-y-auto px-4 pb-6">
          <div className="space-y-2">
            {cities.map((city) => {
              const isSelected = city.id === currentCityId
              const season = getCurrentSeason(city.id)

              return (
                <button
                  key={city.id}
                  onClick={() => {
                    onCityChange(city.id)
                    onClose()
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    isSelected
                      ? "border-cyan-400/50 bg-cyan-400/10"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* City Icon with Theme Color */}
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                      style={{ backgroundColor: `${city.primaryColor}20` }}
                    >
                      {city.icon}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          {getLocalizedText(city.name, language)}
                        </span>
                        {isSelected && (
                          <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                            {language === "zh" ? "当前" : "Current"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/50">
                        {getLocalizedText(city.description, language)}
                      </p>
                      {season && (
                        <div className="mt-1 flex items-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-400" />
                          <span className="text-[10px] text-yellow-400">
                            {season.bonusMultiplier}x {language === "zh" ? "赛季加成" : "Season Bonus"}
                          </span>
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-5 w-5 text-white/30" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// City Header Badge (for map top)
// ============================================================

export function CityHeaderBadge({
  cityId,
  onClick,
  language = "zh",
}: {
  cityId: string
  onClick?: () => void
  language?: Language
}) {
  const theme = getCityTheme(cityId)
  const season = getCurrentSeason(cityId)

  if (!theme) return null

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-black/80"
    >
      <span className="text-lg">{theme.icon}</span>
      <div className="text-left">
        <p className="text-sm font-bold text-white">
          {getLocalizedText(theme.name, language)}
        </p>
        {season && (
          <p className="text-[10px] text-cyan-400">
            {getLocalizedText(season.theme, language)}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-white/40" />
    </button>
  )
}

// ============================================================
// City Home Page
// ============================================================

interface CityHomePageProps {
  cityId: string
  language?: Language
  onNavigateToChallenge?: (challengeId: string) => void
  onNavigateToLeaderboard?: () => void
  onClose?: () => void
}

export function CityHomePage({
  cityId,
  language = "zh",
  onNavigateToChallenge,
  onNavigateToLeaderboard,
  onClose,
}: CityHomePageProps) {
  const theme = getCityTheme(cityId)
  const season = getCurrentSeason(cityId)
  const challenges = getCityChallenges(cityId)

  if (!theme) return null

  // Mock data
  const cityStats = {
    totalArea: 156780,
    occupationRate: 23.5,
    activePlayers: 1247,
    yourRank: 42,
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0f1a]">
      {/* Header with City Theme */}
      <div
        className="relative h-56 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
        }}
      >
        {/* Pattern Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        >
          <X className="h-5 w-5" />
        </button>

        {/* City Info */}
        <div className="absolute inset-x-0 bottom-0 p-6 pt-16" style={{
          background: "linear-gradient(to top, rgba(10,15,26,1), rgba(10,15,26,0))",
        }}>
          <div className="flex items-end gap-4">
            <span className="text-5xl">{theme.icon}</span>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {getLocalizedText(theme.name, language)}
              </h1>
              <p className="text-white/70">
                {getLocalizedText(theme.description, language)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-8">
        {/* Season Banner */}
        {season && (
          <div
            className="-mt-4 mb-6 rounded-2xl border p-4"
            style={{
              borderColor: `${theme.primaryColor}40`,
              backgroundColor: `${theme.primaryColor}10`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${theme.primaryColor}30` }}
                >
                  <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
                </div>
                <div>
                  <p className="font-bold text-white">
                    {getLocalizedText(season.theme, language)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Clock className="h-3 w-3" />
                    <span>
                      {language === "zh" ? "剩余" : "Remaining"}: 65 {language === "zh" ? "天" : "days"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                  {season.bonusMultiplier}x
                </p>
                <p className="text-xs text-white/50">
                  {language === "zh" ? "积分加成" : "Points Bonus"}
                </p>
              </div>
            </div>

            {/* Season Progress */}
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-white/60">
                <span>{language === "zh" ? "赛季进度" : "Season Progress"}</span>
                <span>28%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: "28%",
                    background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                  }}
                />
              </div>
            </div>

            {/* Active Event */}
            {season.specialEvents[0] && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-yellow-400/10 px-3 py-2">
                <Zap className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-medium text-yellow-400">
                  {getLocalizedText(season.specialEvents[0].name, language)} - {season.specialEvents[0].bonus}
                </span>
              </div>
            )}
          </div>
        )}

        {/* City Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">
              {language === "zh" ? "总占领面积" : "Total Area"}
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {(cityStats.totalArea / 1000).toFixed(1)}
              <span className="ml-1 text-sm font-normal text-white/50">km²</span>
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">
              {language === "zh" ? "城市占领率" : "Occupation Rate"}
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: theme.primaryColor }}>
              {cityStats.occupationRate}%
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">
              {language === "zh" ? "活跃跑者" : "Active Runners"}
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {cityStats.activePlayers.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">
              {language === "zh" ? "你的排名" : "Your Rank"}
            </p>
            <p className="mt-1 text-2xl font-bold text-cyan-400">
              #{cityStats.yourRank}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <button
            onClick={onNavigateToLeaderboard}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20 hover:bg-white/10"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/20">
              <Trophy className="h-5 w-5 text-yellow-400" />
            </div>
            <span className="text-xs text-white">
              {language === "zh" ? "排行榜" : "Leaderboard"}
            </span>
          </button>
          <button
            onClick={() => onNavigateToChallenge?.(challenges[0]?.id)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20 hover:bg-white/10"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/20">
              <Target className="h-5 w-5 text-cyan-400" />
            </div>
            <span className="text-xs text-white">
              {language === "zh" ? "城市挑战" : "Challenges"}
            </span>
          </button>
          <button className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20 hover:bg-white/10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-400/20">
              <Star className="h-5 w-5 text-purple-400" />
            </div>
            <span className="text-xs text-white">
              {language === "zh" ? "城市成就" : "Achievements"}
            </span>
          </button>
        </div>

        {/* Featured Challenge */}
        {challenges[0] && (
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">
              {language === "zh" ? "热门挑战" : "Featured Challenge"}
            </h3>
            <div
              className="overflow-hidden rounded-2xl border"
              style={{
                borderColor: `${theme.primaryColor}30`,
                background: `linear-gradient(135deg, ${theme.primaryColor}10, transparent)`,
              }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${theme.primaryColor}20`,
                          color: theme.primaryColor,
                        }}
                      >
                        {language === "zh"
                          ? { easy: "简单", medium: "中等", hard: "困难", legendary: "传奇" }[challenges[0].difficulty]
                          : challenges[0].difficulty.toUpperCase()}
                      </span>
                      {challenges[0].seasonOnly && (
                        <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                          {language === "zh" ? "赛季限定" : "Season"}
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-bold text-white">
                      {getLocalizedText(challenges[0].title, language)}
                    </h4>
                    <p className="mt-1 text-sm text-white/60">
                      {getLocalizedText(challenges[0].description, language)}
                    </p>
                  </div>
                </div>

                {/* Rewards Preview */}
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm font-medium text-white">
                      {challenges[0].rewards.xp} XP
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400">🪙</span>
                    <span className="text-sm font-medium text-white">
                      {challenges[0].rewards.coins}
                    </span>
                  </div>
                  {challenges[0].rewards.badge && (
                    <div className="flex items-center gap-1">
                      <span className="text-purple-400">🏅</span>
                      <span className="text-sm font-medium text-white">
                        {getLocalizedText(challenges[0].rewards.badge, language)}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onNavigateToChallenge?.(challenges[0].id)}
                  className="mt-4 w-full rounded-xl py-3 text-center font-medium text-white transition-all hover:opacity-90"
                  style={{
                    background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                  }}
                >
                  {language === "zh" ? "开始挑战" : "Start Challenge"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* City Friends */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">
            {language === "zh" ? "城市好友" : "City Friends"}
          </h3>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0a0f1a] bg-white/20 text-xs font-bold text-white"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">12</p>
                <p className="text-xs text-white/50">
                  {language === "zh" ? "位好友在此城市" : "friends in this city"}
                </p>
              </div>
            </div>
            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition-all hover:bg-white/10">
              <Users className="h-4 w-4" />
              {language === "zh" ? "查看城市好友" : "View City Friends"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Export Combined City Switch Component
// ============================================================

export function CitySwitch({
  currentCityId,
  onCityChange,
  language = "zh",
}: CitySwitchProps) {
  const [showSelector, setShowSelector] = useState(false)
  const [showCityHome, setShowCityHome] = useState(false)

  return (
    <>
      <CityHeaderBadge
        cityId={currentCityId}
        onClick={() => setShowCityHome(true)}
        language={language}
      />

      <CitySelectorModal
        isOpen={showSelector}
        onClose={() => setShowSelector(false)}
        currentCityId={currentCityId}
        onCityChange={onCityChange}
        language={language}
      />

      {showCityHome && (
        <CityHomePage
          cityId={currentCityId}
          language={language}
          onClose={() => setShowCityHome(false)}
        />
      )}
    </>
  )
}
