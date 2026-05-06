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
        const { prisma } = await import('@/lib/prisma')

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
        const thirtySecsAgo = new Date(Date.now() - 30 * 1000)
        const recentReport = await prisma.territory_reports.findFirst({
            where: {
                reporter_id: user.id,
                territory_id: validated.territoryId,
                created_at: { gte: thirtySecsAgo }
            },
            select: { id: true }
        })

        if (recentReport) {
            return { success: false, error: '提交过于频繁，请稍后再试' }
        }

        // 4. Insert report
        try {
            await prisma.territory_reports.create({
                data: {
                    reporter_id: user.id,
                    territory_id: validated.territoryId,
                    reported_user_id: validated.reportedUserId,
                    reason: validated.reason,
                    snapshot: validated.snapshot ? JSON.stringify(validated.snapshot) : undefined
                }
            })
        } catch (insertError: any) {
            // Prisma error codes: P2002 is unique violation
            if (insertError.code === 'P2002') {
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
