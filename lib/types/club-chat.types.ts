'use strict'

import { z } from 'zod'

// ─── Channel Key Enum ──────────────────────────────────────────
export enum ChannelKey {
    ANNOUNCEMENT = 'announcement',
    CHECKIN = 'checkin',
    EVENTS = 'events',
    TACTICS = 'tactics',
    CHAT = 'chat',
}

/** All known channel keys in display order */
export const CHANNEL_KEYS = [
    ChannelKey.ANNOUNCEMENT,
    ChannelKey.CHECKIN,
    ChannelKey.EVENTS,
    ChannelKey.TACTICS,
    ChannelKey.CHAT,
] as const

/** Default channel definitions for seeding */
export const DEFAULT_CHANNELS: { key: ChannelKey; name: string; sort_order: number }[] = [
    { key: ChannelKey.ANNOUNCEMENT, name: '📢 公告', sort_order: 0 },
    { key: ChannelKey.CHECKIN, name: '✅ 打卡', sort_order: 1 },
    { key: ChannelKey.EVENTS, name: '🎯 活动', sort_order: 2 },
    { key: ChannelKey.TACTICS, name: '🗺️ 战术', sort_order: 3 },
    { key: ChannelKey.CHAT, name: '💬 闲聊', sort_order: 4 },
]

/** Runtime check: is the key a known channel key? */
export function isValidChannelKey(key: string): key is ChannelKey {
    return Object.values(ChannelKey).includes(key as ChannelKey)
}

// ─── Error Codes ───────────────────────────────────────────────
export const ClubChatError = {
    NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
    CLUB_NOT_FOUND: 'CLUB_NOT_FOUND',
    CLUB_NOT_MEMBER: 'CLUB_NOT_MEMBER',
    NO_PERMISSION: 'NO_PERMISSION',
    INVALID_CONTENT: 'INVALID_CONTENT',
    CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
    INVALID_CHANNEL_KEY: 'INVALID_CHANNEL_KEY',
    INVALID_CURSOR: 'INVALID_CURSOR',
    RATE_LIMITED: 'RATE_LIMITED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    // Activity errors
    ACTIVITY_NOT_FOUND: 'ACTIVITY_NOT_FOUND',
    ALREADY_REGISTERED: 'ALREADY_REGISTERED',
    NOT_REGISTERED: 'NOT_REGISTERED',
    ACTIVITY_FULL: 'ACTIVITY_FULL',
    INVALID_TIME_RANGE: 'INVALID_TIME_RANGE',
} as const

export type ClubChatErrorCode = (typeof ClubChatError)[keyof typeof ClubChatError]

// ─── Shared TS Types ───────────────────────────────────────────
export interface ClubChannel {
    id: string
    clubId: string
    key: string
    name: string
    sortOrder: number
}

export interface MessageSender {
    id: string
    nickname: string | null
    avatarUrl: string | null
}

export interface ClubMessageWithSender {
    id: string
    clubId: string
    channelId: string
    content: string
    createdAt: string // ISO string — formatted client-side only
    sender: MessageSender
}

export interface MessagesPaginatedResult {
    items: ClubMessageWithSender[]
    nextCursor?: string // JSON-encoded composite cursor
}

export type ClubChatResult<T> =
    | { success: true; data: T }
    | { success: false; error: ClubChatErrorCode; message: string }

export interface MembershipInfo {
    isMember: boolean
    role: 'owner' | 'admin' | 'member' | null
}

// ─── Composite Cursor ──────────────────────────────────────────
export interface CompositeCursor {
    createdAt: string // ISO string
    id: string
}

// UUID v4 pattern for cursor id validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// ISO 8601 date pattern (loose check — must parse to valid Date)
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

export function encodeCursor(c: CompositeCursor): string {
    return Buffer.from(JSON.stringify(c)).toString('base64')
}

/**
 * Decode and **validate** a composite cursor.
 * Returns null if the cursor string is malformed, not valid base64,
 * or if either field fails type / format checks.
 */
export function decodeCursor(raw: string): CompositeCursor | null {
    try {
        // Step 1: base64 decode
        const json = Buffer.from(raw, 'base64').toString('utf-8')

        // Step 2: JSON parse
        const parsed = JSON.parse(json)
        if (!parsed || typeof parsed !== 'object') return null

        const { createdAt, id } = parsed

        // Step 3: type checks
        if (typeof createdAt !== 'string' || typeof id !== 'string') return null

        // Step 4: format checks — createdAt must be ISO date, id must be UUID
        if (!ISO_DATE_RE.test(createdAt)) return null
        if (!UUID_RE.test(id)) return null

        // Step 5: createdAt must parse to a valid Date
        const d = new Date(createdAt)
        if (isNaN(d.getTime())) return null

        return { createdAt, id }
    } catch {
        return null
    }
}

// ─── Zod Schemas ───────────────────────────────────────────────
const uuidSchema = z.string().uuid()

export const sendMessageSchema = z.object({
    clubId: uuidSchema,
    channelId: uuidSchema,
    content: z
        .string()
        .min(1, '消息内容不能为空')
        .max(500, '消息内容不能超过500字'),
})

export const getMessagesSchema = z.object({
    clubId: uuidSchema,
    channelId: uuidSchema,
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(20),
})

export const getChannelsSchema = z.object({
    clubId: uuidSchema,
})

// ─── Activity Types ────────────────────────────────────────────
export interface ClubActivity {
    id: string
    clubId: string
    title: string
    description: string
    location: string | null
    maxParticipants: number | null
    startTime: string // ISO string
    endTime: string   // ISO string
    createdBy: string
    createdAt: string
    registrationCount: number
    myRegistrationStatus: 'registered' | 'canceled' | null
}

export interface ClubActivityRegistration {
    id: string
    activityId: string
    userId: string
    status: 'registered' | 'canceled'
    registeredAt: string
    user: {
        id: string
        nickname: string | null
        avatarUrl: string | null
    }
}

export interface ActivitiesPaginatedResult {
    items: ClubActivity[]
    nextCursor?: string
}

// ─── Activity Zod Schemas ──────────────────────────────────────
export const createActivitySchema = z.object({
    clubId: uuidSchema,
    title: z.string().min(1, '活动标题不能为空').max(100, '活动标题不能超过100字'),
    description: z.string().max(2000, '活动描述不能超过2000字').default(''),
    location: z.string().max(200).optional(),
    maxParticipants: z.number().int().min(1).optional(),
    startTime: z.string().datetime({ message: '请选择有效的开始时间' }),
    endTime: z.string().datetime({ message: '请选择有效的结束时间' }),
})

export const getActivitiesSchema = z.object({
    clubId: uuidSchema,
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(20),
})

export const registerActivitySchema = z.object({
    activityId: uuidSchema,
})
