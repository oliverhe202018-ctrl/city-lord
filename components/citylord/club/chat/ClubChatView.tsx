'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { ChannelList } from './ChannelList'
import { MessageList, type DisplayMessage } from './MessageList'
import { MessageInput } from './MessageInput'
import { getClubChannels, getClubMessages, sendClubMessage, getMyClubMembership } from '@/app/actions/club-chat.actions'
import type { ClubChannel, ClubMessageWithSender, MembershipInfo } from '@/lib/types/club-chat.types'
import { ClubChatError, ChannelKey, DEFAULT_CHANNELS } from '@/lib/types/club-chat.types'
import { Shield, ArrowLeft, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import { ActivityList } from './ActivityList'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { io, Socket } from 'socket.io-client'

// ─── Temp ID generator (P0 #7) ────────────────────────────────
let tempCounter = 0
function genTempId() {
    return `__temp_${Date.now()}_${++tempCounter}`
}

// ─── Props ─────────────────────────────────────────────────────
interface ClubChatViewProps {
    clubId: string
    currentUserId: string
    embedded?: boolean
}

export function ClubChatView({ clubId, currentUserId, embedded = false }: ClubChatViewProps) {
    const router = useRouter()

    // ── State ────────────────────────────────────────────────────
    const [channels, setChannels] = useState<ClubChannel[] | null>(null)
    const [activeChannel, setActiveChannel] = useState<ClubChannel | null>(null)
    const [membership, setMembership] = useState<MembershipInfo | null>(null)
    const [accessDenied, setAccessDenied] = useState(false)
    const [channelError, setChannelError] = useState<string | null>(null)

    // Messages state
    const [confirmedMessages, setConfirmedMessages] = useState<ClubMessageWithSender[]>([])
    const [optimisticMessages, setOptimisticMessages] = useState<
        { clientTempId: string; content: string; createdAt: string; status: 'pending' | 'failed'; messageType?: string | null; audioUrl?: string | null; durationMs?: number | null; mimeType?: string | null; sizeBytes?: number | null; sender: { id: string; nickname: string | null; avatarUrl: string | null } }[]
    >([])
    const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
    const [isLoadingMessages, setIsLoadingMessages] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)

    // Retry content map
    const retryContentRef = useRef<Map<string, { content: string, audioInfo?: any }>>(new Map())

    // ── Load channels + membership ───────────────────────────────
    useEffect(() => {
        let cancelled = false

        async function load() {
            const [chResult, memResult] = await Promise.all([
                getClubChannels(clubId),
                getMyClubMembership(clubId),
            ])

            if (cancelled) return

            if (memResult.success) {
                setMembership(memResult.data)
                if (!memResult.data.isMember) {
                    setAccessDenied(true)
                    return
                }
            } else {
                setAccessDenied(true)
                return
            }

            if (chResult.success) {
                setChannels(chResult.data)
                if (chResult.data.length > 0) {
                    setActiveChannel(chResult.data[0])
                }
            } else {
                // Channel fetch failed — show the actual error and fallback to local channels
                console.error('[ClubChatView] Channel fetch failed:', chResult.error, chResult.message)
                setChannelError(chResult.message || '频道加载失败')
                const fallbackChannels: ClubChannel[] = DEFAULT_CHANNELS.map((ch) => ({
                    id: `fallback-${ch.key}`,
                    clubId,
                    key: ch.key,
                    name: ch.name,
                    sortOrder: ch.sort_order,
                }))
                setChannels(fallbackChannels)
                if (fallbackChannels.length > 0) {
                    setActiveChannel(fallbackChannels[0])
                }
            }
        }

        load()
        return () => { cancelled = true }
    }, [clubId])

    // ── Load messages when channel changes ───────────────────────
    useEffect(() => {
        if (!activeChannel) return
        const currentChannel = activeChannel
        let cancelled = false

        async function loadMessages() {
            setIsLoadingMessages(true)
            setConfirmedMessages([])
            setOptimisticMessages([])
            setNextCursor(undefined)
            setHasMore(false)

            // Skip loading messages for fallback channels (non-UUID IDs will fail validation)
            if (currentChannel.id.startsWith('fallback-')) {
                setIsLoadingMessages(false)
                return
            }

            const result = await getClubMessages({
                clubId,
                channelId: currentChannel.id,
                limit: 20,
            })

            if (cancelled) return
            setIsLoadingMessages(false)

            if (result.success) {
                setConfirmedMessages(result.data.items)
                setNextCursor(result.data.nextCursor)
                setHasMore(!!result.data.nextCursor)
            } else {
                if (result.error === ClubChatError.CLUB_NOT_MEMBER) {
                    setAccessDenied(true)
                } else {
                    toast.error(result.message)
                }
            }
        }

        loadMessages()
        return () => { cancelled = true }
    }, [activeChannel, clubId])

    // ── WebSocket: Real-time updates ──────────────────────────────
    useEffect(() => {
        if (!activeChannel || activeChannel.id.startsWith('fallback-')) return

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER || process.env.NEXT_PUBLIC_API_SERVER || ''
        const socket: Socket = io(socketUrl, {
            query: { clubId, channelId: activeChannel.id },
            transports: ['websocket']
        })

        socket.on('connect', () => {
            console.log('[Chat] Socket connected:', socket.id)
        })

        socket.on('new_message', (message: ClubMessageWithSender) => {
            console.log('[Chat] New message received via socket:', message.id)
            if (message.channelId === activeChannel.id) {
                setConfirmedMessages((prev) => {
                    // Prevent duplicates if we already have it (e.g. from handleSend)
                    if (prev.some(m => m.id === message.id)) return prev
                    return [...prev, message]
                })
            }
        })

        return () => {
            console.log('[Chat] Cleaning up socket for channel:', activeChannel.id)
            socket.off('new_message')
            socket.disconnect()
        }
    }, [activeChannel, clubId])

    // ── Load more (P0 #8: prepend older messages) ────────────────
    const handleLoadMore = useCallback(async () => {
        if (!activeChannel || !nextCursor || isLoadingMore) return

        setIsLoadingMore(true)
        const result = await getClubMessages({
            clubId,
            channelId: activeChannel.id,
            cursor: nextCursor,
            limit: 20,
        })
        setIsLoadingMore(false)

        if (result.success) {
            // Prepend older messages
            setConfirmedMessages((prev) => [...result.data.items, ...prev])
            setNextCursor(result.data.nextCursor)
            setHasMore(!!result.data.nextCursor)
        } else {
            toast.error(result.message)
        }
    }, [activeChannel, clubId, nextCursor, isLoadingMore])

    // ── Send message (P0 #7: optimistic with clientTempId + dedup) ──
    const pendingContentRef = useRef<Set<string>>(new Set())

    const handleSend = useCallback(
        async (content: string, audioInfo?: any) => {
            if (!activeChannel) return

            // Dedup: prevent duplicate pending sends of identical content
            const dedupKey = audioInfo ? `${activeChannel.id}:voice:${Date.now()}` : `${activeChannel.id}:${content}`
            if (pendingContentRef.current.has(dedupKey)) return
            pendingContentRef.current.add(dedupKey)

            const tempId = genTempId()
            retryContentRef.current.set(tempId, { content, audioInfo })

            // Optimistic insert
            const optMsg = {
                clientTempId: tempId,
                content,
                createdAt: new Date().toISOString(),
                status: 'pending' as const,
                messageType: audioInfo ? 'voice' : 'text',
                audioUrl: audioInfo?.audioUrl,
                durationMs: audioInfo?.durationMs,
                mimeType: audioInfo?.mimeType,
                sizeBytes: audioInfo?.sizeBytes,
                sender: {
                    id: currentUserId,
                    nickname: null,
                    avatarUrl: null,
                },
            }
            setOptimisticMessages((prev) => [...prev, optMsg])

            const result = await sendClubMessage({
                clubId,
                channelId: activeChannel.id,
                content,
                messageType: audioInfo ? 'voice' : 'text',
                audioUrl: audioInfo?.audioUrl,
                durationMs: audioInfo?.durationMs,
                mimeType: audioInfo?.mimeType,
                sizeBytes: audioInfo?.sizeBytes,
            })

            // Release dedup lock
            pendingContentRef.current.delete(dedupKey)

            if (result.success) {
                // Replace optimistic with confirmed (P0 #7)
                setOptimisticMessages((prev) => prev.filter((m) => m.clientTempId !== tempId))
                setConfirmedMessages((prev) => [...prev, result.data])
                retryContentRef.current.delete(tempId)
            } else {
                // Mark as failed
                setOptimisticMessages((prev) =>
                    prev.map((m) => (m.clientTempId === tempId ? { ...m, status: 'failed' as const } : m))
                )
                toast.error(result.message)
            }
        },
        [activeChannel, clubId, currentUserId]
    )

    // ── Retry failed message ─────────────────────────────────────
    const handleRetry = useCallback(
        (clientTempId: string) => {
            const data = retryContentRef.current.get(clientTempId)
            if (!data || !activeChannel) return

            // Remove old optimistic
            setOptimisticMessages((prev) => prev.filter((m) => m.clientTempId !== clientTempId))
            retryContentRef.current.delete(clientTempId)

            // Re-send
            handleSend(data.content, data.audioInfo)
        },
        [activeChannel, handleSend]
    )

    // ── Delete optimistic message ────────────────────────────────
    const handleDeleteOptimistic = useCallback((clientTempId: string) => {
        setOptimisticMessages((prev) => prev.filter((m) => m.clientTempId !== clientTempId))
        retryContentRef.current.delete(clientTempId)
    }, [])

    // ── Build display messages (dedup confirmed by id, reverse DESC → old→new) ──
    const displayMessages: DisplayMessage[] | null =
        isLoadingMessages
            ? null
            : (() => {
                // Dedup confirmed messages by id
                const seen = new Set<string>()
                const dedupedConfirmed = [...confirmedMessages].reverse().filter((m) => {
                    if (seen.has(m.id)) return false
                    seen.add(m.id)
                    return true
                })
                return [
                    ...dedupedConfirmed.map(
                        (m): DisplayMessage => ({ type: 'confirmed' as const, ...m })
                    ),
                    ...optimisticMessages.map(
                        (m): DisplayMessage => ({ type: 'optimistic' as const, ...m })
                    ),
                ]
            })()

    // ── Access Denied ────────────────────────────────────────────
    if (accessDenied) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-black px-6 py-20">
                <Shield className="h-12 w-12 text-red-400/60" />
                <h2 className="text-lg font-semibold text-white">无权访问</h2>
                <p className="text-sm text-white/50 text-center">你不是该俱乐部成员，无法查看频道内容</p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.back()}
                    className="mt-2 border-white/10 text-white/60"
                >
                    <ArrowLeft className="h-4 w-4 mr-1" /> 返回
                </Button>
            </div>
        )
    }

    // ── Mobile: channel tabs at top; Desktop: sidebar ────────────
    return (
        <div className="flex h-full flex-col bg-black">
            {/* Warning banner for channel errors */}
            {channelError && (
                <div className="flex items-center gap-2 bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-xs text-yellow-400">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{channelError}（消息功能暂不可用）</span>
                </div>
            )}

            {/* Header - hidden in embedded mode */}
            {!embedded && (
                <div className="flex items-center gap-2 border-b border-white/5 bg-zinc-950 px-4 py-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="h-8 w-8 text-white/50 hover:text-white"
                        id="chat-back-btn"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-base font-semibold text-white">
                        {activeChannel?.name || '俱乐部频道'}
                    </h1>
                </div>
            )}

            {/* Channel tabs (mobile-friendly horizontal scroll) */}
            <div className="border-b border-white/5 bg-zinc-950/80 overflow-x-auto scrollbar-hide">
                <div className="flex px-2 min-w-0">
                    {channels === null ? (
                        <div className="flex gap-2 p-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-8 w-16 rounded-lg bg-white/5 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <ChannelList
                            channels={channels}
                            activeChannelId={activeChannel?.id ?? null}
                            onSelectChannel={setActiveChannel}
                        />
                    )}
                </div>
            </div>

            {/* Messages or Activity view */}
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                {activeChannel?.key === ChannelKey.EVENTS ? (
                    /* Specialized activity view for Events channel */
                    membership ? (
                        <ActivityList
                            clubId={clubId}
                            currentUserId={currentUserId}
                            membership={membership}
                        />
                    ) : null
                ) : (
                    <>
                        <MessageList
                            messages={displayMessages}
                            channelName={activeChannel?.name ?? ''}
                            currentUserId={currentUserId}
                            hasMore={hasMore}
                            isLoadingMore={isLoadingMore}
                            onLoadMore={handleLoadMore}
                            onRetry={handleRetry}
                            onDeleteOptimistic={handleDeleteOptimistic}
                        />

                        {/* Input */}
                        {activeChannel && membership && (
                            <MessageInput
                                channelKey={activeChannel.key}
                                userRole={membership.role}
                                currentUserId={currentUserId}
                                onSend={handleSend}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
