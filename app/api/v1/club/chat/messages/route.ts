import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
    sendMessageSchema,
    getMessagesSchema,
    ClubChatError,
    decodeCursor,
    encodeCursor,
    ChannelKey,
} from '@/lib/types/club-chat.types'

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

/**
 * GET /api/v1/club/chat/messages?clubId=xxx&channelId=yyy&cursor=zzz&limit=20
 * Fetch club messages with pagination
 */
export async function GET(request: NextRequest) {
    try {
        // Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json(
                { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' },
                { status: 401 }
            )
        }

        // Parse query params
        const { searchParams } = new URL(request.url)
        const clubId = searchParams.get('clubId')
        const channelId = searchParams.get('channelId')
        const cursor = searchParams.get('cursor') || undefined
        const limitStr = searchParams.get('limit')
        const limit = limitStr ? parseInt(limitStr, 10) : 20

        // Validate
        const parsed = getMessagesSchema.safeParse({ clubId, channelId, cursor, limit })
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: ClubChatError.INVALID_CONTENT, message: '参数无效' },
                { status: 400 }
            )
        }

        const { clubId: validClubId, channelId: validChannelId, cursor: validCursor, limit: validLimit } = parsed.data

        // Membership check
        const member = await prisma.club_members.findUnique({
            where: {
                club_id_user_id: { club_id: validClubId, user_id: user.id },
            },
            select: { role: true, status: true },
        })

        if (!member || member.status !== 'active') {
            return NextResponse.json(
                { success: false, error: ClubChatError.CLUB_NOT_MEMBER, message: '你不是该俱乐部成员' },
                { status: 403 }
            )
        }

        // Build where clause with composite cursor
        const baseWhere: Prisma.club_messagesWhereInput = {
            channel_id: validChannelId,
            club_id: validClubId,
            deleted_at: null,
        }

        if (validCursor) {
            const decoded = decodeCursor(validCursor)
            if (decoded) {
                baseWhere.OR = [
                    { created_at: { lt: new Date(decoded.created_at) } },
                    {
                        created_at: { equals: new Date(decoded.created_at) },
                        id: { lt: decoded.id },
                    },
                ]
            }
        }

        // Fetch limit + 1 to determine if there's a next page
        const fetchLimit = validLimit + 1
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

        const hasMore = messages.length > validLimit
        const items = hasMore ? messages.slice(0, validLimit) : messages

        const nextCursor = hasMore && items.length > 0
            ? encodeCursor({
                created_at: items[items.length - 1].created_at.toISOString(),
                id: items[items.length - 1].id,
            })
            : undefined

        return NextResponse.json({
            success: true,
            data: {
                items: items.map((msg: any) => ({
                    id: msg.id,
                    clubId: msg.club_id,
                    channelId: msg.channel_id,
                    content: msg.content,
                    created_at: msg.created_at.toISOString(),
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
                })).reverse(),
                nextCursor,
            }
        })
    } catch (error) {
        console.error('[GET /api/v1/club/chat/messages] Error:', error)
        return NextResponse.json(
            { success: false, error: ClubChatError.INTERNAL_ERROR, message: '获取消息失败' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/v1/club/chat/messages
 * Send a club message
 * Body: { clubId, channelId, content, messageType?, audioUrl?, durationMs?, mimeType?, sizeBytes? }
 */
export async function POST(request: NextRequest) {
    try {
        // Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json(
                { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' },
                { status: 401 }
            )
        }

        // Parse body
        const body = await request.json()

        // Validate
        const parsed = sendMessageSchema.safeParse(body)
        if (!parsed.success) {
            const firstErr = parsed.error.issues[0]?.message || '内容无效'
            return NextResponse.json(
                { success: false, error: ClubChatError.INVALID_CONTENT, message: firstErr },
                { status: 400 }
            )
        }

        const { clubId, channelId, content, messageType, audioUrl, durationMs, mimeType, sizeBytes } = parsed.data

        // Rate limit
        if (!checkSendRateLimit(user.id)) {
            return NextResponse.json(
                { success: false, error: ClubChatError.RATE_LIMITED, message: '发送过于频繁，请稍后再试' },
                { status: 429 }
            )
        }

        // Membership check
        const member = await prisma.club_members.findUnique({
            where: {
                club_id_user_id: { club_id: clubId, user_id: user.id },
            },
            select: { role: true, status: true },
        })

        if (!member || member.status !== 'active') {
            return NextResponse.json(
                { success: false, error: ClubChatError.CLUB_NOT_MEMBER, message: '你不是该俱乐部成员' },
                { status: 403 }
            )
        }

        // Verify channel exists in this club
        const channel = await prisma.club_channels.findFirst({
            where: { id: channelId, club_id: clubId },
            select: { key: true },
        })
        if (!channel) {
            return NextResponse.json(
                { success: false, error: ClubChatError.CHANNEL_NOT_FOUND, message: '频道不存在' },
                { status: 404 }
            )
        }

        // Announcement permission check
        if (channel.key === ChannelKey.ANNOUNCEMENT) {
            const role = member.role ?? 'member'
            if (role !== 'owner' && role !== 'admin') {
                return NextResponse.json(
                    { success: false, error: ClubChatError.NO_PERMISSION, message: '仅管理员可在公告频道发言' },
                    { status: 403 }
                )
            }
        }

        // Insert message
        const message: any = await prisma.club_messages.create({
            data: {
                club_id: clubId,
                channel_id: channelId,
                sender_id: user.id,
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

        return NextResponse.json({
            success: true,
            data: {
                id: message.id,
                clubId: message.club_id,
                channelId: message.channel_id,
                content: message.content,
                created_at: message.created_at.toISOString(),
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
            }
        })
    } catch (error) {
        console.error('[POST /api/v1/club/chat/messages] Error:', error)
        return NextResponse.json(
            { success: false, error: ClubChatError.INTERNAL_ERROR, message: '发送消息失败' },
            { status: 500 }
        )
    }
}
