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
  ChevronLeft,
  LogIn
} from "lucide-react"
import { FriendsList } from "./friends-list"
import { ChallengePage } from "./challenge-page"
import { FriendActivityFeed } from "../friend-activity-feed"
import { RecommendedFriends } from "./recommended-friends"
import { InviteFriends } from "./invite-friends"
import { Leaderboard } from "./leaderboard"
import { EventsPage } from "./events-page"
import { StorePage } from "./store-page"
import { GlassCard } from "@/components/ui/GlassCard"
import { CyberButton } from "@/components/ui/CyberButton"
import { CreatePostForm } from "./create-post-form"
import { markSocialAsRead } from "@/app/actions/social-hub"
import { useGameStore } from "@/store/useGameStore"

import { MessageList } from "./message-list"

type SocialTab = "friends" | "activity" | "messages"
type SubView = "none" | "invite" | "discover" | "challenge" | "leaderboard" | "events" | "store" | "friend-chat"

interface SocialPageProps {
  onShowDemo?: (type: "territory" | "challenge" | "achievement") => void
  initialFriends?: any[]
  initialRequests?: any[]
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
  const [newLocalPost, setNewLocalPost] = useState<any>(null)
  const hydrated = useHydration()
  const setUnreadSocialCount = useGameStore(state => state.setUnreadSocialCount)

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

  React.useEffect(() => {
    if (hydrated && isLoggedIn) {
      // Clear social red dot on entering social page
      markSocialAsRead().then(res => {
        if (res.success) setUnreadSocialCount(0)
      }).catch(console.error)
    }
  }, [hydrated, isLoggedIn, setUnreadSocialCount])

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
    return <div className="flex h-full items-center justify-center bg-background text-muted-foreground">加载中...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 pt-20 space-y-6 bg-background">
        <div className="relative w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center border-2 border-border">
          <LogIn className="w-10 h-10 text-muted-foreground/50" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-foreground">未登录</h2>
          <p className="text-sm text-muted-foreground">登录后查看您的好友、消息等数据</p>
        </div>

