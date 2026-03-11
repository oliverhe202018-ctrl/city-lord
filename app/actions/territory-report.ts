'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const reportSchema = z.object({
    territoryId: z.string().min(1),
    reportedUserId: z.string().uuid(),
    reason: z.string().min(1, '请输入举报内容').max(500, '举报内容最多500字'),
    snapshot: z.record(z.any()).optional()
})

export type SubmitReportParams = z.infer<typeof reportSchema>

export async function submitTerritoryReport(params: SubmitReportParams) {
    try {
        const supabase = await createClient()

        // 1. Check auth
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { success: false, error: '未登录' }
        }

        // 2. Validate params
        const validated = reportSchema.parse(params)

        if (validated.reportedUserId === user.id) {
            return { success: false, error: '不能举报自己的领地' }
        }

        // 3. Application-level deduplication: 1/user/territory/30s
        const thirtySecsAgo = new Date(Date.now() - 30 * 1000).toISOString()
        // @ts-ignore: territory_reports table is newly created, types not yet regenerated
        const { data: recentReport, error: checkError } = await supabase
            .from('territory_reports')
            .select('id')
            .eq('reporter_id', user.id)
            .eq('territory_id', validated.territoryId)
            .gte('created_at', thirtySecsAgo)
            .limit(1)
            .maybeSingle()

        if (checkError) {
            console.error('Failed to check recent reports:', checkError)
            return { success: false, error: '服务器错误，请稍后重试' }
        }

        if (recentReport) {
            return { success: false, error: '提交过于频繁，请稍后再试' }
        }

        // 4. Insert report
        // The database partial unique index will catch if there is already a PENDING report
        // @ts-ignore: territory_reports table is newly created, types not yet regenerated
        const { error: insertError } = await supabase
            .from('territory_reports')
            // @ts-ignore: territory_reports table is newly created, types not yet regenerated
            .insert({
                reporter_id: user.id,
                territory_id: validated.territoryId,
                reported_user_id: validated.reportedUserId,
                reason: validated.reason,
                snapshot: validated.snapshot
            })

        if (insertError) {
            // 23505 is PostgreSQL unique violation error code
            if (insertError.code === '23505') {
                return { success: false, error: '您已举报过该领地，我们正在处理中' }
            }
            console.error('Failed to insert territory report:', insertError)
            return { success: false, error: '提交失败，请重试' }
        }

        return { success: true }
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            return { success: false, error: err.errors[0].message }
        }
        console.error('submitTerritoryReport error:', err)
        return { success: false, error: '系统错误' }
    }
}
