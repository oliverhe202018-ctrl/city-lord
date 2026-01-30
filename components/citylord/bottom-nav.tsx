"use client"

import { Map, Trophy, User, Target, Users, Gamepad2 } from "lucide-react"
import { useGameStore } from "@/store/useGameStore"
import { useEffect } from "react"
import { getUnreadMessageCount } from "@/app/actions/message"

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
    <nav className="absolute bottom-0 left-0 right-0 z-[1000] border-t border-white/10 bg-black/80 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 pb-2 pt-3">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center gap-1 px-3 py-1 transition-all"
            >
              <div
                className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
                  isActive ? "bg-[#22c55e]/20" : "bg-transparent"
                }`}
              >
                <Icon
                  className={`h-6 w-6 transition-colors ${
                    isActive ? "text-[#22c55e]" : "text-white/40"
                  }`}
                />

                {/* Badge */}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[11px] font-semibold transition-colors ${
                  isActive ? "text-[#22c55e]" : "text-white/40"
                }`}
              >
                {tab.label}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
