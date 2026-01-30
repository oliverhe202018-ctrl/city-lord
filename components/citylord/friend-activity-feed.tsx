"use client"

import React from "react"

import { useState, useEffect } from "react"
import { toast } from "sonner"
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

type ActivityType = "capture" | "run" | "levelup" | "achievement" | "battle" | "challenge"

interface FriendActivity {
  id: string
  user: {
    name: string
    avatar?: string
    level: number
    clan?: string
  }
  type: ActivityType
  content: {
    title: string
    description: string
    stats?: {
      label: string
      value: string
    }[]
    location?: string
  }
  timestamp: string
  likes: number
  comments: number
  isLiked?: boolean
}

const activityConfig: Record<ActivityType, { 
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
      className={`overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl transition-all duration-500 ${
        isVisible 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 -translate-y-4"
      } ${isNew ? "ring-2 ring-[#22c55e]/30" : ""}`}
    >
      {/* New indicator */}
      {isNew && (
        <div className="flex items-center gap-2 border-b border-[#22c55e]/20 bg-[#22c55e]/10 px-4 py-1.5">
          <Sparkles className="h-3 w-3 text-[#22c55e]" />
          <span className="text-xs font-medium text-[#22c55e]">新动态</span>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white">
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
                <span className="font-semibold text-white">{activity.user.name}</span>
                {activity.user.clan && (
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
                    [{activity.user.clan}]
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-white/40">
                <span className={`${config.color}`}>{config.label}</span>
                <span>|</span>
                <Clock className="h-3 w-3" />
                <span>{activity.timestamp}</span>
              </div>
            </div>
          </div>

          <button className="rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-3">
          <h4 className="font-medium text-white">{activity.content.title}</h4>
          <p className="mt-0.5 text-sm text-white/60">{activity.content.description}</p>

          {/* Stats */}
          {activity.content.stats && activity.content.stats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activity.content.stats.map((stat, i) => (
                <div
                  key={i}
                  className={`rounded-lg ${config.bg} px-2.5 py-1.5`}
                >
                  <span className="text-xs text-white/50">{stat.label}: </span>
                  <span className={`text-sm font-semibold ${config.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Location */}
          {activity.content.location && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-white/40">
              <MapPin className="h-3 w-3" />
              {activity.content.location}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 transition-all active:scale-95 ${
                isLiked ? "text-red-400" : "text-white/40 hover:text-red-400"
              }`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
              <span className="text-sm">{likes}</span>
            </button>
            <button
              onClick={() => onComment?.(activity.id)}
              className="flex items-center gap-1.5 text-white/40 transition-all hover:text-[#22c55e] active:scale-95"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">{activity.comments}</span>
            </button>
          </div>
          <button className="rounded-full p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white">
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

const sampleActivities: FriendActivity[] = [
  {
    id: "1",
    user: { name: "CyberStride", level: 18, clan: "暗影军团" },
    type: "capture",
    content: {
      title: "占领了3个新领地",
      description: "在中央商务区扩张势力范围",
      stats: [
        { label: "总领地", value: "156格" },
        { label: "本周新增", value: "+12格" },
      ],
      location: "中央商务区",
    },
    timestamp: "5分钟前",
    likes: 12,
    comments: 3,
  },
  {
    id: "2",
    user: { name: "NightRunner", level: 22 },
    type: "run",
    content: {
      title: "完成了10公里跑步",
      description: "今天状态不错，刷新了个人纪录!",
      stats: [
        { label: "距离", value: "10.2公里" },
        { label: "配速", value: "5'23\"/km" },
        { label: "时长", value: "54分32秒" },
      ],
    },
    timestamp: "12分钟前",
    likes: 28,
    comments: 8,
    isLiked: true,
  },
  {
    id: "3",
    user: { name: "GridMaster", level: 15, clan: "闪电战队" },
    type: "levelup",
    content: {
      title: "升到了15级!",
      description: "解锁了新技能：闪电冲刺",
    },
    timestamp: "1小时前",
    likes: 45,
    comments: 15,
  },
  {
    id: "4",
    user: { name: "SpeedDemon", level: 20 },
    type: "battle",
    content: {
      title: "赢得了领地争夺战",
      description: "成功从 ShadowWalker 手中夺取领地",
      stats: [
        { label: "战斗结果", value: "胜利" },
        { label: "获得", value: "+3格" },
      ],
      location: "科技园区",
    },
    timestamp: "2小时前",
    likes: 33,
    comments: 7,
  },
  {
    id: "5",
    user: { name: "Marathoner", level: 25, clan: "铁人帮" },
    type: "achievement",
    content: {
      title: "解锁成就：百公里俱乐部",
      description: "累计跑步距离达到100公里",
      stats: [
        { label: "总里程", value: "100.5公里" },
      ],
    },
    timestamp: "3小时前",
    likes: 89,
    comments: 23,
  },
]

export function FriendActivityFeed({ 
  activities = sampleActivities,
  onLoadMore,
  hasMore = true 
}: FriendActivityFeedProps) {
  const [feedActivities, setFeedActivities] = useState(activities)
  const [newActivityIds, setNewActivityIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const handleLoadMore = async () => {
    if (!onLoadMore) return
    
    setLoading(true)
    try {
      // Assuming onLoadMore can be async or just a callback
      // If it's a promise, await it. If not, this is harmless.
      await Promise.resolve(onLoadMore())
    } catch (error) {
      toast.error("加载失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  // Simulate new activity coming in
  const simulateNewActivity = () => {
    const newActivity: FriendActivity = {
      id: `new-${Date.now()}`,
      user: { name: "LiveRunner", level: 14 },
      type: "capture",
      content: {
        title: "刚刚占领了1个领地",
        description: "继续扩张中...",
        location: "城市广场",
      },
      timestamp: "刚刚",
      likes: 0,
      comments: 0,
    }
    setNewActivityIds(prev => new Set([...prev, newActivity.id]))
    setFeedActivities(prev => [newActivity, ...prev])
    
    // Remove "new" indicator after 5 seconds
    setTimeout(() => {
      setNewActivityIds(prev => {
        const next = new Set(prev)
        next.delete(newActivity.id)
        return next
      })
    }, 5000)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">好友动态</h2>
        <button
          onClick={simulateNewActivity}
          className="rounded-lg bg-[#22c55e]/20 px-3 py-1.5 text-xs font-medium text-[#22c55e] transition-all hover:bg-[#22c55e]/30"
        >
          模拟新动态
        </button>
      </div>

      {/* Activity list */}
      <div className="space-y-3">
        {feedActivities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            isNew={newActivityIds.has(activity.id)}
          />
        ))}
      </div>

      {/* Load more */}
      {hasMore ? (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/40 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/5 hover:text-white active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中...
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              加载更多
            </>
          )}
        </button>
      ) : (
        <div className="flex items-center justify-center py-4 text-xs text-white/30">
          —— 到底了，去跑跑步吧 ——
        </div>
      )}
    </div>
  )
}