        <Link href="/login" className="w-full max-w-xs block">
          <div className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-full flex items-center justify-center uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-sm border border-primary/50">
            立即登录 / 注册
          </div>
        </Link>
      </div>
    )
  }

  // Render Sub-views (Full screen overlay style or nested)
  if (subView === "invite") {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
          <CyberButton variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-0.5 pr-3 pl-1 group">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回</span>
          </CyberButton>
          <h2 className="text-base font-bold text-foreground">邀请好友</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
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
      <div className="flex h-full flex-col bg-background">
        <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
          <CyberButton variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-0.5 pr-3 pl-1 group text-slate-900/80 hover:text-slate-900 dark:text-white/80 dark:hover:text-white">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回</span>
          </CyberButton>
          <h2 className="text-base font-bold text-foreground">发现跑友</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <RecommendedFriends />
        </div>
      </div>
    )
  }

  if (subView === "challenge") {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
          <CyberButton variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-0.5 pr-3 pl-1 group text-slate-900/80 hover:text-slate-900 dark:text-white/80 dark:hover:text-white">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回</span>
          </CyberButton>
          <h2 className="text-base font-bold text-foreground">发起挑战</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
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

  if (subView === "leaderboard") {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
          <CyberButton variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-0.5 pr-3 pl-1 group text-slate-900/80 hover:text-slate-900 dark:text-white/80 dark:hover:text-white">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回</span>
          </CyberButton>
          <h2 className="text-base font-bold text-foreground">排行榜</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <Leaderboard />
        </div>
      </div>
    )
  }

  if (subView === "events") {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
          <CyberButton variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-0.5 pr-3 pl-1 group text-slate-900/80 hover:text-slate-900 dark:text-white/80 dark:hover:text-white">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回</span>
          </CyberButton>
          <h2 className="text-base font-bold text-foreground">赛事与活动</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <EventsPage />
        </div>
      </div>
    )
  }

  if (subView === "store") {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
          <CyberButton variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-0.5 pr-3 pl-1 group text-slate-900/80 hover:text-slate-900 dark:text-white/80 dark:hover:text-white">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回</span>
          </CyberButton>
          <h2 className="text-base font-bold text-foreground">积分商城</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <StorePage />
        </div>
      </div>
    )
  }

  if (subView === "friend-chat") {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="p-3 border-b border-border flex items-center gap-2 shrink-0 bg-background/95 backdrop-blur z-10 sticky top-0">
          <button onClick={handleBack} className="flex items-center gap-0.5 pr-3 pl-1 py-1 text-foreground hover:bg-muted/50 rounded-md transition-all active:scale-95">
            <ChevronLeft className="w-5 h-5 -ml-1" />
            <span className="text-sm">返回</span>
          </button>
          <h2 className="text-base font-bold text-foreground">{selectedFriend?.name || "聊天"}</h2>
        </div>
        <div className="flex-1 overflow-hidden p-0 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <MessageList initialFriendId={selectedFriend?.id} mode="friend" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-3 pb-1 pt-3 shrink-0">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">社交中心</h1>
          </div>
        </div>

        {/* Main Tab Bar - Simplified */}
        <div className="grid w-full grid-cols-3 border-b border-border">
          <button
            onClick={() => setActiveTab("friends")}
            className={`flex flex-col items-center justify-center pb-1 text-xs font-medium transition-all ${activeTab === "friends"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            好友列表
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`flex flex-col items-center justify-center pb-1 text-xs font-medium transition-all ${activeTab === "activity"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            动态圈
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`flex flex-col items-center justify-center pb-1 text-xs font-medium transition-all ${activeTab === "messages"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            系统通知
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3">

        <div className={activeTab === "friends" ? "block space-y-4" : "hidden space-y-4"}>
          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <GlassCard
              className="p-2 flex items-center gap-2 cursor-pointer hover:bg-muted/50 active:scale-95 transition-all"
              onClick={() => setSubView("store")}
            >
              <div className="h-7 w-7 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <UserPlus size={14} />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">积分商城</div>
                <div className="text-[10px] text-muted-foreground whitespace-nowrap">商品兑换</div>
              </div>
            </GlassCard>
            <GlassCard
              className="p-2 flex items-center gap-2 cursor-pointer hover:bg-muted/50 active:scale-95 transition-all"
              onClick={() => setSubView("discover")}
            >
              <div className="h-7 w-7 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-500">
                <Search size={14} />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">发现跑友</div>
                <div className="text-[10px] text-muted-foreground whitespace-nowrap">附近的人</div>
              </div>
            </GlassCard>
            <GlassCard
              className="p-2 flex items-center gap-2 cursor-pointer hover:bg-muted/50 active:scale-95 transition-all"
              onClick={() => setSubView("leaderboard")}
            >
              <div className="h-7 w-7 shrink-0 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500">
                <Trophy size={14} />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">排行榜</div>
                <div className="text-[10px] text-muted-foreground whitespace-nowrap">全球排名</div>
              </div>
            </GlassCard>
            <GlassCard
              className="p-2 flex items-center gap-2 cursor-pointer hover:bg-muted/50 active:scale-95 transition-all"
              onClick={() => setSubView("events")}
            >
              <div className="h-7 w-7 shrink-0 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500">
                <Activity size={14} />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">赛事活动</div>
                <div className="text-[10px] text-muted-foreground whitespace-nowrap">社区奖励</div>
              </div>
            </GlassCard>
          </div>

          {/* Friends List */}
          <FriendsList
            initialFriends={initialFriends}
            initialRequests={initialRequests}
            onDiscoverFriends={() => setSubView("discover")}
            onSelectFriend={(friend) => setSelectedFriend(friend)}
            onChallenge={(friend) => {
              setSelectedFriend(friend)
              setSubView("challenge")
            }}
            onMessage={(friend) => {
              setSelectedFriend(friend)
              setSubView("friend-chat")
            }}
          />
        </div>

        <div className={activeTab === "activity" ? "block space-y-4" : "hidden space-y-4"}>
          <CreatePostForm onSuccess={(post) => setNewLocalPost(post)} />
          {/* Activity Sub-tabs */}
          <div className="grid w-full grid-cols-2 rounded-lg bg-muted p-1">
            <button
              onClick={() => setActivityFilter("friends")}
              className={`rounded-md py-1 text-xs font-medium transition-all ${activityFilter === "friends"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              好友动态
            </button>
            <button
              onClick={() => setActivityFilter("all")}
              className={`rounded-md py-1 text-xs font-medium transition-all ${activityFilter === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              所有动态
            </button>
          </div>

          <FriendActivityFeed newPost={newLocalPost} filterType={activityFilter === "all" ? "GLOBAL" : "FRIENDS"} />
        </div>

        <div className={activeTab === "messages" ? "block space-y-4" : "hidden space-y-4"}>
          {activeTab === "messages" && <MessageList mode="system" />}
        </div>
      </div>
    </div>
  )
}
