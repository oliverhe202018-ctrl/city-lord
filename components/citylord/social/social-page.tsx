"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Users,
  Activity,
  UserPlus,
  Search,
  Trophy,
  Swords,
  ChevronRight
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

export function SocialPage({ onShowDemo }: SocialPageProps) {
  const [activeTab, setActiveTab] = useState<SocialTab>("friends")
  const [subView, setSubView] = useState<SubView>("none")
  const [selectedFriend, setSelectedFriend] = useState<{
    id: string
    name: string
    level: number
    avatar?: string
  } | undefined>()

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
        <div className="flex gap-4 border-b border-white/5">
          <button
            onClick={() => setActiveTab("friends")}
            className={`pb-2 text-sm font-medium transition-all ${
              activeTab === "friends"
                ? "border-b-2 border-[#39ff14] text-[#39ff14]"
                : "text-white/60 hover:text-white"
            }`}
          >
            好友列表
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`pb-2 text-sm font-medium transition-all ${
              activeTab === "activity"
                ? "border-b-2 border-[#39ff14] text-[#39ff14]"
                : "text-white/60 hover:text-white"
            }`}
          >
            动态圈
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`pb-2 text-sm font-medium transition-all ${
              activeTab === "messages"
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
