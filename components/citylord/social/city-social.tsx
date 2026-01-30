"use client"

import { useState } from "react"
import {
  Users,
  Swords,
  MapPin,
  Trophy,
  Clock,
  ChevronRight,
  Star,
  Bell,
  X,
  Zap,
  Activity,
  MessageCircle,
} from "lucide-react"
import {
  getCityTheme,
  getLocalizedText,
  type Language,
} from "@/lib/citylord/city-config"

// ============================================================
// Friend Challenge Card
// ============================================================

interface FriendChallengeCardProps {
  friend: {
    id: string
    name: string
    avatar?: string
    level: number
    area: number
    isOnline: boolean
    lastActive?: string
  }
  language?: Language
  onChallenge?: () => void
  onViewProfile?: () => void
}

export function FriendChallengeCard({
  friend,
  language = "zh",
  onChallenge,
  onViewProfile,
}: FriendChallengeCardProps) {
  const formatArea = (area: number) => {
    if (area >= 10000) {
      return `${(area / 1000).toFixed(1)} km²`
    }
    return `${area.toLocaleString()} m²`
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20 hover:bg-white/10">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <button onClick={onViewProfile} className="relative shrink-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-xl font-bold text-white">
            {friend.avatar || friend.name[0]}
          </div>
          {/* Online Indicator */}
          {friend.isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#0a0f1a] bg-[#22c55e]" />
          )}
          {/* Level Badge */}
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400 text-[10px] font-bold text-black">
            {friend.level}
          </span>
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-white">{friend.name}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {formatArea(friend.area)}
            </span>
            {!friend.isOnline && friend.lastActive && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {friend.lastActive}
              </span>
            )}
          </div>
        </div>

        {/* Challenge Button */}
        <button
          onClick={onChallenge}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
        >
          <Swords className="h-4 w-4" />
          {language === "zh" ? "挑战" : "Challenge"}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Activity Message Feed
// ============================================================

interface ActivityMessage {
  id: string
  type: "capture" | "challenge" | "achievement" | "rank"
  user: {
    name: string
    avatar?: string
  }
  cityId?: string
  content: {
    zh: string
    en: string
  }
  timestamp: string
}

interface ActivityFeedProps {
  messages: ActivityMessage[]
  language?: Language
  onMessageClick?: (message: ActivityMessage) => void
}

