'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import {
    sendMessageSchema,
    getMessagesSchema,
    getChannelsSchema,
    DEFAULT_CHANNELS,
    ClubChatError,
    decodeCursor,
    encodeCursor,
    type ClubChannel,
    type ClubMessageWithSender,
    type MessagesPaginatedResult,
    type ClubChatResult,
    type MembershipInfo,
    ChannelKey,
} from '@/lib/types/club-chat.types'
import { Prisma } from '@prisma/client'

// ─── Auth Helper ───────────────────────────────────────────────
async function getAuthUserId(): Promise<string | null> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        return user?.id ?? null
    } catch {
        return null
    }
}

// ─── Membership Check (P0 #2, #9) ─────────────────────────────
async function checkClubMembership(userId: string, clubId: string): Promise<MembershipInfo> {
    try {
        const member = await prisma.club_members.findUnique({
            where: {
                club_id_user_id: { club_id: clubId, user_id: userId },
            },
            select: { role: true, status: true },
        })

        if (!member || member.status !== 'active') {
            return { isMember: false, role: null }
        }

        return {
            isMember: true,
            role: (member.role as 'owner' | 'admin' | 'member') ?? 'member',
        }
    } catch {
        return { isMember: false, role: null }
    }
}

// ─── Rate Limit (sliding window: 2s cooldown + 10 msgs/min) ───
const sendHistory = new Map<string, number[]>()
const SEND_COOLDOWN_MS = 2000
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10

function checkSendRateLimit(userId: string): boolean {
    const now = Date.now()
    let history = sendHistory.get(userId) ?? []

    // Evict timestamps outside the window
    history = history.filter((t) => now - t < WINDOW_MS)

    // Check 2s cooldown (last message)
    if (history.length > 0 && now - history[history.length - 1] < SEND_COOLDOWN_MS) {
        sendHistory.set(userId, history)
        return false
    }

    // Check per-minute cap
    if (history.length >= MAX_PER_WINDOW) {
        sendHistory.set(userId, history)
        return false
    }

    history.push(now)
    sendHistory.set(userId, history)
    return true
}

