"use client"

import { useState, useEffect } from "react"
import { 
  Search, 
  UserPlus, 
  MoreHorizontal, 
  MapPin, 
  Trophy, 
  Zap,
  MessageCircle,
  Swords,
  Clock,
  Loader2,
  Check,
  X
} from "lucide-react"
import { fetchFriends, getFriendRequests, respondToFriendRequest, type Friend, type FriendRequest } from "@/app/actions/social"
import { toast } from "sonner"

interface FriendsListProps {
  onSelectFriend?: (friend: Friend) => void
  onChallenge?: (friend: Friend) => void
  onMessage?: (friend: Friend) => void
}

export function FriendsList({ onSelectFriend, onChallenge, onMessage }: FriendsListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "online" | "nearby">("all")
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null)
  
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [friendsData, requestsData] = await Promise.all([
        fetchFriends(),
        getFriendRequests()
      ])
      setFriends(friendsData)
      setRequests(requestsData)
    } catch (error) {
      toast.error("加载数据失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResponse = async (userId: string, action: 'accept' | 'reject') => {
    try {
      const result = await respondToFriendRequest(userId, action)
      if (result.success) {
        toast.success(action === 'accept' ? "已接受好友请求" : "已拒绝好友请求")
        loadData()
      } else {
        toast.error("操作失败")
      }
    } catch (error) {
      toast.error("操作出错")
    }
  }

  const [now, setNow] = useState(Date.now())

  // Update 'now' every minute to refresh relative time and online status
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  const filteredFriends = friends.filter(friend => {
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

  // Helper to determine real-time status
  const getFriendStatus = (friend: Friend) => {
    if (friend.status === 'running') return 'running'
    if (!friend.lastActiveAt) return friend.status // Fallback to server status
    
    const diffMinutes = (now - new Date(friend.lastActiveAt).getTime()) / (1000 * 60)
    return diffMinutes < 5 ? 'online' : 'offline'
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#22c55e]" />
        <p className="mt-2 text-sm text-white/60">正在加载好友列表...</p>
      </div>
    )
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
              all: friends.length,
              online: friends.filter(fr => fr.status !== "offline").length,
              nearby: friends.filter(fr => fr.nearbyDistance !== undefined).length,
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

      {/* Friend Requests Section */}
      {requests.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-white/40">
            好友请求 ({requests.length})
          </h3>
          {requests.map((req) => (
            <div key={req.id} className="flex items-center justify-between rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/5 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#22c55e]/30 to-cyan-500/30 text-sm font-bold text-white">
                  {req.avatar || req.name[0]}
                </div>
                <div>
                  <div className="font-semibold text-white">{req.name}</div>
                  <div className="text-xs text-white/50">Lv.{req.level} • 请求添加好友</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResponse(req.userId, 'reject')}
                  className="rounded-lg bg-white/5 p-2 text-white/60 hover:bg-red-500/20 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleResponse(req.userId, 'accept')}
                  className="rounded-lg bg-[#22c55e] p-2 text-black hover:bg-[#22c55e]/90"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friends List */}
      <div className="space-y-2">
        {filteredFriends.map((friend) => {
          const computedStatus = getFriendStatus(friend)
          const status = statusConfig[computedStatus as keyof typeof statusConfig]
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
                  {computedStatus === "running" ? (
                    <span className="flex items-center gap-1 text-xs text-cyan-400">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
                      </span>
                      跑步中
                    </span>
                  ) : computedStatus === "online" ? (
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
