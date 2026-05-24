import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { formatArea } from '@/lib/citylord/area-utils'
import { provinceCodeToName } from '@/lib/geo/province-mapping'
import type { RankItem } from '@/types/home'

export const dynamic = 'force-dynamic'

function getBeijingDate(): Date {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const beijing = new Date(utc + 8 * 3600000)
  return new Date(Date.UTC(beijing.getFullYear(), beijing.getMonth(), beijing.getDate()))
}

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

    const snapshotDate = getBeijingDate()

    if (type === 'province') {
      const snapshots = await prisma.leaderboard_snapshots.findMany({
        where: { snapshot_date: snapshotDate, scope: 'province' },
        orderBy: { rank: 'asc' },
        select: { rank: true, scope_code: true, total_area: true },
      })

      const leaderboard = snapshots.map((s) => ({
        rank: s.rank,
        name: provinceCodeToName(s.scope_code),
        score: s.total_area,
        scoreLabel: formatArea(s.total_area).fullText,
        isMe: false,
      }))

      return NextResponse.json({ leaderboard, myRank: null, isProvinceRanking: true })
    }

    const userProfile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { district_code: true, total_area: true, nickname: true },
    })

    if (!userProfile) {
      return NextResponse.json({ leaderboard: [] })
    }

    let scopeCode: string | null = null

    if (type === 'district') {
      scopeCode = userProfile.district_code
      if (!scopeCode) {
        return NextResponse.json({ leaderboard: [], fallback: 'no_district' })
      }
    }

    const snapshots = await prisma.leaderboard_snapshots.findMany({
      where: {
        snapshot_date: snapshotDate,
        scope: type === 'district' ? 'district' : 'global',
        ...(scopeCode ? { scope_code: scopeCode } : {}),
      },
      orderBy: { rank: 'asc' },
      select: { rank: true, user_id: true, total_area: true, nickname: true, avatar_url: true },
    })

    const leaderboard: RankItem[] = snapshots.map((s) => ({
      rank: s.rank,
      name: s.nickname || '未知跑者',
      score: s.total_area,
      scoreLabel: formatArea(s.total_area).fullText,
      avatar: s.avatar_url || undefined,
      isMe: s.user_id === userId,
      userId: s.user_id,
    }))

    const isInTop = snapshots.some((s) => s.user_id === userId)
    let myRank: RankItem | null = null

    if (!isInTop && userProfile.total_area != null) {
      const userArea = userProfile.total_area
      const rankCount = await prisma.leaderboard_snapshots.count({
        where: {
          snapshot_date: snapshotDate,
          scope: type === 'district' ? 'district' : 'global',
          ...(scopeCode ? { scope_code: scopeCode } : {}),
          total_area: { gt: userArea },
        },
      })

      const rank = rankCount + 1
      const fifthPlace = snapshots[4]
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
        userId: userId,
      }
    }

    return NextResponse.json({ leaderboard, myRank })
  } catch (error) {
    console.error('[api/leaderboard] error:', error)
    return NextResponse.json({ leaderboard: [], error: 'Internal error' }, { status: 500 })
  }
}
