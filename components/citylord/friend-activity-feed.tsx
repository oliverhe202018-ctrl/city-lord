"use client"

import React from "react"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import type { FriendActivity } from "@/types/social"


const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const fetchFriendActivities = async (): Promise<FriendActivity[]> => {
  const res = await fetchWithTimeout('/api/social/friend-activities', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch friend activities')
  return await res.json()
}

import { 
  Loader2,
  Hexagon, 
  Footprints, 
  Trophy, 
  Swords, 
  TrendingUp, 
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Sparkles,
  Zap,
  MapPin,
  Clock,
  ChevronDown
} from "lucide-react"

const activityConfig: Record<string, {
  icon: React.ElementType
  color: string
  bg: string
  label: string
}> = {
  capture: { icon: Hexagon, color: "text-[#22c55e]", bg: "bg-[#22c55e]/20", label: "占领" },
  run: { icon: Footprints, color: "text-cyan-400", bg: "bg-cyan-400/20", label: "跑步" },
  levelup: { icon: TrendingUp, color: "text-yellow-400", bg: "bg-yellow-400/20", label: "升级" },
  achievement: { icon: Trophy, color: "text-purple-400", bg: "bg-purple-400/20", label: "成就" },
  battle: { icon: Swords, color: "text-red-400", bg: "bg-red-400/20", label: "战斗" },
  challenge: { icon: Zap, color: "text-orange-400", bg: "bg-orange-400/20", label: "挑战" },
}

interface ActivityCardProps {
  activity: FriendActivity
  onLike?: (id: string) => void
  onComment?: (id: string) => void
  isNew?: boolean
}

function ActivityCard({ activity, onLike, onComment, isNew }: ActivityCardProps) {
  const [isLiked, setIsLiked] = useState(activity.isLiked || false)
  const [likes, setLikes] = useState(activity.likes)
  const [isVisible, setIsVisible] = useState(!isNew)

  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => setIsVisible(true), 50)
      return () => clearTimeout(timer)
    }
  }, [isNew])

  const config = activityConfig[activity.type]
  const Icon = config.icon

  const handleLike = () => {
    setIsLiked(!isLiked)
    setLikes(prev => isLiked ? prev - 1 : prev + 1)
    onLike?.(activity.id)
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border bg-card backdrop-blur-xl transition-all duration-500 ${
        isVisible 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 -translate-y-4"
      } ${isNew ? "ring-2 ring-green-500/30" : ""}`}
    >
      {/* New indicator */}
      {isNew && (
        <div className="flex items-center gap-2 border-b border-green-500/20 bg-green-500/10 px-4 py-1.5">
          <Sparkles className="h-3 w-3 text-green-500" />
          <span className="text-xs font-medium text-green-500">新动态</span>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-lg font-bold text-foreground">
                {activity.user.avatar || activity.user.name.charAt(0)}
              </div>
              {/* Activity type badge */}
              <div className={`absolute -bottom-1 -right-1 rounded-full ${config.bg} p-1`}>
                <Icon className={`h-3 w-3 ${config.color}`} />
              </div>
            </div>

            {/* User info */}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{activity.user.name}</span>
                {activity.user.clan && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    [{activity.user.clan}]
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`${config.color}`}>{config.label}</span>
                <span>|</span>
                <Clock className="h-3 w-3" />
                <span>{activity.timestamp}</span>
              </div>
            </div>
          </div>

          <button className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-3">
          <h4 className="font-medium text-foreground">{activity.content.title}</h4>
          <p className="mt-0.5 text-sm text-muted-foreground">{activity.content.description}</p>

          {/* Stats */}
          {activity.content.stats && activity.content.stats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activity.content.stats.map((stat, i) => (
                <div
                  key={i}
                  className={`rounded-lg ${config.bg} px-2.5 py-1.5`}
                >
                  <span className="text-xs text-foreground/70">{stat.label}: </span>
                  <span className={`text-sm font-semibold ${config.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Location */}
          {activity.content.location && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {activity.content.location}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 transition-all active:scale-95 ${
                isLiked ? "text-red-400" : "text-muted-foreground hover:text-red-400"
              }`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
              <span className="text-sm">{likes}</span>
            </button>
            <button
              onClick={() => onComment?.(activity.id)}
              className="flex items-center gap-1.5 text-muted-foreground transition-all hover:text-green-500 active:scale-95"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">{activity.comments}</span>
            </button>
          </div>
          <button className="rounded-full p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface FriendActivityFeedProps {
  activities?: FriendActivity[]
  onLoadMore?: () => void
  hasMore?: boolean
}

export function FriendActivityFeed({ 
  activities: initialActivities,
  onLoadMore,
  hasMore = false 
}: FriendActivityFeedProps) {
  const [feedActivities, setFeedActivities] = useState<FriendActivity[]>(initialActivities || [])
  const [isLoading, setIsLoading] = useState(!initialActivities)

  useEffect(() => {
    if (!initialActivities) {
      const loadActivities = async () => {
        try {
          const data = await fetchFriendActivities()
          setFeedActivities(data)
        } catch (error) {
          console.error("Failed to load activities:", error)
          toast.error("加载动态失败")
        } finally {
          setIsLoading(false)
        }
      }
      loadActivities()
    } else {
        setFeedActivities(initialActivities)
        setIsLoading(false)
    }
  }, [initialActivities])

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (feedActivities.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
        <p>暂无好友动态</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {feedActivities.map((activity, index) => (
        <ActivityCard 
          key={activity.id} 
          activity={activity} 
          isNew={index === 0 && !initialActivities} // Highlight first if freshly fetched
        />
      ))}
      
      {/* Load More Trigger - Optional */}
      {hasMore && (
        <div className="pt-4 text-center">
           <button 
             onClick={onLoadMore}
             className="text-xs text-muted-foreground hover:text-foreground"
           >
             加载更多
           </button>
        </div>
      )}
    </div>
  )
}
