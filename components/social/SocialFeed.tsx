"use client"

import React, { useState, useEffect } from "react"
import { MapPin, Trophy, Zap, Award, X, Minus } from "lucide-react"
import { useCity } from "@/contexts/CityContext"
import { useShallow } from "zustand/react/shallow"
import { useGameStore } from "@/store/useGameStore"
import { fetchFriendActivities, type FriendActivity } from "@/app/actions/social"

export interface SocialFeedItem {
  id: string
  userId: string
  userName: string
  userAvatar: string
  userLevel: number
  action: "capture" | "achievement" | "challenge" | "levelup"
  actionText: string
  description?: string
  stats?: { label: string; value: string }[]
  location?: string
  timestamp: Date
  cityName?: string
}

export interface SocialFeedProps {
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right"
  maxItems?: number
  autoScroll?: boolean
  scrollInterval?: number
  onDismiss?: () => void
  onCollapse?: () => void
}

export function SocialFeed({
  position = "bottom-left",
  maxItems = 3,
  autoScroll = true,
  scrollInterval = 4000,
  onDismiss,
  onCollapse,
}: SocialFeedProps) {
  const [visible, setVisible] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [currentItemIndex, setCurrentItemIndex] = useState(0)
  const [feedItems, setFeedItems] = useState<SocialFeedItem[]>([])
  const { currentCity } = useCity()
  // Use selector to avoid re-renders on every store update
  const touchActivity = useGameStore(useShallow(state => state.touchActivity))

  useEffect(() => {
    // Heartbeat: update activity status
    touchActivity().catch((e) => {
        // Ignore abort errors during navigation/unmount
        if (e?.name !== 'AbortError' && e?.digest !== 'NEXT_REDIRECT') {
          console.error(e)
        }
    })
  }, [touchActivity])

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const activities = await fetchFriendActivities()
        
        // Transform FriendActivity to SocialFeedItem
        const items: SocialFeedItem[] = activities.map(act => {
            return {
                id: act.id,
                userId: act.user.id, 
                userName: act.user.name,
                userAvatar: act.user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${act.user.name}`,
                userLevel: act.user.level,
                action: act.type as SocialFeedItem['action'],
                actionText: act.content.title,
                description: act.content.description,
                stats: act.content.stats,
                location: act.content.location,
                timestamp: new Date(act.timestamp),
                cityName: currentCity?.name
            }
        })

        setFeedItems(items)
      } catch (error) {
        console.error("Failed to load social feed:", error)
      }
    }

    loadActivities()
  }, [currentCity])

  const positionClasses = {
    "bottom-left": "left-4 bottom-24",
    "bottom-right": "right-4 bottom-24",
    "top-left": "left-4 top-28",
    "top-right": "right-4 top-28",
  }

  // 自动滚动
  useEffect(() => {
    if (!autoScroll || collapsed || feedItems.length === 0) return

    const interval = setInterval(() => {
      setCurrentItemIndex((prev) => (prev + 1) % feedItems.length)
    }, scrollInterval)

    return () => clearInterval(interval)
  }, [autoScroll, scrollInterval, collapsed, feedItems.length])

  // 手动滑动
  const handleSwipe = (direction: "left" | "right") => {
    if (feedItems.length === 0) return
    if (direction === "left") {
      setCurrentItemIndex((prev) => (prev + 1) % feedItems.length)
    } else {
      setCurrentItemIndex((prev) => (prev - 1 + feedItems.length) % feedItems.length)
    }
  }

  const getActionIcon = (action: SocialFeedItem["action"]) => {
    switch (action) {
      case "capture":
        return <MapPin className="h-4 w-4" />
      case "achievement":
        return <Award className="h-4 w-4" />
      case "challenge":
        return <Trophy className="h-4 w-4" />
      case "levelup":
        return <Zap className="h-4 w-4" />
    }
  }

  const getActionColor = (action: SocialFeedItem["action"]) => {
    switch (action) {
      case "capture":
        return "from-red-500/20 to-orange-500/10"
      case "achievement":
        return "from-yellow-500/20 to-amber-500/10"
      case "challenge":
        return "from-purple-500/20 to-pink-500/10"
      case "levelup":
        return "from-blue-500/20 to-cyan-500/10"
    }
  }

  const getTimeAgo = (timestamp: Date) => {
    const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000)
    if (seconds < 60) return "刚刚"
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`
    return `${Math.floor(seconds / 3600)}小时前`
  }

  const getCurrentItems = () => {
    if (collapsed || feedItems.length === 0) return []
    const items = [...feedItems].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    return items.slice(0, maxItems)
  }

  if (!visible || feedItems.length === 0) return null

  const items = getCurrentItems()
  const currentItem = items[currentItemIndex]

  if (!currentItem) return null

  return (
    <div
      className={`fixed ${positionClasses[position]} z-[60] w-[calc(100%-2rem)] max-w-sm transition-all duration-300`}
    >
      <div className="relative space-y-2">
        {/* 折叠按钮 */}
        <button
          onClick={() => {
            setCollapsed(!collapsed)
            onCollapse?.()
          }}
          className="absolute -top-10 right-0 rounded-lg bg-white/10 p-1.5 text-white/60 backdrop-blur-md hover:bg-white/20"
        >
          <Minus className="h-3 w-3" />
        </button>

        {/* 关闭按钮 */}
        <button
          onClick={() => {
            setVisible(false)
            onDismiss?.()
          }}
          className="absolute -top-10 right-8 rounded-lg bg-white/10 p-1.5 text-white/60 backdrop-blur-md hover:bg-white/20"
        >
          <X className="h-3 w-3" />
        </button>

        {!collapsed && currentItem && (
          <div
            key={currentItem.id}
            className="overflow-hidden rounded-2xl bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-xl border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            {/* 内容 */}
            <div className={`relative overflow-hidden bg-gradient-to-br ${getActionColor(currentItem.action)} p-3`}>
              {/* 动态背景光效 */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background: `radial-gradient(circle at top right, ${currentCity?.themeColors.primary}, transparent 50%)`,
                }}
              />

              {/* 用户信息 */}
              <div className="relative flex items-start gap-3">
                {/* 头像 */}
                <div className="relative flex-shrink-0">
                  <img
                    src={currentItem.userAvatar}
                    alt={currentItem.userName}
                    className="h-10 w-10 rounded-full border-2 border-white/20"
                  />
                  {/* 等级徽章 */}
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg">
                    {currentItem.userLevel}
                  </div>
                </div>

                {/* 动态内容 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 truncate">
                    <span className="font-semibold text-white">{currentItem.userName}</span>
                    <span className="mx-1">{currentItem.actionText}</span>
                  </p>
                  
                  {currentItem.description && (
                      <p className="text-[10px] text-white/60 truncate">{currentItem.description}</p>
                  )}
                  {currentItem.stats && currentItem.stats.length > 0 && (
                      <div className="flex gap-2 mt-0.5">
                          {currentItem.stats.map((s, i) => (
                              <span key={i} className="text-[10px] bg-white/10 px-1 rounded text-white/80">
                                  {s.label}: {s.value}
                              </span>
                          ))}
                      </div>
                  )}

                  {/* 时间和位置 */}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-white/50">
                    <span>{getTimeAgo(currentItem.timestamp)}</span>
                    {currentItem.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {currentItem.location}
                      </span>
                    )}
                  </div>
                </div>

                {/* 动作图标 */}
                <div
                  className="flex-shrink-0 rounded-full p-1.5"
                  style={{
                    backgroundColor: `${currentCity?.themeColors.primary}40`,
                    color: currentCity?.themeColors.primary,
                  }}
                >
                  {getActionIcon(currentItem.action)}
                </div>
              </div>
            </div>

            {/* 进度指示器 */}
            {items.length > 1 && (
              <div className="flex justify-center gap-1.5 p-2">
                {items.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      index === currentItemIndex
                        ? "w-4 bg-white"
                        : "w-1 bg-white/30"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
