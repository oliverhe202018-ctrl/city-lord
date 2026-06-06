"use client"

import React from "react"
import { useCity } from '@/contexts/CityContext'
import { Sparkles, Clock, TrendingUp, X } from 'lucide-react'

/**
 * 城市活动类型
 */
interface CityActivity {
  id: string
  type: "double_reward" | "special_event" | "season_start" | "holiday"
  title: string
  description: string
  icon: string
  theme: {
    primary: string
    secondary: string
  }
  endTime: string
  badge?: string
}

/**
 * 获取城市专属活动
 */
function getCityActivities(cityId: string): CityActivity[] {
  const activities: Record<string, CityActivity[]> = {
    beijing: [
      {
        id: "bj-001",
        type: "double_reward",
        title: "故宫征服双倍奖励",
        description: "本周在故宫区域占领六边形，经验值和积分翻倍！",
        icon: "🏯",
        theme: {
          primary: "#dc2626",
          secondary: "#fca5a5",
        },
        endTime: "2025-02-02T23:59:59",
        badge: "限时",
      },
    ],
    shanghai: [
      {
        id: "sh-001",
        type: "special_event",
        title: "外滩夜景征服挑战",
        description: "夜间 20:00-22:00 在外滩区域跑步，获得额外积分奖励！",
        icon: "🌃",
        theme: {
          primary: "#2563eb",
          secondary: "#93c5fd",
        },
        endTime: "2025-02-15T23:59:59",
        badge: "活动",
      },
    ],
    chengdu: [
      {
        id: "cd-001",
        type: "double_reward",
        title: "火锅能量双倍活动",
        description: "本周在成都市区征服领地，获得双倍火锅能量积分！",
        icon: "🍲",
        theme: {
          primary: "#22c55e",
          secondary: "#86efac",
        },
        endTime: "2025-02-02T23:59:59",
        badge: "热门",
      },
    ],
    guangzhou: [
      {
        id: "gz-001",
        type: "holiday",
        title: "岭南文化周",
        description: "探索广州历史遗迹，解锁专属成就和徽章！",
        icon: "🏮",
        theme: {
          primary: "#eab308",
          secondary: "#fde047",
        },
        endTime: "2025-02-08T23:59:59",
        badge: "限时",
      },
    ],
  }

  return activities[cityId] || []
}

/**
 * 计算剩余时间
 */
function calculateRemainingTime(endTime: string): { hours: number; minutes: number; isExpired: boolean } {
  const end = new Date(endTime)
  const now = new Date()
  const diff = end.getTime() - now.getTime()

  if (diff <= 0) {
    return { hours: 0, minutes: 0, isExpired: true }
  }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return { hours, minutes, isExpired: false }
}

/**
 * 城市活动横幅组件
 */
export function CityActivityBanner() {
  const { currentCity } = useCity()
  const [dismissedActivities, setDismissedActivities] = React.useState<Set<string>>(new Set())

  // 从本地存储加载已关闭的活动
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("dismissedActivities")
      if (saved) {
        setDismissedActivities(new Set(JSON.parse(saved)))
      }
    } catch (error) {
      console.error("Failed to load dismissed activities:", error)
    }
  }, [])

  const handleDismiss = (activityId: string) => {
    setDismissedActivities((prev) => {
      const newSet = new Set(prev).add(activityId)
      localStorage.setItem("dismissedActivities", JSON.stringify([...newSet]))
      return newSet
    })
  }

  if (!currentCity) return null

  const activities = getCityActivities(currentCity.id)
  const activeActivities = activities.filter(
    (activity) => !dismissedActivities.has(activity.id) && !calculateRemainingTime(activity.endTime).isExpired
  )

  if (activeActivities.length === 0) return null

  return (
    <div className="fixed top-[88px] left-4 right-4 z-[90] space-y-2">
      {activeActivities.map((activity) => {
        const { hours, minutes } = calculateRemainingTime(activity.endTime)
        const isUrgent = hours < 24

        return (
          <div
            key={activity.id}
            className="relative p-4 rounded-2xl border backdrop-blur-xl overflow-hidden animate-in slide-in-from-top-4 fade-in duration-500"
            style={{
              background: `linear-gradient(135deg, ${activity.theme.primary}15 0%, ${activity.theme.secondary}10 100%)`,
              borderColor: `${activity.theme.primary}30`,
            }}
          >
            {/* 装饰背景 */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
              <div className="absolute inset-0" style={{ background: `radial-gradient(circle at center, ${activity.theme.primary} 0%, transparent 70%)` }} />
            </div>

            {/* 主要内容 */}
            <div className="relative flex items-start gap-3">
              {/* 图标 */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: `${activity.theme.primary}25` }}
              >
                {activity.icon}
              </div>

              {/* 文字内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white">{activity.title}</h3>
                  {activity.badge && (
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold rounded-full"
                      style={{
                        background: `${activity.theme.primary}30`,
                        color: activity.theme.primary,
                      }}
                    >
                      {activity.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/70 leading-relaxed mb-2">{activity.description}</p>

                {/* 剩余时间 */}
                <div className="flex items-center gap-1.5">
                  <Clock className={`w-3 h-3 ${isUrgent ? "text-red-400 animate-pulse" : "text-white/50"}`} />
                  <span className={`text-[10px] ${isUrgent ? "text-red-400 font-medium" : "text-white/50"}`}>
                    剩余 {hours} 小时 {minutes} 分钟
                  </span>
                  {isUrgent && (
                    <span className="px-1.5 py-0.5 text-[9px] font-medium bg-red-500/20 text-red-400 rounded animate-pulse">
                      即将结束
                    </span>
                  )}
                </div>
              </div>

              {/* 关闭按钮 */}
              <button
                onClick={() => handleDismiss(activity.id)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-white/40 hover:text-white/60" />
              </button>
            </div>

            {/* 底部进度条 */}
            {isUrgent && (
              <div className="relative mt-3">
                <div className="h-0.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full animate-[shrink_1h_linear]"
                    style={{
                      width: `${(hours * 60 + minutes) / (24 * 60) * 100}%`,
                      background: `linear-gradient(90deg, ${activity.theme.primary}, ${activity.theme.secondary})`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
