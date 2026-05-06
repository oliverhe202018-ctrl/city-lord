import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { formatArea } from '@/lib/citylord/area-utils'
import type { RankItem } from '@/types/home'

const TOP_N = 5

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'global'

    const userProfile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { city_code: true, city_name: true, total_area: true, nickname: true },
    })

    if (!userProfile) {
      return NextResponse.json({ leaderboard: [] })
    }

    const where: Record<string, unknown> = { is_active: true }
    let fallback: string | null = null

    if (type === 'city') {
      if (!userProfile.city_code) {
        // 降级到全国榜，并附标识
        fallback = 'global_fallback'
      } else {
        where.city_code = userProfile.city_code
      }
    }

    const topUsers = await prisma.profiles.findMany({
      where,
      orderBy: { total_area: 'desc' },
      take: TOP_N,
      select: {
        id: true,
        nickname: true,
        avatar_url: true,
        total_area: true,
      },
    })

    const leaderboard: RankItem[] = topUsers.map((u, i) => ({
      rank: i + 1,
      name: u.nickname || '未知跑者',
      score: u.total_area ?? 0,
      scoreLabel: formatArea(u.total_area ?? 0).fullText,
      avatar: u.avatar_url || undefined,
      isMe: u.id === userId,
    }))

    const isInTop5 = topUsers.some((u) => u.id === userId)
    let myRank: RankItem | null = null

    if (!isInTop5 && userProfile.total_area != null) {
      const userArea = userProfile.total_area
      const rankCount = await prisma.profiles.count({
        where: {
          ...where,
          total_area: { gt: userArea },
        },
      })

      const rank = rankCount + 1
      const fifthPlace = topUsers[4]
      const gapToTarget = fifthPlace
        ? Math.round((fifthPlace.total_area ?? 0) - userArea)
        : 0

      myRank = {
        rank,
        name: userProfile.nickname || '我',
        score: userArea,
        scoreLabel: formatArea(userArea).fullText,
        isMe: true,
        gapToTarget: Math.max(0, gapToTarget),
      }
    }

    return NextResponse.json({ leaderboard, myRank, fallback })
  } catch (error) {
    console.error('[api/leaderboard] error:', error)
    return NextResponse.json({ leaderboard: [], error: 'Internal error' }, { status: 500 })
  }
}
