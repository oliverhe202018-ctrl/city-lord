'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Trash2, ChevronUp, MessageSquare } from 'lucide-react'
import type { ClubMessageWithSender } from '@/lib/types/club-chat.types'

// ─── Optimistic message type (P0 #7) ──────────────────────────
export interface OptimisticMessage {
    clientTempId: string
    content: string
    createdAt: string
    status: 'pending' | 'failed'
    sender: {
        id: string
        nickname: string | null
        avatarUrl: string | null
    }
}

export type DisplayMessage =
    | ({ type: 'confirmed' } & ClubMessageWithSender)
    | ({ type: 'optimistic' } & OptimisticMessage)

// ─── Time formatter (client-only to avoid hydration mismatch) ─
function ClientTime({ iso }: { iso: string }) {
    const [formatted, setFormatted] = useState<string>('')
    const [hasError, setHasError] = useState(false)

    useEffect(() => {
        try {
            if (!iso) { setFormatted(''); return }
            const d = new Date(iso)
            if (isNaN(d.getTime())) { setHasError(true); return }

            const now = new Date()
            const diffMs = now.getTime() - d.getTime()
            const diffMin = Math.floor(diffMs / 60000)
            const diffHr = Math.floor(diffMs / 3600000)

            if (diffMin < 1) {
                setFormatted('刚刚')
            } else if (diffMin < 60) {
                setFormatted(`${diffMin}分钟前`)
            } else if (diffHr < 24) {
                setFormatted(`${diffHr}小时前`)
            } else {
                setFormatted(
                    d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) +
                    ' ' +
                    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                )
            }
        } catch {
            setHasError(true)
            setFormatted('')
        }
    }, [iso])

    if (hasError) return <span className="text-white/15">--</span>
    if (!formatted) return null
    return <span suppressHydrationWarning>{formatted}</span>
}

