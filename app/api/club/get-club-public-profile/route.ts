import { NextResponse } from 'next/server'
import { getClubDetailsCached, getClubRankStats } from '@/app/actions/club'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 })
    }

    // 1. 获取 club 基础信息（含 total_area、member_count）
    const clubDetails = await getClubDetailsCached(clubId)
    if (!clubDetails) {
      return NextResponse.json(null, { status: 200 })
    }

    // 2. 获取全国/省内排名
    const rankStats = await getClubRankStats(clubId)

    // 3. 使用 admin client 直接查询 Top 5 成员（绕过 RLS）
    const { data: memberData, error: memberError } = await getSupabaseAdmin()
      .from('club_members')
      .select('user_id, profiles:user_id(id, nickname, avatar_url, total_area)')
      .eq('club_id', clubId)
      .eq('status', 'active')

    if (memberError) {
      console.error('getClubPublicProfile member query error:', memberError)
    }

    const topMembers = (memberData || [])
      .map((m: any) => {
        // Supabase join 可能返回 object 或 array，做兼容处理
        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
        return {
          member_id: profile?.id || m.user_id,
          nickname: profile?.nickname || 'Unknown',
          avatar_url: profile?.avatar_url || null,
          total_area: Number(profile?.total_area) || 0
        }
      })
      .sort((a, b) => b.total_area - a.total_area)
      .slice(0, 5)
      .map((m, i) => ({ ...m, rank: i + 1 }))

    return NextResponse.json({
      id: clubDetails.id,
      name: clubDetails.name,
      avatar_url: clubDetails.avatar_url || null,
      total_area: Number(clubDetails.total_area) || 0,
      member_count: clubDetails.total_member_count || clubDetails.active_member_count || 0,
      rank_national: rankStats.global > 0 ? rankStats.global : null,
      rank_province: rankStats.provincial > 0 ? rankStats.provincial : null,
      top_territories: topMembers
    })
  } catch (error: any) {
    console.error('getClubPublicProfile error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch club public profile' },
      { status: 500 }
    )
  }
}