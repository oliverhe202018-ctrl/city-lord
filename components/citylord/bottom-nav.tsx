"use client"

import { Map, Trophy, User, Target, Users, Gamepad2 } from "lucide-react"
import { useGameStore, useGameActions } from "@/store/useGameStore"
import { useEffect } from "react"
import { motion } from "framer-motion"
import { getUnreadSocialCount } from "@/app/actions/social-hub"
import { getUnreadMessageCount } from "@/app/actions/message"




export type TabType = "play" | "missions" | "social" | "profile" | "leaderboard" | "mode"

interface BottomNavProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const unreadMessageCount = useGameStore((state) => state.unreadMessageCount)
  const setUnreadMessageCount = useGameStore((state) => state.setUnreadMessageCount)
  const unreadSocialCount = useGameStore((state) => state.unreadSocialCount)
  const setUnreadSocialCount = useGameStore((state) => state.setUnreadSocialCount)
  const { closeDrawer } = useGameActions()

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const msgRes = await getUnreadMessageCount()
        setUnreadMessageCount(msgRes)

        const socialRes = await getUnreadSocialCount()
        if (socialRes.success) setUnreadSocialCount(socialRes.count || 0)
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
  }, [setUnreadMessageCount, setUnreadSocialCount])

  const tabs = [
    { id: "play" as const, icon: Map, label: "地图" },
    { id: "missions" as const, icon: Target, label: "任务" },
    { id: "social" as const, icon: Users, label: "社交", badge: unreadMessageCount + unreadSocialCount },
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
              onClick={() => {
                closeDrawer()
                onTabChange(tab.id)
              }}
              className="group relative flex flex-col items-center gap-0.5 px-3 py-1 transition-all outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95"
            >
              <div
                className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-300 ${isActive ? "bg-primary/10 scale-110" : "bg-transparent hover:bg-white/5"
                  }`}
              >
                <Icon
                  className={`h-5 w-5 transition-colors duration-300 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground/80"
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
                className={`text-[10px] font-semibold transition-colors duration-300 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground/80"
                  }`}
              >
                {tab.label}
              </span>

              {/* Active indicator dot using framer-motion layoutId for smooth sliding */}
              {isActive && (
                <motion.span
                  layoutId="bottomNavActiveDot"
                  className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]"
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
