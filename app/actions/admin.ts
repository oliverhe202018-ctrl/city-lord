'use server'

import { requireAdminSession } from '@/lib/admin/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'


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
