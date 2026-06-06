'use server'

import { requireAdminSession } from '@/lib/admin/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getFactionStats } from '@/app/actions/faction'

export async function getAdminDashboardData() {
    try {
        await requireAdminSession()

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const [
            { count: totalUsers },
            { count: activeClubs },
            { count: pendingClubs },
            { count: redFaction },
            { count: blueFaction },
            { count: newUsersToday },
            factionStatsRes,
            trendRes,
            logsRes
        ] = await Promise.all([
            // summary data
            getSupabaseAdmin().from('profiles').select('*', { count: 'exact', head: true }),
            getSupabaseAdmin().from('clubs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
            getSupabaseAdmin().from('clubs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            getSupabaseAdmin().from('profiles').select('*', { count: 'exact', head: true }).eq('faction', 'Red'),
            getSupabaseAdmin().from('profiles').select('*', { count: 'exact', head: true }).eq('faction', 'Blue'),
            getSupabaseAdmin().from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
            // faction stats
            getFactionStats(),
            // trend data
            getSupabaseAdmin().rpc('get_user_growth_trend'),
            // recent audit logs
            getSupabaseAdmin()
                .from('admin_logs')
                .select('id, admin_id, action, target_id, details, created_at')
                .order('created_at', { ascending: false })
                .limit(10)
        ])

        const summary = {
            total_users: totalUsers || 0,
            total_clubs: activeClubs || 0,
            pending_audit: pendingClubs || 0,
            red_faction: redFaction || 0,
            blue_faction: blueFaction || 0,
            new_users_today: newUsersToday || 0
        }

        const factionStats = {
            red_faction: factionStatsRes?.RED || 0,
            blue_faction: factionStatsRes?.BLUE || 0,
            redArea: factionStatsRes?.redArea || 0,
            blueArea: factionStatsRes?.blueArea || 0,
            percentages: factionStatsRes?.percentages || { RED: 50, BLUE: 50 },
            bonus: factionStatsRes?.bonus || { RED: 0, BLUE: 0 }
        }

        return {
            success: true,
            data: {
                summary,
                factionStats,
                trend: trendRes.data || [],
                logs: logsRes.data || []
            }
        }
    } catch (error: any) {
        console.error('getAdminDashboardData error:', error)
        return { success: false, error: error.message }
    }
}

export async function getAdminUsers(searchQuery?: string) {
    try {
        await requireAdminSession()

        const { prisma } = await import('@/lib/prisma')
        
        let sql = `
            SELECT 
                p.id, p.nickname, p.avatar_url, p.created_at, p.bypass_anti_cheat, 
                p.level, p.total_area, p.xp, p.total_distance_km, p.coins, 
                p.faction, p.is_active, p.total_runs_count, p.club_id, p.stamina, p.max_stamina,
                u.email, u.phone
            FROM public.profiles p
            LEFT JOIN auth.users u ON p.id = u.id
        `
        
        const params: any[] = []
        if (searchQuery) {
            sql += ` WHERE p.nickname ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1`
            params.push(`%${searchQuery}%`)
        }
        
        sql += ` ORDER BY p.created_at DESC LIMIT 100`
        
        const data = await prisma.$queryRawUnsafe<any[]>(sql, ...params)
        
        const formattedData = data.map(u => ({
            ...u,
            created_at: u.created_at instanceof Date ? u.created_at.toISOString() : u.created_at,
            total_area: u.total_area != null ? Number(u.total_area) : 0,
            total_distance_km: u.total_distance_km != null ? Number(u.total_distance_km) : 0,
        }))

        return { success: true, data: formattedData }
    } catch (error: any) {
        console.error('getAdminUsers error:', error)
        return { success: false, error: error.message }
    }
}

export async function toggleUserAntiCheatBypass(userId: string, bypass: boolean) {
    try {
        await requireAdminSession()

        const { error } = await getSupabaseAdmin()
            .from('profiles')
            .update({ bypass_anti_cheat: bypass })
            .eq('id', userId)

        if (error) throw error

        // Also add an admin log
        const { data: userData } = await getSupabaseAdmin().auth.getUser()
        if (userData?.user) {
            await getSupabaseAdmin().from('admin_logs').insert({
                admin_id: userData.user.id,
                action: 'UPDATE_ANTI_CHEAT_BYPASS',
                target_id: userId,
                details: `Set bypass_anti_cheat to ${bypass}`
            })
        }

        return { success: true }
    } catch (error: any) {
        console.error('toggleUserAntiCheatBypass error:', error)
        return { success: false, error: error.message }
    }
}

export async function toggleUserActiveStatus(userId: string, isActive: boolean) {
    try {
        await requireAdminSession()

        const { error } = await getSupabaseAdmin()
            .from('profiles')
            .update({ is_active: isActive })
            .eq('id', userId)

        if (error) throw error

        // Also add an admin log
        const { data: userData } = await getSupabaseAdmin().auth.getUser()
        if (userData?.user) {
            await getSupabaseAdmin().from('admin_logs').insert({
                admin_id: userData.user.id,
                action: isActive ? 'UNBAN_USER' : 'BAN_USER',
                target_id: userId,
                details: `Set is_active to ${isActive}`
            })
        }

        return { success: true }
    } catch (error: any) {
        console.error('toggleUserActiveStatus error:', error)
        return { success: false, error: error.message }
    }
}

export async function getAdminRooms(searchQuery?: string) {
    try {
        await requireAdminSession()

        let query = getSupabaseAdmin()

            .from('rooms')
            .select('id, name, host_id, status, max_participants, is_private, created_at, is_banned, host_profile:profiles!rooms_host_id_fkey(nickname), participants:room_participants(count)')
            .order('created_at', { ascending: false })
            .limit(100)

        if (searchQuery) {
            query = query.ilike('name', `%${searchQuery}%`)
        }

        const { data, error } = await query

        if (error) throw error

        return { success: true, data }
    } catch (error: any) {
        console.error('getAdminRooms error:', error)
        return { success: false, error: error.message }
    }
}

export async function getAdminMissions() {
    try {
        await requireAdminSession()

        // Use Prisma to fetch missions to avoid Supabase schema/RLS mismatch errors
        const { prisma } = await import('@/lib/prisma')
        const data = await prisma.missions.findMany({
            select: {
                id: true,
                title: true,
                description: true,
                type: true,
                target: true,
                frequency: true,
                reward_coins: true,
                reward_experience: true,
                created_at: true,
            },
            orderBy: { created_at: 'desc' },
            take: 100,
        })

        // Format dates to string to match Supabase response format for the frontend
        const formattedData = data.map(m => ({
            ...m,
            created_at: m.created_at?.toISOString()
        }))

        return { success: true, data: formattedData }
    } catch (error: any) {
        console.error('getAdminMissions error:', error)
        return { success: false, error: error.message }
    }
}
