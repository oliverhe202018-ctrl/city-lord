'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import {
    createActivitySchema,
    getActivitiesSchema,
    registerActivitySchema,
    ClubChatError,
    decodeCursor,
    encodeCursor,
    type ClubActivity,
    type ClubActivityRegistration,
    type ActivitiesPaginatedResult,
    type ClubChatResult,
    type MembershipInfo,
} from '@/lib/types/club-chat.types'
import { Prisma } from '@prisma/client'
import { eventBus } from '@/lib/game-logic/event-bus'

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

// ─── Membership Check ──────────────────────────────────────────
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

// ─── 1. Get Club Activities (paginated) ────────────────────────
export async function getClubActivities(
    input: { clubId: string; cursor?: string; limit?: number }
): Promise<ClubChatResult<ActivitiesPaginatedResult>> {
    try {
        const parsed = getActivitiesSchema.safeParse(input)
        if (!parsed.success) {
            return { success: false, error: ClubChatError.INVALID_CONTENT, message: '参数无效' }
        }
        const { clubId, cursor, limit } = parsed.data

        // Auth
        const userId = await getAuthUserId()
        if (!userId) {
            return { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' }
        }

        // Membership
        const membership = await checkClubMembership(userId, clubId)
        if (!membership.isMember) {
            return { success: false, error: ClubChatError.CLUB_NOT_MEMBER, message: '你不是该俱乐部成员' }
        }

        // Build where clause with composite cursor
        const baseWhere: Prisma.club_activitiesWhereInput = {
            club_id: clubId,
        }

        if (cursor) {
            const decoded = decodeCursor(cursor)
            if (decoded) {
                baseWhere.OR = [
                    { start_time: { gt: new Date(decoded.createdAt) } },
                    {
                        start_time: { equals: new Date(decoded.createdAt) },
                        id: { gt: decoded.id },
                    },
                ]
            }
        }

        const fetchLimit = limit + 1
        const activities = await prisma.club_activities.findMany({
            where: baseWhere,
            orderBy: [{ start_time: 'asc' }, { id: 'asc' }],
            take: fetchLimit,
            include: {
                _count: {
                    select: {
                        registrations: {
                            where: { status: 'registered' },
                        },
                    },
                },
            },
        })

        const hasMore = activities.length > limit
        const items = hasMore ? activities.slice(0, limit) : activities

        // Batch-fetch current user's registration status for all activities
        const activityIds = items.map((a) => a.id)
        const myRegistrations = await prisma.club_activity_registrations.findMany({
            where: {
                activity_id: { in: activityIds },
                user_id: userId,
            },
            select: { activity_id: true, status: true },
        })
        const myRegMap = new Map(myRegistrations.map((r) => [r.activity_id, r.status]))

        const nextCursor = hasMore && items.length > 0
            ? encodeCursor({
                createdAt: items[items.length - 1].start_time.toISOString(),
                id: items[items.length - 1].id,
            })
            : undefined

        return {
            success: true,
            data: {
                items: items.map((a): ClubActivity => ({
                    id: a.id,
                    clubId: a.club_id,
                    title: a.title,
                    description: a.description,
                    location: a.location,
                    maxParticipants: a.max_participants,
                    startTime: a.start_time.toISOString(),
                    endTime: a.end_time.toISOString(),
                    createdBy: a.created_by,
                    createdAt: a.created_at.toISOString(),
                    registrationCount: a._count.registrations,
                    myRegistrationStatus: (myRegMap.get(a.id) as 'registered' | 'canceled') ?? null,
                })),
                nextCursor,
            },
        }
    } catch (error) {
        console.error('[getClubActivities] Error:', error)
        return { success: false, error: ClubChatError.INTERNAL_ERROR, message: '获取活动列表失败' }
    }
}

// ─── 2. Create Activity (owner/admin only) ─────────────────────
export async function createActivity(
    input: {
        clubId: string
        title: string
        description?: string
        location?: string
        maxParticipants?: number
        startTime: string
        endTime: string
    }
): Promise<ClubChatResult<ClubActivity>> {
    try {
        const parsed = createActivitySchema.safeParse(input)
        if (!parsed.success) {
            const firstErr = parsed.error.issues[0]?.message || '参数无效'
            return { success: false, error: ClubChatError.INVALID_CONTENT, message: firstErr }
        }
        const { clubId, title, description, location, maxParticipants, startTime, endTime } = parsed.data

        // Time range validation
        if (new Date(endTime) <= new Date(startTime)) {
            return { success: false, error: ClubChatError.INVALID_TIME_RANGE, message: '结束时间必须晚于开始时间' }
        }

        // Auth
        const userId = await getAuthUserId()
        if (!userId) {
            return { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' }
        }

        // Membership + permission (owner/admin only)
        const membership = await checkClubMembership(userId, clubId)
        if (!membership.isMember) {
            return { success: false, error: ClubChatError.CLUB_NOT_MEMBER, message: '你不是该俱乐部成员' }
        }
        if (membership.role !== 'owner' && membership.role !== 'admin') {
            return { success: false, error: ClubChatError.NO_PERMISSION, message: '仅管理员可创建活动' }
        }

        const activity = await prisma.club_activities.create({
            data: {
                club_id: clubId,
                title: title.trim(),
                description: description ?? '',
                location: location?.trim() || null,
                max_participants: maxParticipants ?? null,
                start_time: new Date(startTime),
                end_time: new Date(endTime),
                created_by: userId,
            },
        })

        return {
            success: true,
            data: {
                id: activity.id,
                clubId: activity.club_id,
                title: activity.title,
                description: activity.description,
                location: activity.location,
                maxParticipants: activity.max_participants,
                startTime: activity.start_time.toISOString(),
                endTime: activity.end_time.toISOString(),
                createdBy: activity.created_by,
                createdAt: activity.created_at.toISOString(),
                registrationCount: 0,
                myRegistrationStatus: null,
            },
        }
    } catch (error) {
        console.error('[createActivity] Error:', error)
        return { success: false, error: ClubChatError.INTERNAL_ERROR, message: '创建活动失败' }
    }
}

// ─── 3. Register for Activity (member) ─────────────────────────
export async function registerForActivity(
    activityId: string
): Promise<ClubChatResult<{ status: 'registered' }>> {
    try {
        const parsed = registerActivitySchema.safeParse({ activityId })
        if (!parsed.success) {
            return { success: false, error: ClubChatError.INVALID_CONTENT, message: '参数无效' }
        }

        // Auth
        const userId = await getAuthUserId()
        if (!userId) {
            return { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' }
        }

        // Find activity
        const activity = await prisma.club_activities.findUnique({
            where: { id: activityId },
            select: { club_id: true, max_participants: true },
        })
        if (!activity) {
            return { success: false, error: ClubChatError.ACTIVITY_NOT_FOUND, message: '活动不存在' }
        }

        // Membership
        const membership = await checkClubMembership(userId, activity.club_id)
        if (!membership.isMember) {
            return { success: false, error: ClubChatError.CLUB_NOT_MEMBER, message: '你不是该俱乐部成员' }
        }

        // Check max_participants limit
        if (activity.max_participants != null) {
            const currentCount = await prisma.club_activity_registrations.count({
                where: { activity_id: activityId, status: 'registered' },
            })
            if (currentCount >= activity.max_participants) {
                return { success: false, error: ClubChatError.ACTIVITY_FULL, message: '活动报名已满' }
            }
        }

        // Check existing registration
        const existing = await prisma.club_activity_registrations.findUnique({
            where: { user_id_activity_id: { user_id: userId, activity_id: activityId } },
        })

        if (existing) {
            if (existing.status === 'registered') {
                return { success: false, error: ClubChatError.ALREADY_REGISTERED, message: '你已经报名了' }
            }
            // Re-register (was previously canceled)
            await prisma.club_activity_registrations.update({
                where: { id: existing.id },
                data: { status: 'registered', registered_at: new Date() },
            })
        } else {
            await prisma.club_activity_registrations.create({
                data: {
                    activity_id: activityId,
                    user_id: userId,
                    club_id: activity.club_id,
                    status: 'registered',
                },
            })
        }

        return { success: true, data: { status: 'registered' } }
    } catch (error) {
        console.error('[registerForActivity] Error:', error)
        return { success: false, error: ClubChatError.INTERNAL_ERROR, message: '报名失败' }
    }
}

// ─── 4. Cancel Registration (member) ──────────────────────────
export async function cancelRegistration(
    activityId: string
): Promise<ClubChatResult<{ status: 'canceled' }>> {
    try {
        const parsed = registerActivitySchema.safeParse({ activityId })
        if (!parsed.success) {
            return { success: false, error: ClubChatError.INVALID_CONTENT, message: '参数无效' }
        }

        // Auth
        const userId = await getAuthUserId()
        if (!userId) {
            return { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' }
        }

        // Find activity for club_id
        const activity = await prisma.club_activities.findUnique({
            where: { id: activityId },
            select: { club_id: true },
        })
        if (!activity) {
            return { success: false, error: ClubChatError.ACTIVITY_NOT_FOUND, message: '活动不存在' }
        }

        // Membership
        const membership = await checkClubMembership(userId, activity.club_id)
        if (!membership.isMember) {
            return { success: false, error: ClubChatError.CLUB_NOT_MEMBER, message: '你不是该俱乐部成员' }
        }

        // Find existing registration — must be 'registered' to cancel
        const registration = await prisma.club_activity_registrations.findUnique({
            where: { user_id_activity_id: { user_id: userId, activity_id: activityId } },
        })

        if (!registration || registration.status !== 'registered') {
            return { success: false, error: ClubChatError.NOT_REGISTERED, message: '你尚未报名该活动' }
        }

        await prisma.club_activity_registrations.update({
            where: { id: registration.id },
            data: { status: 'canceled' },
        })

        return { success: true, data: { status: 'canceled' } }
    } catch (error) {
        console.error('[cancelRegistration] Error:', error)
        return { success: false, error: ClubChatError.INTERNAL_ERROR, message: '取消报名失败' }
    }
}

// ─── 5. Get Activity Registrations ─────────────────────────────
export async function getActivityRegistrations(
    activityId: string
): Promise<ClubChatResult<ClubActivityRegistration[]>> {
    try {
        const parsed = registerActivitySchema.safeParse({ activityId })
        if (!parsed.success) {
            return { success: false, error: ClubChatError.INVALID_CONTENT, message: '参数无效' }
        }

        // Auth
        const userId = await getAuthUserId()
        if (!userId) {
            return { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' }
        }

        // Find activity
        const activity = await prisma.club_activities.findUnique({
            where: { id: activityId },
            select: { club_id: true },
        })
        if (!activity) {
            return { success: false, error: ClubChatError.ACTIVITY_NOT_FOUND, message: '活动不存在' }
        }

        // Membership
        const membership = await checkClubMembership(userId, activity.club_id)
        if (!membership.isMember) {
            return { success: false, error: ClubChatError.CLUB_NOT_MEMBER, message: '你不是该俱乐部成员' }
        }

        const registrations = await prisma.club_activity_registrations.findMany({
            where: { activity_id: activityId, status: 'registered' },
            orderBy: { registered_at: 'asc' },
            include: {
                profiles: {
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
            data: registrations.map((r): ClubActivityRegistration => ({
                id: r.id,
                activityId: r.activity_id,
                userId: r.user_id,
                status: r.status as 'registered' | 'canceled',
                registeredAt: r.registered_at.toISOString(),
                user: {
                    id: r.profiles.id,
                    nickname: r.profiles.nickname,
                    avatarUrl: r.profiles.avatar_url,
                },
            })),
        }
    } catch (error) {
        console.error('[getActivityRegistrations] Error:', error)
        return { success: false, error: ClubChatError.INTERNAL_ERROR, message: '获取报名列表失败' }
    }
}

// ─── 6. Complete Activity (member) ─────────────────────────────
/**
 * 标记活动为已完成
 * 1. 验证报名状态
 * 2. 事务内更新状态并统计名次（防止 Top 3 竞态）
 * 3. 发射 ACTIVITY_COMPLETED 事件
 */
export async function completeActivityAction(
    activityId: string
): Promise<ClubChatResult<{ status: 'completed'; isTopThree: boolean }>> {
    try {
        const userId = await getAuthUserId()
        if (!userId) {
            return { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' }
        }

        // 1. 检查是否存在报名且未完成
        const registration = await prisma.club_activity_registrations.findUnique({
            where: { user_id_activity_id: { user_id: userId, activity_id: activityId } },
            select: { id: true, status: true, club_id: true }
        })

        if (!registration || registration.status !== 'registered') {
            return { success: false, error: ClubChatError.NOT_REGISTERED, message: '未找到有效报名记录' }
        }

        // 2. 事务处理：更新状态并计算名次
        const result = await prisma.$transaction(async (tx) => {
            // 更新状态
            await tx.club_activity_registrations.update({
                where: { id: registration.id },
                data: { status: 'completed' }
            })

            // 统计此活动已完成人数（包含当前用户）
            const completionCount = await tx.club_activity_registrations.count({
                where: { activity_id: activityId, status: 'completed' }
            })

            return {
                isTopThree: completionCount <= 3
            }
        })

        // 3. 发射事件 (Post-TX)
        eventBus.emit({
            type: 'ACTIVITY_COMPLETED',
            userId,
            activityId,
            clubId: registration.club_id || undefined,
            isTopThree: result.isTopThree
        }).catch(err => console.error('[completeActivityAction] Event emit failed:', err))

        return { 
            success: true, 
            data: { 
                status: 'completed', 
                isTopThree: result.isTopThree 
            } 
        }

    } catch (error) {
        console.error('[completeActivityAction] Error:', error)
        return { success: false, error: ClubChatError.INTERNAL_ERROR, message: '操作失败' }
    }
}
