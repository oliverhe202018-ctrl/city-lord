"use client"

import React, { useState, useEffect } from "react"
import { MapPin, Trophy, Zap, Award, X, Minus } from "lucide-react"
import { useCity } from "@/contexts/CityContext"

export interface SocialFeedItem {
  id: string
  userId: string
  userName: string
  userAvatar: string
  userLevel: number
  action: "capture" | "achievement" | "challenge" | "levelup"
  actionText: string
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

const mockFeedItems: SocialFeedItem[] = [
  {
    id: "1",
    userId: "user1",
    userName: "小明",
    userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=xiaoming",
    userLevel: 15,
    action: "capture",
    actionText: "刚刚占领了",
    location: "海淀公园",
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: "2",
    userId: "user2",
    userName: "运动达人",
    userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=runner",
    userLevel: 23,
    action: "achievement",
    actionText: "解锁了成就",
    cityName: "北京",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: "3",
    userId: "user3",
    userName: "探险家",
    userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=explorer",
    userLevel: 18,
    action: "challenge",
    actionText: "完成了挑战",
    location: "故宫征服者",
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
  },
  {
    id: "4",
    userId: "user4",
    userName: "夜跑王",
    userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=nightrunner",
    userLevel: 31,
    action: "levelup",
    actionText: "升到了等级",
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
  },
  {
    id: "5",
    userId: "user5",
    userName: "城市征服者",
    userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=conqueror",
    userLevel: 42,
    action: "capture",
    actionText: "刚刚占领了",
    location: "外滩观景台",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
  },
]

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
  const { currentCity } = useCity()

  const positionClasses = {
    "bottom-left": "left-4 bottom-24",
    "bottom-right": "right-4 bottom-24",
    "top-left": "left-4 top-28",
    "top-right": "right-4 top-28",
  }

  // 自动滚动
  useEffect(() => {
    if (!autoScroll || collapsed) return

    const interval = setInterval(() => {
      setCurrentItemIndex((prev) => (prev + 1) % mockFeedItems.length)
    }, scrollInterval)

    return () => clearInterval(interval)
  }, [autoScroll, scrollInterval, collapsed])

  // 手动滑动
  const handleSwipe = (direction: "left" | "right") => {
    if (direction === "left") {
      setCurrentItemIndex((prev) => (prev + 1) % mockFeedItems.length)
    } else {
      setCurrentItemIndex((prev) => (prev - 1 + mockFeedItems.length) % mockFeedItems.length)
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
    if (collapsed) return []
    const items = [...mockFeedItems].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    return items.slice(0, maxItems)
  }

  if (!visible) return null

  const items = getCurrentItems()
  const currentItem = items[currentItemIndex]

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
                    {currentItem.action === "capture" && currentItem.location && (
                      <span className="font-semibold text-white">{currentItem.location}</span>
                    )}
                    {currentItem.action === "achievement" && currentItem.cityName && (
                      <span className="font-semibold text-white">{currentItem.cityName}</span>
                    )}
                    {currentItem.action === "challenge" && currentItem.location && (
                      <span className="font-semibold text-white">{currentItem.location}</span>
                    )}
                    {currentItem.action === "levelup" && (
                      <span className="font-semibold text-white">{currentItem.userLevel}</span>
                    )}
                  </p>

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
