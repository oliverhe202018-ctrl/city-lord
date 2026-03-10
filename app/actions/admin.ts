'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'

export async function getAdminUsers(searchQuery?: string) {
    try {
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
        let query = supabaseAdmin
            .from('rooms')
            .select('id, name, host_id, is_active, max_players, created_at, host_profile:profiles!rooms_host_id_fkey(nickname)')
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
