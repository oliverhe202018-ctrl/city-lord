"use client"

import { useHydration } from "@/hooks/useHydration"
import { createClient } from "@/lib/supabase/client"
import React, { useState, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Users,
  Activity,
  UserPlus,
  Search,
  Trophy,
  Swords,
  ChevronRight,
  LogIn
} from "lucide-react"
import { FriendsList } from "./friends-list"
import { ChallengePage } from "./challenge-page"
import { FriendActivityFeed } from "../friend-activity-feed"
import { RecommendedFriends } from "./recommended-friends"
import { InviteFriends } from "./invite-friends"
import { GlassCard } from "@/components/ui/GlassCard"
import { CyberButton } from "@/components/ui/CyberButton"

import { MessageList } from "./message-list"

type SocialTab = "friends" | "activity" | "messages"
type SubView = "none" | "invite" | "discover" | "challenge"

interface SocialPageProps {
  onShowDemo?: (type: "territory" | "challenge" | "achievement") => void
}

export function SocialPage({ onShowDemo, initialFriends, initialRequests }: SocialPageProps) {
  const [activeTab, setActiveTab] = useState<SocialTab>("friends")
  const [activityFilter, setActivityFilter] = useState<"friends" | "all">("friends")
  const [subView, setSubView] = useState<SubView>("none")
  const [selectedFriend, setSelectedFriend] = useState<{
    id: string
    name: string
    level: number
    avatar?: string | null
  } | undefined>()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const hydrated = useHydration()

  React.useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient()
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error("Auth check error:", error)
          setIsLoggedIn(false)
          setLoading(false)
        } else if (session?.user) {
          setIsLoggedIn(true)
          setLoading(false)
        } else {
          // Retry logic
          setTimeout(async () => {
             const { data: { session: retrySession } } = await supabase.auth.getSession()
             if (retrySession?.user) {
                setIsLoggedIn(true)
             } else {
                setIsLoggedIn(false)
             }
             setLoading(false)
          }, 1000)
        }
      } catch (err) {
        console.error("Auth check exception:", err)
        setIsLoggedIn(false)
        setLoading(false)
      }
    }

    if (hydrated) {
      checkAuth()
    }
  }, [hydrated])

  const handleBack = () => {
    setSubView("none")
    setSelectedFriend(undefined)
  }

  const [hasMoreActivities, setHasMoreActivities] = useState(true)

  const handleLoadMoreActivities = async () => {
    // Simulate loading
    await new Promise(resolve => setTimeout(resolve, 1500))
    // For demo, we just say it's the end after one load
    setHasMoreActivities(false)
    toast.success("所有动态已加载")
  }

  if (!hydrated) return null

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-[#1a1a1a] text-white/60">加载中...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 pt-20 space-y-6">
        <div className="relative w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border-2 border-white/10">
          <LogIn className="w-10 h-10 text-white/30" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white">未登录</h2>
          <p className="text-sm text-white/50">登录后查看您的好友、消息等数据</p>
        </div>

        <Link href="/login" className="w-full max-w-xs block">
          <div className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold h-12 rounded-full flex items-center justify-center uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:shadow-[0_0_25px_rgba(34,197,94,0.6)] border border-[#22c55e]/50">
            立即登录 / 注册
          </div>
        </Link>
      </div>
    )
  }

  // Render Sub-views (Full screen overlay style or nested)
  if (subView === "invite") {
    return (
      <div className="flex h-full flex-col bg-[#0f172a]">
        <div className="p-4 border-b border-white/10 flex items-center gap-2 shrink-0">
          <CyberButton variant="ghost" size="sm" onClick={handleBack} className="rotate-180">
            <ChevronRight />
          </CyberButton>
          <h2 className="text-lg font-bold text-white">邀请好友</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <InviteFriends
            inviteCode="CITY2025"
            inviteLink="https://citylord.app/invite/CITY2025"
            invitedCount={3}
          />
        </div>
      </div>
    )
  }

  if (subView === "discover") {
    return (
      <div className="flex h-full flex-col bg-[#0f172a]">
        <div className="p-4 border-b border-white/10 flex items-center gap-2 shrink-0">
          <CyberButton variant="ghost" size="sm" onClick={handleBack} className="rotate-180">
            <ChevronRight />
          </CyberButton>
          <h2 className="text-lg font-bold text-white">发现跑友</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <RecommendedFriends />
        </div>
      </div>
    )
  }

  if (subView === "challenge") {
    return (
      <div className="flex h-full flex-col bg-[#0f172a]">
        <div className="p-4 border-b border-white/10 flex items-center gap-2 shrink-0">
          <CyberButton variant="ghost" size="sm" onClick={handleBack} className="rotate-180">
            <ChevronRight />
          </CyberButton>
          <h2 className="text-lg font-bold text-white">发起挑战</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <ChallengePage
            selectedFriend={selectedFriend}
            onSendChallenge={(type, options) => {
              console.log("Challenge sent:", type, options)
              handleBack()
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#0f172a]">
      {/* Header */}
      <div className="border-b border-white/10 px-4 pb-2 pt-6 shrink-0">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">社交中心</h1>
            <p className="text-sm text-white/60">City Lord Social</p>
          </div>
        </div>

        {/* Main Tab Bar - Simplified */}
        <div className="grid w-full grid-cols-3 border-b border-white/5">
          <button
            onClick={() => setActiveTab("friends")}
            className={`flex flex-col items-center justify-center pb-2 text-sm font-medium transition-all ${activeTab === "friends"
                ? "border-b-2 border-[#39ff14] text-[#39ff14]"
                : "text-white/60 hover:text-white"
              }`}
          >
            好友列表
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`flex flex-col items-center justify-center pb-2 text-sm font-medium transition-all ${activeTab === "activity"
                ? "border-b-2 border-[#39ff14] text-[#39ff14]"
                : "text-white/60 hover:text-white"
              }`}
          >
            动态圈
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`flex flex-col items-center justify-center pb-2 text-sm font-medium transition-all ${activeTab === "messages"
                ? "border-b-2 border-[#39ff14] text-[#39ff14]"
                : "text-white/60 hover:text-white"
              }`}
          >
            消息
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">

        {activeTab === "friends" && (
          <div className="space-y-4">
            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-3">
              <GlassCard
                className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 active:scale-95 transition-all"
                onClick={() => setSubView("invite")}
              >
                <div className="h-10 w-10 rounded-full bg-[#39ff14]/20 flex items-center justify-center text-[#39ff14]">
                  <UserPlus size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">邀请好友</div>
                  <div className="text-[10px] text-white/50">获得奖励</div>
                </div>
              </GlassCard>
              <GlassCard
                className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 active:scale-95 transition-all"
                onClick={() => setSubView("discover")}
              >
                <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-500">
                  <Search size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">发现跑友</div>
                  <div className="text-[10px] text-white/50">附近的人</div>
                </div>
              </GlassCard>
            </div>

            {/* Friends List */}
            <FriendsList
              initialFriends={initialFriends}
              initialRequests={initialRequests}
              onSelectFriend={(friend) => setSelectedFriend(friend)}
              onChallenge={(friend) => {
                setSelectedFriend(friend)
                setSubView("challenge")
              }}
              onMessage={(friend) => {
                setSelectedFriend(friend)
                setActiveTab("messages")
              }}
            />
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-4">
            {/* Activity Sub-tabs */}
            <div className="grid w-full grid-cols-2 rounded-lg bg-white/5 p-1">
              <button
                onClick={() => setActivityFilter("friends")}
                className={`rounded-md py-1.5 text-xs font-medium transition-all ${activityFilter === "friends"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/50 hover:text-white"
                  }`}
              >
                好友动态
              </button>
              <button
                onClick={() => setActivityFilter("all")}
                className={`rounded-md py-1.5 text-xs font-medium transition-all ${activityFilter === "all"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/50 hover:text-white"
                  }`}
              >
                所有动态
              </button>
            </div>

            <FriendActivityFeed />
          </div>
        )}

        {activeTab === "messages" && (
          <div className="space-y-4">
            <MessageList initialFriendId={selectedFriend?.id} />
          </div>
        )}
      </div>
    </div>
  )
}
