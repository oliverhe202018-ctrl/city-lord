'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// ─── Types ──────────────────────────────────────────────
export interface UserProfileBasic {
    id: string
    nickname: string | null
    avatarUrl: string | null
    level: number | null
    backgroundUrl: string | null
    badges: string[]
}

export interface RunRecord {
    id: string
    distanceKm: number
    durationSeconds: number
    durationStr: string
    paceMinPerKm: string
    calories: number
    createdAt: string
    province: string | null
}

export interface PersonalBest {
    distance: string
    time: string | null
}

export interface WeeklyDistance {
    day: string
    distance: number
}

export interface ProfileStats {
    following: number
    followers: number
    totalRuns: number
    totalDistanceKm: number
    personalBests: PersonalBest[]
    weeklyDistances: WeeklyDistance[]
    likeCount: number
    isLikedByMe: boolean
}

export type ProfileDataResult =
    | {
        isPrivate: false
        isSelf: boolean
        user: UserProfileBasic
        stats: ProfileStats
        isFollowing: boolean
        isProfilePublic: boolean
    }
    | {
        isPrivate: true
        isSelf: false
        user: UserProfileBasic
    }

// ─── Helpers ──────────────────────────────────────────────
function formatDuration(seconds: number): string {
    if (!seconds) return '00:00:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatPace(seconds: number, km: number): string {
    if (!km || km === 0) return "00'00\""
    const paceSeconds = seconds / km
    const m = Math.floor(paceSeconds / 60)
    const s = Math.floor(paceSeconds % 60)
    return `${m}'${s.toString().padStart(2, '0')}"`
}

// ─── getProfileData ──────────────────────────────────────
export async function getProfileData(targetUserId: string): Promise<ProfileDataResult> {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const currentUserId = currentUser?.id ?? null
    const isSelf = currentUserId === targetUserId

    // Fetch target user's basic info
    const profile = await prisma.profiles.findUnique({
        where: { id: targetUserId },
        select: {
            id: true,
            nickname: true,
            avatar_url: true,
            level: true,
            backgroundUrl: true,
            badges: true,
            isProfilePublic: true,
            total_distance_km: true,
        },
    })

    if (!profile) {
        return {
            isPrivate: true,
            isSelf: false,
            user: {
                id: targetUserId,
                nickname: '未知用户',
                avatarUrl: null,
                level: 1,
                backgroundUrl: null,
                badges: [],
            },
        }
    }

    const basicUser: UserProfileBasic = {
        id: profile.id,
        nickname: profile.nickname,
        avatarUrl: profile.avatar_url,
        level: profile.level,
        backgroundUrl: profile.backgroundUrl,
        badges: profile.badges,
    }

    // SERVER-SIDE PRIVACY GUARD: if private and not self, return ONLY basic info
    if (!profile.isProfilePublic && !isSelf) {
        return {
            isPrivate: true,
            isSelf: false,
            user: basicUser,
        }
    }

    // Fetch full stats
    const [
        totalRuns,
        likeCount,
        isLikedByMe,
        followingCount,
        followersCount,
        recentRuns,
    ] = await Promise.all([
        prisma.runs.count({ where: { user_id: targetUserId } }),
        prisma.profile_likes.count({ where: { userId: targetUserId } }),
        currentUserId
            ? prisma.profile_likes.count({
                where: { userId: targetUserId, likerId: currentUserId },
            }).then(c => c > 0)
            : Promise.resolve(false),
        prisma.friendships.count({
            where: { user_id: targetUserId, status: 'accepted' },
        }),
        prisma.friendships.count({
            where: { friend_id: targetUserId, status: 'accepted' },
        }),
        // For PB calculation, get all runs
        prisma.runs.findMany({
            where: { user_id: targetUserId },
            select: { distance: true, duration: true, created_at: true },
            orderBy: { created_at: 'desc' },
        }),
    ])

    // Calculate PBs for 1km, 5km, 10km
    const pbDistances = [1, 5, 10]
    const personalBests: PersonalBest[] = pbDistances.map(d => {
        const qualifying = recentRuns.filter(r => {
            const dist = (r.distance ?? 0) > 1000 ? (r.distance ?? 0) / 1000 : (r.distance ?? 0)
            return dist >= d
        })
        if (qualifying.length === 0) return { distance: `${d}km`, time: null }

        // Best pace (lowest time per km) for that distance
        const bestRun = qualifying.reduce((best, run) => {
            const dist = (run.distance ?? 0) > 1000 ? (run.distance ?? 0) / 1000 : (run.distance ?? 0)
            const pace = run.duration / dist
            const bestDist = (best.distance ?? 0) > 1000 ? (best.distance ?? 0) / 1000 : (best.distance ?? 0)
            const bestPace = best.duration / bestDist
            return pace < bestPace ? run : best
        })
        const bestDist = (bestRun.distance ?? 0) > 1000 ? (bestRun.distance ?? 0) / 1000 : (bestRun.distance ?? 0)
        const estimatedTime = Math.round((bestRun.duration / bestDist) * d)
        return { distance: `${d}km`, time: formatDuration(estimatedTime) }
    })

    // Calculate weekly distances (last 7 days)
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weekRuns = recentRuns.filter(r => r.created_at && new Date(r.created_at) >= weekAgo)

    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weeklyDistances: WeeklyDistance[] = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000)
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
        const dayRuns = weekRuns.filter(r => {
            const d = new Date(r.created_at!)
            return d >= dayStart && d < dayEnd
        })
        const totalDist = dayRuns.reduce((sum, r) => {
            const d = (r.distance ?? 0) > 1000 ? (r.distance ?? 0) / 1000 : (r.distance ?? 0)
            return sum + d
        }, 0)
        return {
            day: dayNames[date.getDay()],
            distance: Math.round(totalDist * 100) / 100,
        }
    })

    // Check following status
    let isFollowing = false
    if (currentUserId && !isSelf) {
        const friendship = await prisma.friendships.findFirst({
            where: {
                user_id: currentUserId,
                friend_id: targetUserId,
                status: 'accepted',
            },
        })
        isFollowing = !!friendship
    }

    return {
        isPrivate: false,
        isSelf,
        user: basicUser,
        stats: {
            following: followingCount,
            followers: followersCount,
            totalRuns,
            totalDistanceKm: profile.total_distance_km ?? 0,
            personalBests,
            weeklyDistances,
            likeCount,
            isLikedByMe,
        },
        isFollowing,
        isProfilePublic: profile.isProfilePublic,
    }
}

