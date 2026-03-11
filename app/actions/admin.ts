'use server'

import { requireAdminSession } from '@/lib/admin/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
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
            supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
            supabaseAdmin.from('clubs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
            supabaseAdmin.from('clubs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('faction', 'Red'),
            supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('faction', 'Blue'),
            supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
            // faction stats
            getFactionStats(),
            // trend data
            supabaseAdmin.rpc('get_user_growth_trend'),
            // recent audit logs
            supabaseAdmin
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

        let query = supabaseAdmin

            .from('profiles')
            .select('id, nickname, avatar_url, created_at')
            .order('created_at', { ascending: false })
            .limit(100)

        if (searchQuery) {
            query = query.ilike('nickname', `%${searchQuery}%`)
        }

        const { data, error } = await query

        if (error) throw error

        return { success: true, data }
    } catch (error: any) {
        console.error('getAdminUsers error:', error)
        return { success: false, error: error.message }
    }
}

export async function getAdminRooms(searchQuery?: string) {
    try {
        await requireAdminSession()

        let query = supabaseAdmin

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

        const { data, error } = await supabaseAdmin

            .from('missions')
            .select('id, title, description, type, target, frequency, reward_coins, reward_experience, created_at')
            .order('created_at', { ascending: false })
            .limit(100)

        if (error) throw error

        return { success: true, data }
    } catch (error: any) {
        console.error('getAdminMissions error:', error)
        return { success: false, error: error.message }
    }
}
