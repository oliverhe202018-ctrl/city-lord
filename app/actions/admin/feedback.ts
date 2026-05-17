'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/admin/auth'

function getAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
    }

    return createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}

export async function updateFeedbackStatus(id: string, source: 'feedback' | 'report' | 'territory_report', newStatus: string) {
    // 1. Strictly require admin session (verifies signed token)
    await requireAdminSession()

    // 2. Perform the update using the Service Role Admin Client
    try {
        const adminClient = getAdminClient()
        const table = source === 'feedback' ? 'feedback' : (source === 'report' ? 'post_reports' : 'territory_reports')

        const { error } = await adminClient
            .from(table)
            .update({ status: newStatus })
            .eq('id', id)

        if (error) {
            console.error('[updateFeedbackStatus] DB Error:', error)
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (e: any) {
        console.error('[updateFeedbackStatus] Exception:', e)
        return { success: false, error: e.message || '操作失败' }
    }
}
