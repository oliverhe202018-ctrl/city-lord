'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { ChannelList } from './ChannelList'
import { MessageList, type DisplayMessage } from './MessageList'
import { MessageInput } from './MessageInput'
import { getClubChannels, getClubMessages, sendClubMessage, getMyClubMembership } from '@/app/actions/club-chat.actions'
import type { ClubChannel, ClubMessageWithSender, MembershipInfo } from '@/lib/types/club-chat.types'
import { ClubChatError, ChannelKey } from '@/lib/types/club-chat.types'
import { Shield, ArrowLeft } from 'lucide-react'
import { ActivityList } from './ActivityList'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

// ─── Temp ID generator (P0 #7) ────────────────────────────────
let tempCounter = 0
function genTempId() {
    return `__temp_${Date.now()}_${++tempCounter}`
}

// ─── Props ─────────────────────────────────────────────────────
interface ClubChatViewProps {
    clubId: string
    currentUserId: string
}

export function ClubChatView({ clubId, currentUserId }: ClubChatViewProps) {
    const router = useRouter()

    // ── State ────────────────────────────────────────────────────
    const [channels, setChannels] = useState<ClubChannel[] | null>(null)
    const [activeChannel, setActiveChannel] = useState<ClubChannel | null>(null)
    const [membership, setMembership] = useState<MembershipInfo | null>(null)
    const [accessDenied, setAccessDenied] = useState(false)

    // Messages state
    const [confirmedMessages, setConfirmedMessages] = useState<ClubMessageWithSender[]>([])
    const [optimisticMessages, setOptimisticMessages] = useState<
        { clientTempId: string; content: string; createdAt: string; status: 'pending' | 'failed'; sender: { id: string; nickname: string | null; avatarUrl: string | null } }[]
    >([])
    const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
    const [isLoadingMessages, setIsLoadingMessages] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)

    // Retry content map
    const retryContentRef = useRef<Map<string, string>>(new Map())

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
                // Default select first channel
                if (chResult.data.length > 0) {
                    setActiveChannel(chResult.data[0])
                }
            } else {
                toast.error(chResult.message)
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
        async (content: string) => {
            if (!activeChannel) return

            // Dedup: prevent duplicate pending sends of identical content
            const dedupKey = `${activeChannel.id}:${content}`
            if (pendingContentRef.current.has(dedupKey)) return
            pendingContentRef.current.add(dedupKey)

            const tempId = genTempId()
            retryContentRef.current.set(tempId, content)

            // Optimistic insert
            const optMsg = {
                clientTempId: tempId,
                content,
                createdAt: new Date().toISOString(),
                status: 'pending' as const,
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
            const content = retryContentRef.current.get(clientTempId)
            if (!content || !activeChannel) return

            // Remove old optimistic
            setOptimisticMessages((prev) => prev.filter((m) => m.clientTempId !== clientTempId))
            retryContentRef.current.delete(clientTempId)

            // Re-send
            handleSend(content)
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
            {/* Header */}
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
                                onSend={handleSend}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