export function ActivityFeed({
  messages,
  language = "zh",
  onMessageClick,
}: ActivityFeedProps) {
  const getTypeIcon = (type: ActivityMessage["type"]) => {
    switch (type) {
      case "capture":
        return <MapPin className="h-4 w-4 text-[#22c55e]" />
      case "challenge":
        return <Swords className="h-4 w-4 text-orange-400" />
      case "achievement":
        return <Trophy className="h-4 w-4 text-yellow-400" />
      case "rank":
        return <Star className="h-4 w-4 text-purple-400" />
    }
  }

  const getTypeBg = (type: ActivityMessage["type"]) => {
    switch (type) {
      case "capture":
        return "bg-[#22c55e]/20"
      case "challenge":
        return "bg-orange-400/20"
      case "achievement":
        return "bg-yellow-400/20"
      case "rank":
        return "bg-purple-400/20"
    }
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const cityTheme = message.cityId ? getCityTheme(message.cityId) : null

        return (
          <button
            key={message.id}
            onClick={() => onMessageClick?.(message)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-white/20 hover:bg-white/10"
          >
            <div className="flex items-start gap-3">
              {/* Avatar with type indicator */}
              <div className="relative shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-bold text-white">
                  {message.user.avatar || message.user.name[0]}
                </div>
                <span
                  className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ${getTypeBg(message.type)}`}
                >
                  {getTypeIcon(message.type)}
                </span>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">
                  <span className="font-bold text-cyan-400">{message.user.name}</span>{" "}
                  {getLocalizedText(message.content, language)}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                  {cityTheme && (
                    <span className="flex items-center gap-1">
                      <span>{cityTheme.icon}</span>
                      {getLocalizedText(cityTheme.name, language)}
                    </span>
                  )}
                  <span>{message.timestamp}</span>
                </div>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// Activity Reminder Popup
// ============================================================

interface ActivityReminderProps {
  isOpen: boolean
  onClose: () => void
  onJoin?: () => void
  activity: {
    title: { zh: string; en: string }
    description: { zh: string; en: string }
    startTime: string
    cityId: string
    rewards?: {
      xp: number
      coins: number
    }
  }
  language?: Language
}

export function ActivityReminderPopup({
  isOpen,
  onClose,
  onJoin,
  activity,
  language = "zh",
}: ActivityReminderProps) {
  const theme = getCityTheme(activity.cityId)

  if (!isOpen || !theme) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Popup */}
      <div className="relative w-full max-w-sm animate-scale-in overflow-hidden rounded-3xl bg-[#0f172a]">
        {/* Header */}
        <div
          className="relative overflow-hidden p-6 text-center"
          style={{
            background: `linear-gradient(135deg, ${theme.gradientFrom}60, ${theme.gradientTo}60)`,
          }}
        >
          <div className="absolute inset-0 bg-black/20" />
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <Bell className="relative mx-auto mb-3 h-12 w-12 animate-bounce text-white" />
          <h2 className="relative text-xl font-bold text-white">
            {getLocalizedText(activity.title, language)}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="mb-4 text-center text-white/70">
            {getLocalizedText(activity.description, language)}
          </p>

          {/* Start Time */}
          <div className="mb-4 rounded-xl bg-white/5 p-4 text-center">
            <p className="mb-1 text-xs text-white/50">
              {language === "zh" ? "开始时间" : "Start Time"}
            </p>
            <p className="text-lg font-bold text-white">{activity.startTime}</p>
          </div>

          {/* Rewards */}
          {activity.rewards && (
            <div className="mb-6 flex justify-center gap-4">
              <div className="flex items-center gap-2 rounded-xl bg-cyan-400/10 px-4 py-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                <span className="font-bold text-white">{activity.rewards.xp} XP</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-yellow-400/10 px-4 py-2">
                <span className="text-yellow-400">🪙</span>
                <span className="font-bold text-white">{activity.rewards.coins}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/20 bg-white/5 py-3 font-medium text-white transition-all hover:bg-white/10"
            >
              {language === "zh" ? "稍后提醒" : "Remind Later"}
            </button>
            <button
              onClick={onJoin}
              className="flex-1 rounded-xl py-3 font-medium text-white transition-all hover:opacity-90"
              style={{
                background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
              }}
            >
              {language === "zh" ? "立即参与" : "Join Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// City Friend Recommendation Card
// ============================================================

interface RecommendedFriendProps {
  friend: {
    id: string
    name: string
    avatar?: string
    level: number
    distance: number // in km
    area: number
    achievements: number
    activityScore: "high" | "medium" | "low"
    mutualFriends: number
    cityId: string
  }
  language?: Language
  onAdd?: () => void
  onViewProfile?: () => void
}

export function CityFriendRecommendation({
  friend,
  language = "zh",
  onAdd,
  onViewProfile,
}: RecommendedFriendProps) {
  const theme = getCityTheme(friend.cityId)

  const formatArea = (area: number) => {
    if (area >= 10000) {
      return `${(area / 1000).toFixed(1)} km²`
    }
    return `${area.toLocaleString()} m²`
  }

  const activityLabels = {
    high: { zh: "非常活跃", en: "Very Active", color: "text-[#22c55e]", bg: "bg-[#22c55e]/20" },
    medium: { zh: "较为活跃", en: "Active", color: "text-yellow-400", bg: "bg-yellow-400/20" },
    low: { zh: "偶尔在线", en: "Occasional", color: "text-white/50", bg: "bg-white/10" },
  }

  const activityInfo = activityLabels[friend.activityScore]

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <button onClick={onViewProfile} className="relative shrink-0">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
            style={{
              background: theme
                ? `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`
                : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            }}
          >
            {friend.avatar || friend.name[0]}
          </div>
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400 text-[10px] font-bold text-black">
            {friend.level}
          </span>
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-bold text-white">{friend.name}</p>
            {theme && <span className="text-sm">{theme.icon}</span>}
          </div>

          {/* Stats */}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {friend.distance.toFixed(1)} km
            </span>
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {formatArea(friend.area)}
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              {friend.achievements} {language === "zh" ? "成就" : "achievements"}
            </span>
          </div>

          {/* Tags */}
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${activityInfo.bg} ${activityInfo.color}`}>
              {activityInfo[language]}
            </span>
            {friend.mutualFriends > 0 && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                {friend.mutualFriends} {language === "zh" ? "位共同好友" : "mutual friends"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Add Button */}
      <button
        onClick={onAdd}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 py-2.5 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-400/20"
      >
        <Users className="h-4 w-4" />
        {language === "zh" ? "添加好友" : "Add Friend"}
      </button>
    </div>
  )
}