// ─── getRuns (Cursor-based pagination) ──────────────────
export async function getRuns(
    userId: string,
    cursor?: string,
    limit: number = 10
): Promise<{ runs: RunRecord[]; nextCursor: string | null }> {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const isSelf = currentUser?.id === userId

    // Server-side privacy check
    if (!isSelf) {
        const profile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { isProfilePublic: true },
        })
        if (!profile?.isProfilePublic) {
            return { runs: [], nextCursor: null }
        }
    }

    const runs = await prisma.runs.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: limit + 1,
        ...(cursor
            ? {
                cursor: { id: cursor },
                skip: 1,
            }
            : {}),
        select: {
            id: true,
            distance: true,
            duration: true,
            created_at: true,
            province: true,
        },
    })

    const hasMore = runs.length > limit
    const items = hasMore ? runs.slice(0, limit) : runs

    return {
        runs: items.map(run => {
            const distKm = (run.distance ?? 0) > 1000
                ? (run.distance ?? 0) / 1000
                : (run.distance ?? 0)
            const durationSec = run.duration
            return {
                id: run.id,
                distanceKm: Math.round(distKm * 100) / 100,
                durationSeconds: durationSec,
                durationStr: formatDuration(durationSec),
                paceMinPerKm: formatPace(durationSec, distKm),
                calories: Math.round(distKm * 60),
                createdAt: run.created_at?.toISOString() ?? '',
                province: run.province,
            }
        }),
        nextCursor: hasMore ? items[items.length - 1].id : null,
    }
}

// ─── toggleProfilePrivacy ────────────────────────────────
export async function toggleProfilePrivacy(isPublic: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: '未登录' }

    try {
        await prisma.profiles.update({
            where: { id: user.id },
            data: { isProfilePublic: isPublic },
        })
        return { success: true, isPublic }
    } catch (e: any) {
        console.error('toggleProfilePrivacy error:', e)
        return { success: false, error: e.message }
    }
}

