import React, { useState, useEffect, useTransition } from "react"
import { toast } from "sonner"
import { handleAppError } from "@/lib/utils/app-error"
import { getFeedTimeline, togglePostLike, createPostComment, deletePostComment, reportPost, getPostComments, markSocialAsRead, FeedTimelineResponse } from "@/app/actions/social-hub"
import { useGameStore } from "@/store/useGameStore"
import useSWRInfinite from 'swr/infinite'

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
  X,
} from "lucide-react"
import { SafeHTML } from "@/components/citylord/ui/safe-html"
import { ImageGrid } from "@/components/citylord/ui/image-grid"
import { PosterModal } from "@/components/citylord/ui/poster-modal"

const activityConfig: Record<string, {
  icon: React.ElementType
  color: string
  bg: string
  label: string
}> = {
  RUN: { icon: Footprints, color: "text-cyan-400", bg: "bg-cyan-400/20", label: "跑步" },
  TEXT: { icon: MessageCircle, color: "text-[#22c55e]", bg: "bg-[#22c55e]/20", label: "动态" },
  ACHIEVEMENT: { icon: Trophy, color: "text-purple-400", bg: "bg-purple-400/20", label: "成就" },
}

function ExpandableText({ text, maxLines = 3, className = "" }: { text: string, maxLines?: number, className?: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null

  const isLong = text.length > 150 || text.split('\n').length > maxLines

  return (
    <div className="relative">
      <div className={`overflow-hidden transition-all duration-300 ${!expanded && isLong ? (maxLines === 4 ? "line-clamp-4 max-h-[5.5rem]" : "line-clamp-3 max-h-[4.5rem]") : "max-h-[50rem]"}`}>
        <SafeHTML html={text} className={`${className} break-words`} />
      </div>
      {isLong && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(!expanded) }}
          className="text-xs text-primary font-medium mt-1 hover:underline active:scale-95 transition-transform"
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      )}
    </div>
  )
}

interface ActivityCardProps {
  post: any
  onLike?: (id: string, liked: boolean, count: number) => void
  onComment?: (id: string) => void
  isNew?: boolean
}