// ─── Skeleton ──────────────────────────────────────────────────
function MessageListSkeleton() {
    return (
        <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-24 rounded" />
                        <Skeleton className="h-4 w-48 rounded" />
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Empty State ───────────────────────────────────────────────
function MessageListEmpty({ channelName }: { channelName: string }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-12 w-12 text-white/10 mb-3" />
            <p className="text-sm text-white/40 mb-1">暂无消息</p>
            <p className="text-xs text-white/25">在「{channelName}」发送第一条消息吧</p>
        </div>
    )
}

// ─── Single Message Bubble ─────────────────────────────────────
function MessageBubble({
    msg,
    isOwn,
    onRetry,
    onDelete,
}: {
    msg: DisplayMessage
    isOwn: boolean
    onRetry?: (clientTempId: string) => void
    onDelete?: (clientTempId: string) => void
}) {
    const router = useRouter()
    const [isRetrying, setIsRetrying] = useState(false)
    const isPending = msg.type === 'optimistic' && msg.status === 'pending'
    const isFailed = msg.type === 'optimistic' && msg.status === 'failed'
    const senderName = msg.sender.nickname || '匿名用户'
    const avatarUrl = msg.sender.avatarUrl

    const handleAvatarClick = () => {
        if (!isOwn) router.push(`/profile/user?userId=${msg.sender.id}`)
    }

    // Debounced retry — prevent duplicate clicks
    const handleRetry = useCallback(() => {
        if (isRetrying || msg.type !== 'optimistic' || !onRetry) return
        setIsRetrying(true)
        onRetry(msg.clientTempId)
        // Reset after debounce window
        setTimeout(() => setIsRetrying(false), 2000)
    }, [isRetrying, msg, onRetry])

    return (
        <div className={`flex items-start gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div
                className={`h-8 w-8 flex-shrink-0 rounded-full overflow-hidden bg-zinc-800 ${!isOwn ? 'cursor-pointer hover:ring-2 ring-primary/50 transition-all' : ''}`}
                onClick={handleAvatarClick}
            >
                {avatarUrl ? (
                    <img src={avatarUrl} alt={senderName} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-medium text-white/60">
                        {senderName.slice(0, 1)}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <span
                        className={`text-xs font-medium text-white/50 ${!isOwn ? 'cursor-pointer hover:text-white/80 transition-colors' : ''}`}
                        onClick={handleAvatarClick}
                    >
                        {senderName}
                    </span>
                    <span className="text-[10px] text-white/25">
                        <ClientTime iso={msg.createdAt} />
                    </span>
                </div>

                <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${isOwn
                        ? 'bg-yellow-500/90 text-black rounded-tr-sm'
                        : 'bg-white/8 text-white/90 rounded-tl-sm'
                        } ${isPending ? 'opacity-60' : ''} ${isFailed ? 'border border-red-500/40 bg-red-950/20' : ''}`}
                >
                    {msg.content}
                </div>

                {/* Failed state: clear error text + retry/delete with debounce */}
                {isFailed && msg.type === 'optimistic' && (
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-red-400">⚠ 发送失败，请检查网络后重试</span>
                        {onRetry && (
                            <button
                                onClick={handleRetry}
                                disabled={isRetrying}
                                className="text-[10px] text-yellow-400 hover:text-yellow-300 flex items-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} /> 重试
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(msg.clientTempId)}
                                className="text-[10px] text-white/30 hover:text-white/50 flex items-center gap-0.5"
                            >
                                <Trash2 className="h-3 w-3" /> 删除
                            </button>
                        )}
                    </div>
                )}

                {isPending && (
                    <div className="flex items-center gap-1 mt-0.5">
                        <Loader2 className="h-3 w-3 animate-spin text-white/30" />
                        <span className="text-[10px] text-white/30">发送中...</span>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Main Component ────────────────────────────────────────────
interface MessageListProps {
    messages: DisplayMessage[] | null // null = loading
    channelName: string
    currentUserId: string | null
    hasMore: boolean
    isLoadingMore: boolean
    onLoadMore: () => void
    onRetry?: (clientTempId: string) => void
    onDeleteOptimistic?: (clientTempId: string) => void
}

export function MessageList({
    messages,
    channelName,
    currentUserId,
    hasMore,
    isLoadingMore,
    onLoadMore,
    onRetry,
    onDeleteOptimistic,
}: MessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const prevHeightRef = useRef<number>(0)
    const isAutoScrollRef = useRef(true)

    // P0 #8: After loading more, preserve scroll position
    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        if (isLoadingMore) {
            // Save height before prepend
            prevHeightRef.current = el.scrollHeight
        }
    }, [isLoadingMore])

    // Scroll handling after messages update
    useEffect(() => {
        const el = scrollRef.current
        if (!el || messages === null) return

        if (prevHeightRef.current > 0) {
            // After load-more: maintain scroll position
            const heightDiff = el.scrollHeight - prevHeightRef.current
            el.scrollTop += heightDiff
            prevHeightRef.current = 0
        } else if (isAutoScrollRef.current) {
            // Auto-scroll to bottom for new messages
            el.scrollTop = el.scrollHeight
        }
    }, [messages])

    // Track if user is near bottom
    const handleScroll = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        isAutoScrollRef.current = distFromBottom < 60
    }, [])

    // Expose a way to force scroll to bottom (called by parent after send)
    useEffect(() => {
        if (scrollRef.current && isAutoScrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    })

    if (messages === null) {
        return <MessageListSkeleton />
    }

    if (messages.length === 0) {
        return <MessageListEmpty channelName={channelName} />
    }

    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
            id="message-list-scroll"
        >
            {/* Load more button at top */}
            {hasMore && (
                <div className="flex justify-center mb-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                        className="text-xs text-white/40 hover:text-white/60"
                        id="load-more-btn"
                    >
                        {isLoadingMore ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                            <ChevronUp className="h-3 w-3 mr-1" />
                        )}
                        加载更早消息
                    </Button>
                </div>
            )}

            {/* Messages: already reversed (old→new) by parent */}
            <div className="space-y-3">
                {messages.map((msg) => {
                    const key = msg.type === 'confirmed' ? msg.id : msg.clientTempId
                    const isOwn = msg.sender.id === currentUserId
                    return (
                        <MessageBubble
                            key={key}
                            msg={msg}
                            isOwn={isOwn}
                            onRetry={onRetry}
                            onDelete={onDeleteOptimistic}
                        />
                    )
                })}
            </div>
        </div>
    )
}