// ─── updateProfileBackground ─────────────────────────────
export async function updateProfileBackground(bgId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: '未登录' }

    try {
        // Get background
        const bg = await prisma.backgrounds.findUnique({ where: { id: bgId } })
        if (!bg) return { success: false, error: '背景不存在' }

        // Check ownership
        const owned = await prisma.user_backgrounds.findUnique({
            where: { userId_backgroundId: { userId: user.id, backgroundId: bgId } },
        })

        // If free or already owned, allow
        if (!owned && bg.conditionType !== 'free') {
            return { success: false, error: '尚未解锁该背景' }
        }

        // Auto-acquire free backgrounds
        if (!owned && bg.conditionType === 'free') {
            await prisma.user_backgrounds.create({
                data: { userId: user.id, backgroundId: bgId },
            })
        }

        // Update profile
        await prisma.profiles.update({
            where: { id: user.id },
            data: { backgroundUrl: bg.imageUrl },
        })

        return { success: true, backgroundUrl: bg.imageUrl }
    } catch (e: any) {
        console.error('updateProfileBackground error:', e)
        return { success: false, error: e.message }
    }
}

// ─── toggleUserLike ──────────────────────────────────────
export async function toggleUserLike(targetUserId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: '未登录' }
    if (user.id === targetUserId) return { success: false, error: '不能给自己点赞' }

    try {
        const existing = await prisma.profile_likes.findUnique({
            where: { userId_likerId: { userId: targetUserId, likerId: user.id } },
        })

        if (existing) {
            await prisma.profile_likes.delete({ where: { id: existing.id } })
            const count = await prisma.profile_likes.count({
                where: { userId: targetUserId },
            })
            return { success: true, liked: false, likeCount: count }
        } else {
            await prisma.profile_likes.create({
                data: { userId: targetUserId, likerId: user.id },
            })
            const count = await prisma.profile_likes.count({
                where: { userId: targetUserId },
            })
            return { success: true, liked: true, likeCount: count }
        }
    } catch (e: any) {
        console.error('toggleUserLike error:', e)
        return { success: false, error: e.message }
    }
}

// ─── blockUser ───────────────────────────────────────────
export async function blockUser(targetUserId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: '未登录' }
    if (user.id === targetUserId) return { success: false, error: '不能屏蔽自己' }

    try {
        await prisma.blocked_users.upsert({
            where: {
                blockerId_blockedId: { blockerId: user.id, blockedId: targetUserId },
            },
            update: {},
            create: { blockerId: user.id, blockedId: targetUserId },
        })
        return { success: true }
    } catch (e: any) {
        console.error('blockUser error:', e)
        return { success: false, error: e.message }
    }
}

// ─── getBackgrounds ──────────────────────────────────────
export async function getBackgrounds(filter: 'all' | 'mine' | 'available' | 'expired' = 'all') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { backgrounds: [], currentBg: null }

    const [allBgs, userBgs, profile] = await Promise.all([
        prisma.backgrounds.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.user_backgrounds.findMany({
            where: { userId: user.id },
            select: { backgroundId: true },
        }),
        prisma.profiles.findUnique({
            where: { id: user.id },
            select: { backgroundUrl: true, level: true },
        }),
    ])

    const ownedIds = new Set(userBgs.map(ub => ub.backgroundId))

    const enriched = allBgs.map(bg => ({
        id: bg.id,
        name: bg.name,
        previewUrl: bg.previewUrl,
        imageUrl: bg.imageUrl,
        isDefault: bg.isDefault,
        conditionType: bg.conditionType,
        conditionValue: bg.conditionValue,
        priceCoins: bg.priceCoins,
        isOwned: ownedIds.has(bg.id) || bg.conditionType === 'free',
        isLocked: bg.conditionType === 'level'
            ? (profile?.level ?? 1) < (bg.conditionValue ?? 0)
            : bg.conditionType === 'coins',
        isActive: bg.imageUrl === profile?.backgroundUrl,
    }))

    let filtered = enriched
    if (filter === 'mine') filtered = enriched.filter(bg => bg.isOwned)
    else if (filter === 'available') filtered = enriched.filter(bg => !bg.isOwned && !bg.isLocked)
    else if (filter === 'expired') filtered = [] // placeholder for future

    const currentBg = enriched.find(bg => bg.isActive) ?? null

    return { backgrounds: filtered, currentBg }
}
