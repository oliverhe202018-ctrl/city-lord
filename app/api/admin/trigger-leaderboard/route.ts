import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { distributeLeaderboardRewards } from '@/lib/game-logic/leaderboard-rewards'

/**
 * 管理员手动触发排行榜结算
 * 用于开发环境验收闭环，无需等待午夜 Cron
 * 
 * POST /api/admin/trigger-leaderboard
 * Body: { settlementDate?: string } // ISO date string, defaults to today
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Admin check
    const { data: admin } = await supabase
      .from('app_admins')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const settlementDate = body.settlementDate
      ? new Date(body.settlementDate)
      : new Date()

    // Validate date
    if (isNaN(settlementDate.getTime())) {
      return NextResponse.json({ error: 'Invalid settlementDate' }, { status: 400 })
    }

    const result = await distributeLeaderboardRewards(settlementDate)

    if (!result.success) {
      const status = result.error === 'ALREADY_SETTLED' ? 409 : 500
      return NextResponse.json(result, { status })
    }

    return NextResponse.json({
      success: true,
      message: `Leaderboard settled for ${settlementDate.toISOString().split('T')[0]}`,
      totalRewarded: result.totalRewarded,
      usersRewarded: result.details.length,
    })
  } catch (error: any) {
    console.error('trigger-leaderboard error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to trigger settlement' },
      { status: 500 }
    )
  }
}
