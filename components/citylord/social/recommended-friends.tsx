"use client"

import { useState } from "react"
import { 
  MapPin, 
  Trophy, 
  UserPlus, 
  Check,
  Sparkles,
  Target,
  Zap
} from "lucide-react"

interface RecommendedUser {
  id: string
  name: string
  avatar?: string
  level: number
  reason: "nearby" | "similar_level" | "similar_achievement" | "mutual_friends"
  reasonDetail: string
  hexCount: number
  totalKm: number
  distance?: number // meters for nearby
  mutualFriends?: number
  clan?: string
  clanColor?: string
}

const recommendedUsers: RecommendedUser[] = [
  {
    id: "1",
    name: "NearbyRunner",
    level: 11,
    reason: "nearby",
    reasonDetail: "距离你 200m",
    hexCount: 78,
    totalKm: 120.5,
    distance: 200,
  },
  {
    id: "2",
    name: "LevelPeer",
    level: 10,
    reason: "similar_level",
    reasonDetail: "等级相近",
    hexCount: 65,
    totalKm: 98.2,
    clan: "新手联盟",
    clanColor: "#22c55e",
  },
  {
    id: "3",
    name: "AchievementBuddy",
    level: 12,
    reason: "similar_achievement",
    reasonDetail: "都完成了「马拉松新手」成就",
    hexCount: 92,
    totalKm: 156.8,
  },
  {
    id: "4",
    name: "MutualConnect",
    level: 14,
    reason: "mutual_friends",
    reasonDetail: "3位共同好友",
    hexCount: 134,
    totalKm: 201.4,
    mutualFriends: 3,
    clan: "闪电战队",
    clanColor: "#f59e0b",
  },
  {
    id: "5",
    name: "AreaMaster",
    level: 16,
    reason: "nearby",
    reasonDetail: "距离你 500m",
    hexCount: 189,
    totalKm: 267.3,
    distance: 500,
  },
]

const reasonConfig = {
  nearby: {
    icon: MapPin,
    label: "附近",
    color: "#22c55e",
  },
  similar_level: {
    icon: Target,
    label: "等级相近",
    color: "#06b6d4",
  },
  similar_achievement: {
    icon: Trophy,
    label: "成就相似",
    color: "#f59e0b",
  },
  mutual_friends: {
    icon: Sparkles,
    label: "共同好友",
    color: "#8b5cf6",
  },
}

interface RecommendedFriendsProps {
  onAddFriend?: (userId: string) => void
}

export function RecommendedFriends({ onAddFriend }: RecommendedFriendsProps) {
  const [addedUsers, setAddedUsers] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<"all" | "nearby" | "similar">("all")

  const filteredUsers = recommendedUsers.filter(user => {
    if (filter === "all") return true
    if (filter === "nearby") return user.reason === "nearby"
    return user.reason === "similar_level" || user.reason === "similar_achievement"
  })

  const handleAddFriend = (userId: string) => {
    setAddedUsers(prev => new Set(prev).add(userId))
    onAddFriend?.(userId)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
          <Sparkles className="h-4 w-4" />
          推荐好友
        </h2>
        <span className="text-xs text-white/30">{recommendedUsers.length} 位推荐</span>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2 rounded-xl bg-white/5 p-1">
        {(["all", "nearby", "similar"] as const).map((f) => {
          const labels = { all: "全部", nearby: "附近的人", similar: "相似跑者" }
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                filter === f
                  ? "bg-[#22c55e] text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {labels[f]}
            </button>
          )
        })}
      </div>

      {/* Recommended Users List */}
      <div className="space-y-3">
        {filteredUsers.map((user) => {
          const reason = reasonConfig[user.reason]
          const Icon = reason.icon
          const isAdded = addedUsers.has(user.id)

          return (
            <div
              key={user.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:bg-white/10"
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#22c55e]/30 to-cyan-500/30 text-lg font-bold text-white">
                      {user.avatar || user.name[0]}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{user.name}</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                        Lv.{user.level}
                      </span>
                      {user.clan && (
                        <span 
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ 
                            backgroundColor: `${user.clanColor}20`,
                            color: user.clanColor 
                          }}
                        >
                          {user.clan}
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {user.hexCount}格
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {user.totalKm}km
                      </span>
                    </div>

                    {/* Reason Badge */}
                    <div 
                      className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                      style={{ 
                        backgroundColor: `${reason.color}20`,
                        color: reason.color 
                      }}
                    >
                      <Icon className="h-3 w-3" />
                      {user.reasonDetail}
                    </div>
                  </div>

                  {/* Add Button */}
                  <button
                    onClick={() => handleAddFriend(user.id)}
                    disabled={isAdded}
                    className={`flex items-center justify-center rounded-xl px-3 py-2 transition-all ${
                      isAdded
                        ? "bg-[#22c55e]/20 text-[#22c55e]"
                        : "bg-[#22c55e] text-black hover:bg-[#22c55e]/90 active:scale-95"
                    }`}
                  >
                    {isAdded ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <UserPlus className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {filteredUsers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 rounded-full bg-white/5 p-4">
            <Sparkles className="h-8 w-8 text-white/30" />
          </div>
          <p className="text-white/60">暂无推荐</p>
          <p className="mt-1 text-sm text-white/40">多跑步，发现更多跑友</p>
        </div>
      )}
    </div>
  )
}
