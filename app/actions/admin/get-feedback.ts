'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export type UnifiedFeedbackSource = 'feedback' | 'report' | 'territory_report'

export interface UnifiedFeedback {
    id: string;
    source: UnifiedFeedbackSource;
    user_id: string | null;
    reporter_name: string;
    content: string; // details or reason
    contact_info: string; // feedback contact or "动态举报" or "领地举报"
    screenshot_url: string | null;
    status: string; // pending, resolved, ignored, PENDING, REVIEWED, DISMISSED
    created_at: string;

    // Custom fields
    post_id?: string;
    post_content?: string;
    post_media?: string[];
    territory_id?: string;
    reported_user_id?: string;
    reported_user_name?: string;
}

export async function getAdminFeedbackData(): Promise<{ data: UnifiedFeedback[] | null, error: string | null }> {
    try {
        const supabase = await createClient()

        // 1. Verify admin session
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        if (authError || !session?.user) {
            return { data: null, error: 'Unauthorized' }
        }

        // Role check ensures admin privileges
        const { data: adminRole } = await supabase
            .from('app_admins')
            .select('role')
            .eq('user_id', session.user.id)
            .single()

        if (!adminRole) {
            return { data: null, error: 'Forbidden' }
        }

        // 2. Fetch all data concurrently
        const [feedbackRes, reportRes, territoryRes] = await Promise.all([
            supabase
                .from('feedback')
                .select(`*, profiles:user_id (nickname)`)
                .order('created_at', { ascending: false }),
            supabase
                .from('post_reports')
                .select(`*, reporter:profiles!post_reports_user_id_fkey (nickname), post:posts!post_reports_post_id_fkey (content, media_urls)`)
                .order('created_at', { ascending: false }),
            supabase
                .from('territory_reports')
                .select(`*, reporter:profiles!territory_reports_reporter_id_fkey (nickname), reported:profiles!territory_reports_reported_user_id_fkey (nickname)`)
                .order('created_at', { ascending: false })
        ])

        let normalizedData: UnifiedFeedback[] = []

        if (feedbackRes.data) {
            normalizedData.push(...feedbackRes.data.map((f: any) => ({
                id: f.id,
                source: 'feedback' as const,
                user_id: f.user_id,
                reporter_name: f.profiles?.nickname || '匿名/未知',
                content: f.content,
                contact_info: f.contact_info || '',
                screenshot_url: f.screenshot_url,
                status: f.status,
                created_at: f.created_at
            })))
        }

        if (reportRes.data) {
            normalizedData.push(...reportRes.data.map((r: any) => ({
                id: r.id,
                source: 'report' as const,
                user_id: r.user_id, // technically reporter
                reporter_name: r.reporter?.nickname || '未知用户',
                content: r.reason,
                contact_info: '动态圈举报',
                screenshot_url: null,
                status: r.status,
                created_at: r.created_at,
                post_id: r.post_id,
                post_content: r.post?.content || '[内容已删除]',
                post_media: r.post?.media_urls || []
            })))
        }

        if (territoryRes.data) {
            normalizedData.push(...territoryRes.data.map((t: any) => ({
                id: t.id,
                source: 'territory_report' as const,
                user_id: t.reporter_id,
                reporter_name: t.reporter?.nickname || '未知用户',
                content: t.reason,
                contact_info: '领地举报',
                screenshot_url: null, // Using snapshot data in a custom way if needed
                status: t.status,
                created_at: t.created_at,
                territory_id: t.territory_id,
                reported_user_id: t.reported_user_id,
                reported_user_name: t.reported?.nickname || '未知用户',
            })))
        }

        // Sort combined array by created_at descending
        normalizedData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        return { data: normalizedData, error: null }
    } catch (err: any) {
        console.error('Failed to fetch admin feedback data:', err)
        return { data: null, error: err.message || 'Internal error' }
    }
}
