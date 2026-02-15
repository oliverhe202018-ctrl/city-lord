"use client"

import { Map, Trophy, User, Target, Users, Gamepad2 } from "lucide-react"
import { useGameStore } from "@/store/useGameStore"
import { useEffect } from "react"

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const getUnreadMessageCount = async () => {
  const res = await fetchWithTimeout('/api/message/get-unread-message-count', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch unread message count')
  const data = await res.json()
  return data?.count || 0
}


export type TabType = "play" | "missions" | "social" | "profile" | "leaderboard" | "mode"

interface BottomNavProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const unreadMessageCount = useGameStore((state) => state.unreadMessageCount)
  const setUnreadMessageCount = useGameStore((state) => state.setUnreadMessageCount)

  useEffect(() => {
    // Initial fetch
    getUnreadMessageCount().then(setUnreadMessageCount)
    
    // Optional: Poll every 30 seconds
    const interval = setInterval(() => {
      getUnreadMessageCount().then(setUnreadMessageCount)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [setUnreadMessageCount])

  const tabs = [
    { id: "play" as const, icon: Map, label: "地图" },
    { id: "missions" as const, icon: Target, label: "任务" },
    { id: "social" as const, icon: Users, label: "好友", badge: unreadMessageCount },
    { id: "profile" as const, icon: User, label: "个人" },
  ]

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-[1000] border-t border-border bg-background/80 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1 transition-all"
            >
              <div
                className={`relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all ${
                  isActive ? "bg-primary/20" : "bg-transparent"
                }`}
              >
                <Icon
                  className={`h-5 w-5 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />

                {/* Badge */}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-lg">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] font-semibold transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