function ActivityCard({ post, onLike, onComment, isNew }: ActivityCardProps) {
  const currentUserId = useGameStore(state => state.userId)
  const currentUserNickname = useGameStore(state => state.nickname)
  const currentUserAvatar = useGameStore(state => state.avatar)
  const currentUser = { id: currentUserId, nickname: currentUserNickname, avatar: currentUserAvatar }
  // Optimistic UI state
  const [isLiked, setIsLiked] = useState<boolean>(false) // MVP assumes false initially or supplied by backend if resolved 
  const [likes, setLikes] = useState(post._count?.likes || 0)
  const [commentsCount, setCommentsCount] = useState(post._count?.comments || 0)
  const [isVisible, setIsVisible] = useState(!isNew)
  const [isPending, startTransition] = useTransition()

  // Comments state
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [localComments, setLocalComments] = useState<any[]>(post.comments || [])
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const commentInputRef = React.useRef<HTMLInputElement>(null)

  // Comment Pagination state
  const initialHasMore = post._count?.comments > (post.comments?.length || 0)
  const [hasMoreComments, setHasMoreComments] = useState(initialHasMore)
  const [isLoadingComments, setIsLoadingComments] = useState(false)

  // Report State
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportReason, setReportReason] = useState("垃圾广告")
  const [reportDetail, setReportDetail] = useState("")
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)

  // Share/Poster State
  const [showPoster, setShowPoster] = useState(false)

  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => setIsVisible(true), 50)
      return () => clearTimeout(timer)
    }
  }, [isNew])

  // Track unread interactions for IntersectionObserver
  const unreadInteractions = React.useMemo(() => {
    const unread: { type: 'LIKE' | 'COMMENT', id: string, ref: any }[] = []
    if (post.likes && Array.isArray(post.likes)) {
      post.likes.forEach((l: any) => {
        if (!l.is_read && l.user_id !== currentUser?.id) unread.push({ type: 'LIKE', id: l.id, ref: l })
      })
    }
    if (post.comments && Array.isArray(post.comments)) {
      post.comments.forEach((c: any) => {
        if (!c.is_read && c.user_id !== currentUser?.id) unread.push({ type: 'COMMENT', id: c.id, ref: c })
      })
    }
    return unread
  }, [post, currentUser?.id])

  const [hasUnread, setHasUnread] = useState(unreadInteractions.length > 0)
  const cardRef = React.useRef<HTMLDivElement>(null)

  // Intersection Observer for auto-marking as read
  useEffect(() => {
    if (!hasUnread || unreadInteractions.length === 0 || !cardRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Optimistic update
          setHasUnread(false)
          unreadInteractions.forEach(item => { item.ref.is_read = true })

          const idsToMark = unreadInteractions.map(i => ({ type: i.type as 'LIKE' | 'COMMENT', id: i.id }))

          markSocialAsRead(idsToMark).then(res => {
            if (!res.success) {
              // Graceful rollback
              setHasUnread(true)
              unreadInteractions.forEach(item => { item.ref.is_read = false })
              console.error("markSocialAsRead failed, rolled back:", res.error)
            } else {
              // Successfully marked, update global store if needed
              useGameStore.getState().setUnreadSocialCount(
                Math.max(0, useGameStore.getState().unreadSocialCount - idsToMark.length)
              )
            }
          }).catch(error => {
            setHasUnread(true)
            unreadInteractions.forEach(item => { item.ref.is_read = false })
            console.error("markSocialAsRead network error:", error)
          })

          observer.disconnect()
        }
      },
      { threshold: 0.5 } // Trigger when 50% visible
    )

    observer.observe(cardRef.current)

    return () => observer.disconnect()
  }, [hasUnread, unreadInteractions])

  const config = activityConfig[post.source_type] || { icon: Hexagon, color: "text-gray-400", bg: "bg-gray-400/20", label: "未知" }
  const Icon = config.icon

  const handleLike = () => {
    if (isPending) return

    // Optimistic
    const previousIsLiked = isLiked
    const previousLikes = likes
    setIsLiked(!previousIsLiked)
    setLikes((prev: number) => previousIsLiked ? prev - 1 : prev + 1)

    startTransition(async () => {
      try {
        const res = await togglePostLike(post.id)
        if (res.error) {
          throw new Error(res.error.message || "点赞失败")
        }
        setIsLiked(res.liked)
        setLikes(res.totalLikes)
        onLike?.(post.id, res.liked, res.totalLikes)
      } catch (e) {
        // Revert optimistic update
        setIsLiked(previousIsLiked)
        setLikes(previousLikes)
        handleAppError(e, "点赞失败，请重试")
      }
    })
  }

  // Determine avatar and name safely
  const avatar = post.user?.avatar_url
  const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(post.user?.nickname || 'user')}`
  const displayAvatar = avatar && avatar.length > 5 ? avatar : fallbackAvatar
  const displayName = post.user?.nickname || 'City Lord'

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || isSubmittingComment) return

    setIsSubmittingComment(true)
    try {
      const res = await createPostComment({ postId: post.id, content: commentText.trim() })
      if (!res.success) throw new Error(res.error?.message || "评论失败")

      const newComment = {
        ...res.comment,
        user: {
          id: currentUser?.id,
          nickname: currentUser?.nickname || '我',
          avatar_url: currentUser?.avatar
        }
      }
      setLocalComments((prev: any[]) => [newComment, ...prev])
      setCommentsCount((prev: number) => prev + 1)
      setCommentText("")

      // Refocus input for quick continuous chatting
      setTimeout(() => commentInputRef.current?.focus(), 50)
    } catch (error: any) {
      handleAppError(error, "评论发布失败", { 429: "您评论太快啦，喝口水休息一下吧~" })
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleLoadMoreComments = async () => {
    if (isLoadingComments || !hasMoreComments) return
    setIsLoadingComments(true)
    try {
      const lastComment = localComments[localComments.length - 1]
      const res = await getPostComments({ postId: post.id, cursor: lastComment?.id })
      if (res.error) throw res.error

      // Append unique comments
      const newItems = res.items.filter(newItem => !localComments.some(c => c.id === newItem.id))
      setLocalComments(prev => [...prev, ...newItems])
      setHasMoreComments(res.hasMore)
    } catch (e: any) {
      handleAppError(e, "加载评论失败", { 429: "加载频繁，请稍后再试" })
    } finally {
      setIsLoadingComments(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await deletePostComment(commentId)
      if (!res.success) throw new Error(res.error?.message || "删除失败")
      setLocalComments((prev: any[]) => prev.filter(c => c.id !== commentId))
      setCommentsCount((prev: number) => prev - 1)
    } catch (error: any) {
      handleAppError(error)
    }
  }

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden rounded-2xl border border-border bg-card backdrop-blur-xl transition-all duration-500 ${isVisible
        ? "opacity-100 translate-y-0"
        : "opacity-0 -translate-y-4"
        } ${isNew ? "ring-2 ring-green-500/30" : ""} ${hasUnread ? "ring-1 ring-primary/50" : ""}`}
    >
      {hasUnread && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary animate-pulse" title="有新互动" />
      )}
      {isNew && (
        <div className="flex items-center gap-2 border-b border-green-500/20 bg-green-500/10 px-4 py-1.5">
          <Sparkles className="h-3 w-3 text-green-500" />
          <span className="text-xs font-medium text-green-500">新动态</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={displayAvatar} alt={displayName} className="h-11 w-11 rounded-full object-cover border-2 border-border" />
              <div className={`absolute -bottom-1 -right-1 rounded-full ${config.bg} p-1`}>
                <Icon className={`h-3 w-3 ${config.color}`} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{displayName}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Lv.{post.user?.level || 1}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`${config.color}`}>{config.label}</span>
                <span>|</span>
                <Clock className="h-3 w-3" />
                <span>{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowReportDialog(true)}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-500"
            title="举报动态"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3">
          <ExpandableText text={post.content} maxLines={4} className="mt-0.5 text-sm whitespace-pre-wrap leading-relaxed text-foreground" />
          {post.media_urls && post.media_urls.length > 0 && <ImageGrid urls={post.media_urls} />}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 transition-all active:scale-95 ${isLiked ? "text-red-400" : "text-muted-foreground hover:text-red-400"
                }`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
              <span className="text-sm">{likes}</span>
            </button>
            <button
              onClick={() => {
                const wasClosed = !showComments;
                setShowComments(!showComments)
                onComment?.(post.id)

                // Mark unread interactions as read if opening comments
                // NOTE: This is largely handled by the IntersectionObserver now, but kept as a manual fallback
                if (wasClosed && hasUnread) {
                  // handled by observer already if they scroll, but if they click fast:
                  setHasUnread(false);
                }
              }}
              className={`flex items-center gap-1.5 transition-all active:scale-95 ${showComments ? "text-green-500" : "text-muted-foreground hover:text-green-500"}`}
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">{commentsCount}</span>
            </button>
          </div>
          <button
            onClick={() => setShowPoster(true)}
            className="rounded-full p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 pt-3 border-t border-border/50 space-y-3 animate-in fade-in slide-in-from-top-2">
            <form onSubmit={handleCommentSubmit} className="flex gap-2">
              <input
                ref={commentInputRef}
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="在此输入评论..."
                className="flex-1 bg-muted/50 border border-border rounded-full px-4 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={isSubmittingComment}
                maxLength={200}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || isSubmittingComment}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium transition active:scale-95 disabled:opacity-50"
              >
                {isSubmittingComment ? "发送中" : "发送"}
              </button>
            </form>

            <div className="space-y-3 pt-2">
              {localComments.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">暂无评论，来抢沙发吧</div>
              ) : (
                localComments.map((comment: any) => {
                  const isMine = currentUser?.id === comment.user_id
                  const cAvatar = comment.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user?.nickname || 'U'}`
                  return (
                    <div key={comment.id} className="flex gap-2.5">
                      <img src={cAvatar} alt="avt" className="w-6 h-6 rounded-full object-cover shrink-0 border border-border" />
                      <div className="flex-1 min-w-0 bg-muted/30 p-2.5 rounded-2xl rounded-tl-none">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs font-semibold text-foreground/80">{comment.user?.nickname || '用户'}</span>
                          {isMine && (
                            <button onClick={() => handleDeleteComment(comment.id)} className="text-[10px] text-red-400 hover:text-red-500 transition-colors shrink-0">删除</button>
                          )}
                        </div>
                        <SafeHTML html={comment.content} className="text-sm text-foreground leading-snug mt-1 break-words prose-p:my-0" />
                      </div>
                    </div>
                  )
                })
              )}
              {hasMoreComments && (
                <button
                  onClick={handleLoadMoreComments}
                  disabled={isLoadingComments}
                  className="w-full text-xs text-muted-foreground hover:text-foreground py-2 mt-1 rounded bg-muted/20 transition-colors"
                >
                  {isLoadingComments ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "展开更多评论"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Report Dialog */}
      {showReportDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4 animate-in fade-in" onClick={() => setShowReportDialog(false)}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-xl animate-in slide-in-from-bottom border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">举报动态</h3>
              <button onClick={() => setShowReportDialog(false)} className="rounded-full p-2 bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">选择举报原因</label>
                <div className="flex flex-wrap gap-2">
                  {["垃圾广告", "违规内容", "恶意骚扰", "虚假信息", "其他"].map(reason => (
                    <button
                      key={reason}
                      onClick={() => setReportReason(reason)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${reportReason === reason ? "bg-red-500 text-white shadow-md shadow-red-500/20" : "bg-muted text-foreground hover:bg-muted/80"}`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">补充说明 (可选)</label>
                <textarea
                  value={reportDetail}
                  onChange={e => setReportDetail(e.target.value)}
                  placeholder="详情描述有助于我们更快处理..."
                  className="w-full rounded-xl border border-border bg-muted/30 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 transition-all placeholder:text-muted-foreground/60 resize-none"
                  rows={3}
                  maxLength={200}
                />
              </div>

              <button
                disabled={isSubmittingReport}
                onClick={async () => {
                  setIsSubmittingReport(true)
                  try {
                    const fullReason = reportDetail ? `${reportReason}: ${reportDetail}` : reportReason
                    const res = await reportPost(post.id, fullReason)
                    if (!res.success) throw res.error
                    toast.success("举报已提交", { description: "我们会尽快核实处理，感谢您的反馈。" })
                    setShowReportDialog(false)
                    setReportDetail("")
                    setReportReason("垃圾广告")
                  } catch (e: any) {
                    handleAppError(e, "举报失败", { 409: "您已举报过该动态", 429: "举报太频繁了，请稍后再试" })
                  } finally {
                    setIsSubmittingReport(false)
                  }
                }}
                className="w-full rounded-xl bg-red-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-95 disabled:opacity-50 flex items-center justify-center transition-all"
              >
                {isSubmittingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认举报"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPoster && <PosterModal post={post} onClose={() => setShowPoster(false)} />}
    </div>
  )
}

interface FriendActivityFeedProps {
  filterType?: "FRIENDS" | "GLOBAL"
  newPost?: any
}

export function FriendActivityFeed({ filterType = "FRIENDS", newPost }: FriendActivityFeedProps) {
  // useSWRInfinite logic
  const fetcher = async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  const getKey = (pageIndex: number, previousPageData: any) => {
    // Reached the end
    if (previousPageData && !previousPageData.items?.length) return null

    const baseUrl = '/api/social/feed'
    const params = new URLSearchParams({
      filter: filterType,
      limit: '10'
    })

    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.append('cursor', previousPageData.nextCursor)
    }

    return `${baseUrl}?${params.toString()}`
  }

  const { data, size, setSize, isValidating, error, mutate } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: false,
    persistSize: true
  })

  const posts = data ? data.map(page => page.items).flat().filter(Boolean) : []
  const isLoadingInitialData = !data && !error
  const isLoadingMore = isLoadingInitialData || (size > 0 && data && typeof data[size - 1] === 'undefined')
  const isFetchingMore = isValidating && posts.length > 0
  const hasMore = data ? !!data[data.length - 1]?.nextCursor : true

  useEffect(() => {
    if (newPost) {
      mutate((prev: any[] | undefined) => {
        if (!prev) return prev
        const firstPage = prev[0]
        if (firstPage.items.some((p: any) => p.id === newPost.id)) return prev
        const newFirstPage = { ...firstPage, items: [newPost, ...firstPage.items] }
        return [newFirstPage, ...prev.slice(1)]
      }, false)
    }
  }, [newPost, mutate])

  if (isLoadingInitialData) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-32 flex-col items-center justify-center text-muted-foreground gap-2">
        <p className="text-sm">加载动态失败</p>
        <button
          onClick={() => mutate()}
          className="text-xs text-primary hover:underline"
        >
          点击重试
        </button>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
        <p>暂无动态</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post, index) => (
        <ActivityCard
          key={post.id}
          post={post}
        />
      ))}

      {hasMore && (
        <div className="pt-4 pb-12 text-center">
          <button
            onClick={() => setSize(size + 1)}
            disabled={isLoadingMore || isFetchingMore}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {isLoadingMore || isFetchingMore ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "加载更多"}
          </button>
        </div>
      )}
    </div>
  )
}
