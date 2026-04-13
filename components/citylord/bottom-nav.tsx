"use client"

import { Map, User, Users, Home, Play } from "lucide-react"
import { useGameStore, useGameActions } from "@/store/useGameStore"
import { useEffect } from "react"
import { motion } from "framer-motion"
import { getUnreadNotificationCount } from "@/app/actions/notification"
import { getUnreadMessageCount } from "@/app/actions/message"

export type TabType = "home" | "play" | "start" | "missions" | "social" | "profile" | "leaderboard" | "mode"

interface BottomNavProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const unreadMessageCount = useGameStore((state) => state.unreadMessageCount)
  const setUnreadMessageCount = useGameStore((state) => state.setUnreadMessageCount)
  const unreadNotificationCount = useGameStore((state) => state.unreadNotificationCount)
  const setUnreadNotificationCount = useGameStore((state) => state.setUnreadNotificationCount)
  const { closeDrawer } = useGameActions()

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const msgRes = await getUnreadMessageCount()
        setUnreadMessageCount(msgRes)

        const notifCount = await getUnreadNotificationCount()
        setUnreadNotificationCount(notifCount)
      } catch (e) {
        console.error("Polling error:", e)
      }
    }

    // Initial fetch
    fetchCounts()

    // Poll every 45 seconds if page is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchCounts()
      }
    }, 45000)

    return () => clearInterval(interval)
  }, [setUnreadMessageCount, setUnreadNotificationCount])

  const tabs = [
    { id: "home" as const, icon: Home, label: "首页" },
    { id: "play" as const, icon: Map, label: "地图" },
    { id: "start" as const, icon: Play, label: "开始" },
    { id: "social" as const, icon: Users, label: "社交", badge: unreadMessageCount + unreadNotificationCount },
    { id: "profile" as const, icon: User, label: "个人" },
  ]

  return (
    <nav 
      className="absolute mx-auto bottom-0 left-0 right-0 max-w-md z-[1000] rounded-t-2xl bg-black/80 backdrop-blur-3xl border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
      style={{ height: 'calc(48px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around px-2 h-[48px]">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => {
                closeDrawer()
                onTabChange(tab.id)
              }}
              className="group relative flex flex-col items-center justify-center p-1 outline-none active:scale-90 transition-transform h-full flex-1"
            >
              <div
                className={`relative flex h-full w-full max-w-[48px] items-center justify-center rounded-xl transition-all duration-300 ${isActive ? "bg-white/10" : "bg-transparent hover:bg-white/5"
                  }`}
              >
                <Icon
                  className={`h-5 w-5 transition-colors duration-300 ${isActive ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "text-white/50 group-hover:text-white/80"
                    }`}
                />

                {/* Badge */}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-lg border border-black/80">
                    {tab.badge}
                  </span>
                )}
                
                {/* Active indicator dot using framer-motion layoutId for smooth sliding */}
                {isActive && (
                  <motion.span
                    layoutId="bottomNavActiveDot"
                    className="absolute -bottom-[6px] h-[3px] w-[12px] rounded-full bg-amber-400 shadow-[0_0_8px_hsl(var(--amber-400)/0.8)]"
                  />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
