'use server'

import { prisma } from '@/lib/prisma'

export type DynamicItem = {
    id: string
    type: 'new_member' | 'rank_change' | 'activity_created' | 'territory_expanded' | 'member_milestone'
    title: string
    description: string
    avatarUrl?: string | null
    timestamp: string
    meta?: Record<string, any>
}

/**
 * Fetch recent club dynamics (new members, activities, territory runs, etc.)
 * Returns last 7 days of combined events sorted by time desc
 */
export async function getClubDynamics(clubId: string): Promise<DynamicItem[]> {
    try {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const items: DynamicItem[] = []

        // 1. New members joined in the last 7 days
        const newMembers = await prisma.club_members.findMany({
            where: {
                club_id: clubId,
                status: 'active',
                joined_at: { gte: sevenDaysAgo },
            },
            include: {
                profiles: {
                    select: { nickname: true, avatar_url: true },
                },
            },
            orderBy: { joined_at: 'desc' },
            take: 20,
        })

        for (const m of newMembers) {
            items.push({
                id: `member_${m.user_id}`,
                type: 'new_member',
                title: '新成员加入',
                description: `${m.profiles?.nickname || '未知用户'} 加入了俱乐部`,
                avatarUrl: m.profiles?.avatar_url,
                timestamp: m.joined_at.toISOString(),
            })
        }

        // 2. Recent activities created
        const activities = await prisma.club_activities.findMany({
            where: {
                club_id: clubId,
                created_at: { gte: sevenDaysAgo },
            },
            orderBy: { created_at: 'desc' },
            take: 10,
            include: {
                // @ts-expect-error - FIXME: Object literal may only specify known properties, and 'profiles' does  - [Ticket-202603-SchemaSync] baseline exemption
                profiles: {
                    select: { nickname: true, avatar_url: true },
                },
            },
        })

        for (const a of activities) {
            items.push({
                id: `activity_${a.id}`,
                type: 'activity_created',
                title: '新活动发布',
                description: `${(a as any).profiles?.nickname || '管理员'} 发布了活动「${a.title}」`,
                avatarUrl: (a as any).profiles?.avatar_url,
                timestamp: a.created_at.toISOString(),
            })
        }

        // 3. Recent territory runs (runs with area > 0)
        const runs = await prisma.runs.findMany({
            where: {
                club_id: clubId,
                created_at: { gte: sevenDaysAgo },
                area: { gt: 0 },
            },
            orderBy: { created_at: 'desc' },
            take: 10,
            include: {
                profiles: {
                    select: { nickname: true, avatar_url: true },
                },
            },
        })

        for (const r of runs) {
            const rawArea = Number(r.area || 0)
            const areaDisplay = rawArea < 1000
                ? `${Math.round(rawArea)} ㎡`
                : rawArea < 1000000
                    ? `${(rawArea / 1000).toFixed(1)} k㎡`
                    : `${(rawArea / 1000000).toFixed(2)} km²`
            items.push({
                id: `run_${r.id}`,
                type: 'territory_expanded',
                title: '领地拓展',
                description: `${r.profiles?.nickname || '成员'} 跑步开拓了 ${areaDisplay} 领地`,
                avatarUrl: r.profiles?.avatar_url,
                // @ts-expect-error - FIXME: 'r.created_at' is possibly 'null'. - [Ticket-202603-SchemaSync] baseline exemption
                timestamp: r.created_at.toISOString(),
            })
        }

        // 4. Member milestones (e.g., badges earned)
        const badges = await prisma.user_badges.findMany({
            where: {
                earned_at: { gte: sevenDaysAgo },
                profiles: {
                    club_id: clubId,
                },
            },
            include: {
                profiles: {
                    select: { nickname: true, avatar_url: true },
                },
            },
            orderBy: { earned_at: 'desc' },
            take: 10,
        })

        for (const b of badges) {
            items.push({
                id: `badge_${b.id}`,
                type: 'member_milestone',
                title: '成就达成',
                // @ts-expect-error - FIXME: Property 'badge_name' does not exist on type '{ profiles: { avatar_url - [Ticket-202603-SchemaSync] baseline exemption
                description: `${b.profiles?.nickname || '成员'} 获得了「${b.badge_name}」成就`,
                avatarUrl: b.profiles?.avatar_url,
                // @ts-expect-error - FIXME: 'b.earned_at' is possibly 'null'. - [Ticket-202603-SchemaSync] baseline exemption
                timestamp: b.earned_at.toISOString(),
            })
        }

        // Sort all items by timestamp descending
        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

        // Return top 30
        return items.slice(0, 30)
    } catch (error) {
        console.error('[getClubDynamics] Error:', error)
        return []
    }
}