// ─── 1. Get Club Channels (P0 #1: concurrent-safe seed) ───────
export async function getClubChannels(
    clubId: string
): Promise<ClubChatResult<ClubChannel[]>> {
    try {
        // Validate
        const parsed = getChannelsSchema.safeParse({ clubId })
        if (!parsed.success) {
            return { success: false, error: ClubChatError.CLUB_NOT_FOUND, message: '无效的俱乐部ID' }
        }

        // Auth
        const userId = await getAuthUserId()
        if (!userId) {
            return { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' }
        }

        // Membership check (P0 #9: cross-club guard)
        const membership = await checkClubMembership(userId, clubId)
        if (!membership.isMember) {
            return { success: false, error: ClubChatError.CLUB_NOT_MEMBER, message: '你不是该俱乐部成员' }
        }

        // Try to query existing channels
        let channels: { id: string; club_id: string; key: string; name: string; sort_order: number }[]
        try {
            channels = await prisma.club_channels.findMany({
                where: { club_id: clubId },
                orderBy: { sort_order: 'asc' },
            })
        } catch (dbError: any) {
            // Database-level error — table may not exist or have permission issues
            console.error('[getClubChannels] DB query error for clubId:', clubId, dbError?.message || dbError)
            return { success: false, error: ClubChatError.INTERNAL_ERROR, message: `数据库查询失败: ${dbError?.message?.slice(0, 100) || '未知数据库错误'}` }
        }

        // Auto-seed if empty (P0 #1: createMany + skipDuplicates)
        if (channels.length === 0) {
            try {
                await prisma.club_channels.createMany({
                    data: DEFAULT_CHANNELS.map((ch) => ({
                        club_id: clubId,
                        key: ch.key,
                        name: ch.name,
                        sort_order: ch.sort_order,
                    })),
                    skipDuplicates: true,
                })

                // Re-query after seed to ensure consistency
                channels = await prisma.club_channels.findMany({
                    where: { club_id: clubId },
                    orderBy: { sort_order: 'asc' },
                })
            } catch (seedError: any) {
                console.error('[getClubChannels] Seed error for clubId:', clubId, seedError?.message || seedError)
                return { success: false, error: ClubChatError.INTERNAL_ERROR, message: `频道初始化失败: ${seedError?.message?.slice(0, 100) || '未知错误'}` }
            }
        }

        return {
            success: true,
            data: channels.map((ch) => ({
                id: ch.id,
                clubId: ch.club_id,
                key: ch.key,
                name: ch.name,
                sortOrder: ch.sort_order,
            })),
        }
    } catch (error: any) {
        console.error('[getClubChannels] Unexpected error for clubId:', clubId, error?.message || error)
        return { success: false, error: ClubChatError.INTERNAL_ERROR, message: `获取频道列表失败: ${error?.message?.slice(0, 100) || '未知错误'}` }
    }
}

// ─── 2. Get Club Messages (P0 #5, #6: composite cursor, filter deleted) ──
export async function getClubMessages(
    input: { clubId: string; channelId: string; cursor?: string; limit?: number }
): Promise<ClubChatResult<MessagesPaginatedResult>> {
    try {
        // Validate
        const parsed = getMessagesSchema.safeParse(input)
        if (!parsed.success) {
            return { success: false, error: ClubChatError.INVALID_CONTENT, message: '参数无效' }
        }
        const { clubId, channelId, cursor, limit } = parsed.data

        // Auth
        const userId = await getAuthUserId()
        if (!userId) {
            return { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' }
        }

        // Membership check (P0 #9)
        const membership = await checkClubMembership(userId, clubId)
        if (!membership.isMember) {
            return { success: false, error: ClubChatError.CLUB_NOT_MEMBER, message: '你不是该俱乐部成员' }
        }

        // Build where clause with composite cursor (P0 #5)
        const baseWhere: Prisma.club_messagesWhereInput = {
            channel_id: channelId,
            club_id: clubId, // P0 #9: cross-club guard
            deleted_at: null, // P0 #6: filter soft-deleted
        }

        if (cursor) {
            const decoded = decodeCursor(cursor)
            if (decoded) {
                // Composite cursor: (created_at < t) OR (created_at = t AND id < idCursor)
                baseWhere.OR = [
                    { created_at: { lt: new Date(decoded.createdAt) } },
                    {
                        created_at: { equals: new Date(decoded.createdAt) },
                        id: { lt: decoded.id },
                    },
                ]
            }
        }

        // Fetch limit + 1 to determine if there's a next page
        const fetchLimit = limit + 1
        const messages = await prisma.club_messages.findMany({
            where: baseWhere,
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            take: fetchLimit,
            include: {
                sender: {
                    select: {
                        id: true,
                        nickname: true,
                        avatar_url: true,
                    },
                },
            },
        })

        const hasMore = messages.length > limit
        const items = hasMore ? messages.slice(0, limit) : messages

        const nextCursor = hasMore && items.length > 0
            ? encodeCursor({
                createdAt: items[items.length - 1].created_at.toISOString(),
                id: items[items.length - 1].id,
            })
            : undefined

        return {
            success: true,
            data: {
                items: items.map((msg: any) => ({
                    id: msg.id,
                    clubId: msg.club_id,
                    channelId: msg.channel_id,
                    content: msg.content,
                    createdAt: msg.created_at.toISOString(),
                    messageType: msg.message_type,
                    audioUrl: msg.audio_url,
                    durationMs: msg.duration_ms,
                    mimeType: msg.mime_type,
                    sizeBytes: msg.size_bytes,
                    sender: {
                        id: msg.sender.id,
                        nickname: msg.sender.nickname,
                        avatarUrl: msg.sender.avatar_url,
                    },
                })),
                nextCursor,
            },
        }
    } catch (error) {
        console.error('[getClubMessages] Error:', error)
        return { success: false, error: ClubChatError.INTERNAL_ERROR, message: '获取消息失败' }
    }
}

// ─── 3. Send Club Message (P0 #3: announcement guard) ─────────
export async function sendClubMessage(
    input: { clubId: string; channelId: string; content: string; messageType?: string; audioUrl?: string; durationMs?: number; mimeType?: string; sizeBytes?: number }
): Promise<ClubChatResult<ClubMessageWithSender>> {
    try {
        // Validate (P0 #4: zod 1-500)
        const parsed = sendMessageSchema.safeParse(input)
        if (!parsed.success) {
            const firstErr = parsed.error.issues[0]?.message || '内容无效'
            return { success: false, error: ClubChatError.INVALID_CONTENT, message: firstErr }
        }
        const { clubId, channelId, content, messageType, audioUrl, durationMs, mimeType, sizeBytes } = parsed.data

        // Auth
        const userId = await getAuthUserId()
        if (!userId) {
            return { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' }
        }

        // Rate limit (P1)
        if (!checkSendRateLimit(userId)) {
            return { success: false, error: ClubChatError.RATE_LIMITED, message: '发送过于频繁，请稍后再试' }
        }

        // Membership check (P0 #2, #9)
        const membership = await checkClubMembership(userId, clubId)
        if (!membership.isMember) {
            return { success: false, error: ClubChatError.CLUB_NOT_MEMBER, message: '你不是该俱乐部成员' }
        }

        // Verify channel exists in this club (P0 #9)
        const channel = await prisma.club_channels.findFirst({
            where: { id: channelId, club_id: clubId },
            select: { key: true },
        })
        if (!channel) {
            return { success: false, error: ClubChatError.CHANNEL_NOT_FOUND, message: '频道不存在' }
        }

        // Announcement permission check (P0 #3)
        if (channel.key === ChannelKey.ANNOUNCEMENT) {
            if (membership.role !== 'owner' && membership.role !== 'admin') {
                return { success: false, error: ClubChatError.NO_PERMISSION, message: '仅管理员可在公告频道发言' }
            }
        }

        // Insert message
        const message: any = await prisma.club_messages.create({
            data: {
                club_id: clubId,
                channel_id: channelId,
                sender_id: userId,
                content: content.trim(),
                message_type: messageType,
                audio_url: audioUrl,
                duration_ms: durationMs,
                mime_type: mimeType,
                size_bytes: sizeBytes,
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        nickname: true,
                        avatar_url: true,
                    },
                },
            },
        })

        return {
            success: true,
            data: {
                id: message.id,
                clubId: message.club_id,
                channelId: message.channel_id,
                content: message.content,
                createdAt: message.created_at.toISOString(),
                messageType: message.message_type,
                audioUrl: message.audio_url,
                durationMs: message.duration_ms,
                mimeType: message.mime_type,
                sizeBytes: message.size_bytes,
                sender: {
                    id: message.sender.id,
                    nickname: message.sender.nickname,
                    avatarUrl: message.sender.avatar_url,
                },
            },
        }
    } catch (error) {
        console.error('[sendClubMessage] Error:', error)
        return { success: false, error: ClubChatError.INTERNAL_ERROR, message: '发送消息失败' }
    }
}

// ─── 4. Get current user's membership for a club ──────────────
export async function getMyClubMembership(
    clubId: string
): Promise<ClubChatResult<MembershipInfo>> {
    try {
        const userId = await getAuthUserId()
        if (!userId) {
            return { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' }
        }

        const info = await checkClubMembership(userId, clubId)
        return { success: true, data: info }
    } catch (error) {
        console.error('[getMyClubMembership] Error:', error)
        return { success: false, error: ClubChatError.INTERNAL_ERROR, message: '获取成员信息失败' }
    }
}
