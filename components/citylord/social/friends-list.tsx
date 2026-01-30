"use client"

import { useState } from "react"
import { 
  Search, 
  UserPlus, 
  MoreHorizontal, 
  MapPin, 
  Trophy, 
  Zap,
  MessageCircle,
  Swords,
  Clock
} from "lucide-react"

interface Friend {
  id: string
  name: string
  avatar?: string
  level: number
  status: "online" | "running" | "offline"
  lastActive?: string
  hexCount: number
  totalKm: number
  clan?: string
  clanColor?: string
  nearbyDistance?: number // in meters
}

const sampleFriends: Friend[] = [
  {
    id: "1",
    name: "CyberStride",
    level: 15,
    status: "running",
    hexCount: 156,
    totalKm: 234.5,
    clan: "闪电战队",
    clanColor: "#22c55e",
  },
  {
    id: "2",
    name: "NightRunner",
    level: 12,
    status: "online",
    hexCount: 98,
    totalKm: 187.2,
    clan: "暗影军团",
    clanColor: "#8b5cf6",
    nearbyDistance: 500,
  },
  {
    id: "3",
    name: "GridMaster",
    level: 18,
    status: "online",
    hexCount: 234,
    totalKm: 312.8,
  },
  {
    id: "4",
    name: "SpeedDemon",
    level: 10,
    status: "offline",
    lastActive: "2小时前",
    hexCount: 67,
    totalKm: 98.4,
  },
  {
    id: "5",
    name: "TerraHunter",
    level: 14,
    status: "offline",
    lastActive: "昨天",
    hexCount: 145,
    totalKm: 201.3,
    clan: "领地猎人",
    clanColor: "#f59e0b",
  },
]

interface FriendsListProps {
  onSelectFriend?: (friend: Friend) => void
  onChallenge?: (friend: Friend) => void
  onMessage?: (friend: Friend) => void
}

export function FriendsList({ onSelectFriend, onChallenge, onMessage }: FriendsListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "online" | "nearby">("all")
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null)

  const filteredFriends = sampleFriends.filter(friend => {
    const matchesSearch = friend.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = 
      filter === "all" ||
      (filter === "online" && (friend.status === "online" || friend.status === "running")) ||
      (filter === "nearby" && friend.nearbyDistance !== undefined)
    return matchesSearch && matchesFilter
  })

  const statusConfig = {
    online: { color: "bg-[#22c55e]", label: "在线", animate: false },
    running: { color: "bg-cyan-400", label: "跑步中", animate: true },
    offline: { color: "bg-white/30", label: "离线", animate: false },
  }

  return (
    <div className="flex flex-col">
      {/* Search and Filter */}
      <div className="mb-4 space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="搜索好友..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-[#22c55e]/50 focus:outline-none focus:ring-1 focus:ring-[#22c55e]/50"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 rounded-xl bg-white/5 p-1">
          {(["all", "online", "nearby"] as const).map((f) => {
            const labels = { all: "全部", online: "在线", nearby: "附近" }
            const counts = {
              all: sampleFriends.length,
              online: sampleFriends.filter(fr => fr.status !== "offline").length,
              nearby: sampleFriends.filter(fr => fr.nearbyDistance !== undefined).length,
            }
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
                {labels[f]} ({counts[f]})
              </button>
            )
          })}
        </div>
      </div>

      {/* Add Friend Button */}
      <button className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#22c55e]/30 bg-[#22c55e]/5 py-3 text-[#22c55e] transition-all hover:bg-[#22c55e]/10">
        <UserPlus className="h-5 w-5" />
        <span className="font-medium">添加新好友</span>
      </button>

      {/* Friends List */}
      <div className="space-y-2">
        {filteredFriends.map((friend) => {
          const status = statusConfig[friend.status]
          const isSelected = selectedFriend === friend.id

          return (
            <div
              key={friend.id}
              className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
                isSelected 
                  ? "border-[#22c55e]/50 bg-[#22c55e]/10" 
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              {/* Main Row */}
              <button
                onClick={() => {
                  setSelectedFriend(isSelected ? null : friend.id)
                  onSelectFriend?.(friend)
                }}
                className="flex w-full items-center gap-3 p-3"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#22c55e]/30 to-cyan-500/30 text-lg font-bold text-white">
                    {friend.avatar || friend.name[0]}
                  </div>
                  {/* Status Dot */}
                  <div 
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0f172a] ${status.color} ${status.animate ? "animate-pulse" : ""}`}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{friend.name}</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                      Lv.{friend.level}
                    </span>
                    {friend.clan && (
                      <span 
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ 
                          backgroundColor: `${friend.clanColor}20`,
                          color: friend.clanColor 
                        }}
                      >
                        {friend.clan}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {friend.hexCount}格
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {friend.totalKm}km
                    </span>
                    {friend.nearbyDistance && (
                      <span className="flex items-center gap-1 text-[#22c55e]">
                        <MapPin className="h-3 w-3" />
                        {friend.nearbyDistance}m
                      </span>
                    )}
                  </div>
                </div>

                {/* Status / Last Active */}
                <div className="text-right">
                  {friend.status === "running" ? (
                    <span className="flex items-center gap-1 text-xs text-cyan-400">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
                      </span>
                      跑步中
                    </span>
                  ) : friend.status === "online" ? (
                    <span className="text-xs text-[#22c55e]">在线</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-white/40">
                      <Clock className="h-3 w-3" />
                      {friend.lastActive}
                    </span>
                  )}
                </div>

                <MoreHorizontal className="h-5 w-5 text-white/40" />
              </button>

              {/* Expanded Actions */}
              {isSelected && (
                <div className="flex gap-2 border-t border-white/10 p-3">
                  <button
                    onClick={() => onChallenge?.(friend)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#22c55e]/20 py-2.5 text-sm font-medium text-[#22c55e] transition-all hover:bg-[#22c55e]/30"
                  >
                    <Swords className="h-4 w-4" />
                    发起挑战
                  </button>
                  <button
                    onClick={() => onMessage?.(friend)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20"
                  >
                    <MessageCircle className="h-4 w-4" />
                    发消息
                  </button>
                  <button className="flex items-center justify-center rounded-xl bg-white/10 px-3 py-2.5 text-white/60 transition-all hover:bg-white/20">
                    <Trophy className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {filteredFriends.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 rounded-full bg-white/5 p-4">
            <UserPlus className="h-8 w-8 text-white/30" />
          </div>
          <p className="text-white/60">没有找到好友</p>
          <p className="mt-1 text-sm text-white/40">
            {filter === "nearby" ? "附近暂无好友在跑步" : "尝试调整搜索条件"}
          </p>
        </div>
      )}
    </div>
  )
}
