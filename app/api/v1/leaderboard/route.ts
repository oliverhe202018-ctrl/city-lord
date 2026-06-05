import { NextResponse } from 'next/server'
import { getLeaderboardData } from '@/app/actions/leaderboard'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined

    if (!token) {
        return NextResponse.json({ success: false, message: '未提供访问令牌' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
        return NextResponse.json({ success: false, message: '令牌无效或已过期' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'monthly'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Using user.id so the leaderboard logic can highlight the current user
    // type should match LeaderboardType defined in your codebase (e.g., 'monthly', 'all_time', 'club')
    const data = await getLeaderboardData(type as any, user.id, page, limit)
    
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[API] /api/v1/leaderboard Error:', error)
    return NextResponse.json(
      { success: false, message: '获取排行榜失败', error: error.message },
      { status: 500 }
    )
  }
}
