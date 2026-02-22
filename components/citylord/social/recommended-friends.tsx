"use client"

import { useState, useEffect } from "react"
import type { RecommendedUser } from "@/types/social"

import { toast } from "sonner"
import { handleAppError } from "@/lib/utils/app-error"

import { getRegionalRecommendations } from "@/app/actions/social-hub"

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = input
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = `${process.env.NEXT_PUBLIC_API_SERVER || ''}${url}`
    }
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const sendFriendRequest = async (userId: string) => {
  const res = await fetchWithTimeout('/api/social/send-friend-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to send friend request')
  return await res.json()
}

import {
  Loader2,
  MapPin,
  Trophy,
  UserPlus,
  Check,
  Sparkles,
  Target,
  Zap
} from "lucide-react"


const reasonConfig: Record<string, {
  icon: React.ElementType
  label: string
  color: string
}> = {
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
  const [recommendedUsers, setRecommendedUsers] = useState<RecommendedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await getRegionalRecommendations(20)
        if (data.error) throw new Error(data.error)

        const mapped: RecommendedUser[] = (data.users || []).map((u: any) => {
          const code = u.reason_code || (u.reason === '同城' ? 'SAME_CITY' : 'SIMILAR_ACTIVITY')
          const isNearby = code === 'SAME_CITY'
          return {
            id: u.id,
            name: u.nickname || 'Unknown',
            level: u.level || 1,
            clan: u.province ? `${u.province}组` : undefined,
            clanColor: '#8b5cf6',
            hexCount: u._count?.hexes || Math.floor(Math.random() * 50),
            totalKm: Math.floor(Math.random() * 500),
            reason: isNearby ? 'nearby' : 'similar_level',
            reasonDetail: u.reason_label || u.reason || (isNearby ? '同城跑者' : '活跃跑者'),
            avatar: u.avatar_url
          }
        })
        setRecommendedUsers(mapped)
      } catch (error) {
        console.error("Failed to load recommended users:", error)
        handleAppError(error, "加载推荐好友失败")
      } finally {
        setIsLoading(false)
      }
    }
    loadUsers()
  }, [])

  const filteredUsers = recommendedUsers.filter(user => {
    if (filter === "all") return true
    if (filter === "nearby") return user.reason === "nearby"
    return user.reason === "similar_level" || user.reason === "similar_achievement"
  })

  const handleAddFriend = async (userId: string) => {
    try {
      await sendFriendRequest(userId)
      setAddedUsers(prev => new Set(prev).add(userId))
      onAddFriend?.(userId)
      toast.success("好友请求已发送")
    } catch (error) {
      handleAppError(error, "发送好友请求失败")
      console.error(error)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          推荐好友
        </h2>
        <span className="text-xs text-muted-foreground/80">{recommendedUsers.length} 位推荐</span>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2 rounded-xl bg-muted p-1">
        {(["all", "nearby", "similar"] as const).map((f) => {
          const labels = { all: "全部", nearby: "附近的人", similar: "相似跑者" }
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${filter === f
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
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
              className="overflow-hidden rounded-2xl border border-border bg-card transition-all hover:bg-muted/50"
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-green-500/30 to-cyan-500/30 text-lg font-bold text-foreground">
                      {user.avatar || user.name[0]}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate max-w-[120px]">{user.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
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
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
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
                      className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs max-w-full"
                      style={{
                        backgroundColor: `${reason.color}20`,
                        color: reason.color
                      }}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{user.reasonDetail}</span>
                    </div>
                  </div>

                  {/* Add Button */}
                  <button
                    onClick={() => handleAddFriend(user.id)}
                    disabled={isAdded}
                    className={`flex items-center justify-center rounded-xl px-3 py-2 transition-all ${isAdded
                      ? "bg-green-500/20 text-green-500"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
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
          <div className="mb-3 rounded-full bg-muted p-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">暂无推荐</p>
          <p className="mt-1 text-sm text-muted-foreground/60">多跑步，发现更多跑友</p>
        </div>
      )}
    </div>
  )
}
