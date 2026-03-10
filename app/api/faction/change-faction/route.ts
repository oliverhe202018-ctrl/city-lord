import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/faction/change-faction
 * Body: { faction: 'RED' | 'BLUE' }
 * 
 * 变更阵营，每周仅可变更一次。
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 })
        }

        const body = await request.json()
        const { faction } = body || {}

        if (!faction || !['RED', 'BLUE'].includes(faction)) {
            return NextResponse.json({ error: '无效的阵营参数' }, { status: 400 })
        }

        // 查询当前阵营和上次变更时间
        const profile = await prisma.profiles.findUnique({
            where: { id: user.id },
            select: { faction: true, last_faction_change_at: true }
        })

        if (!profile) {
            return NextResponse.json({ error: '用户档案不存在' }, { status: 404 })
        }

        // 阵营名转换 (API uses RED/BLUE, DB uses Red/Blue)
        const targetFactionDb = faction === 'RED' ? 'Red' : 'Blue'
        const currentFactionDb = profile.faction

        if (currentFactionDb === targetFactionDb) {
            return NextResponse.json({ error: '已经是该阵营成员' }, { status: 400 })
        }

        // 检查 1 周冷却
        if (profile.last_faction_change_at) {
            const lastChange = new Date(profile.last_faction_change_at)
            const now = new Date()
            const diffMs = now.getTime() - lastChange.getTime()
            const oneWeekMs = 7 * 24 * 60 * 60 * 1000

            if (diffMs < oneWeekMs) {
                const nextAvailable = new Date(lastChange.getTime() + oneWeekMs)
                return NextResponse.json({
                    error: '每周仅可变更一次阵营',
                    nextAvailable: nextAvailable.toISOString(),
                    remainingHours: Math.ceil((oneWeekMs - diffMs) / (60 * 60 * 1000))
                }, { status: 429 })
            }
        }

        // 执行变更 (Prisma)
        await prisma.profiles.update({
            where: { id: user.id },
            data: {
                faction: targetFactionDb,
                last_faction_change_at: new Date()
            }
        })

        // Phase 2B-2B: Faction Change Purge
        const FF_FACTION_PURGE_ENABLED = true; // Feature Flag
        if (FF_FACTION_PURGE_ENABLED) {
            try {
                // 需要使用 supabaseAdmin 来绕过 RLS 强制更新
                const { supabaseAdmin } = await import('@/lib/supabase/admin');
                const { error: purgeError } = await supabaseAdmin.rpc('purge_faction_territories', {
                    p_user_id: user.id
                });
                if (purgeError) {
                    console.error('Failed to purge territories on faction change:', purgeError);
                }
            } catch (e) {
                console.error('Exception purging territories on faction change:', e);
            }
        }

        return NextResponse.json({
            success: true,
            faction: faction,
            message: `已成功转入${faction === 'RED' ? '赤红先锋' : '蔚蓝联盟'}`
        })
    } catch (error: any) {
        console.error('changeFaction error:', error)
        return NextResponse.json(
            { success: false, error: error.message || '变更失败' },
            { status: 500 }
        )
    }
}
