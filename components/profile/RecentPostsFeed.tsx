'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, ChevronRight, MessageSquare } from 'lucide-react'
import { getFeedTimeline } from '@/app/actions/social-hub'
import { ActivityCard } from '@/components/citylord/friend-activity-feed'

interface RecentPostsFeedProps {
  userId?: string
}

export function RecentPostsFeed({ userId }: RecentPostsFeedProps) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setError(null)
    getFeedTimeline({ filter: 'USER', targetUserId: userId, limit: 3 })
      .then((res) => {
        if (res.error) {
          setError('加载动态失败')
        } else {
          setPosts(res.items.slice(0, 3))
        }
      })
      .catch(() => setError('网络异常'))
      .finally(() => setLoading(false))
  }, [userId])

  if (!userId) return null

  return (
    <div className="mt-6">
      {/* Section Header */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        最新动态
      </h2>

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
          {error}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground rounded-2xl border border-border bg-card/50">
          <MessageSquare className="h-5 w-5 opacity-40" />
          <span className="text-sm">暂无动态</span>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {posts.map((post) => (
              <ActivityCard key={post.id} post={post} />
            ))}
          </div>

          {/* View All Button */}
          <button
            onClick={() => toast.info('全部动态页正在开发中，敬请期待 🚧')}
            className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-card/50 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground active:scale-[0.98] transition-all"
          >
            <span>查看全部动态</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}
