import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { checkAndAwardBadges } from '@/lib/game-logic/achievement-core'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: '未登录', results: [] }, { status: 401 })
    }
    const token = authHeader.substring(7)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录', results: [] }, { status: 401 })
    }

    const payload = await request.json()
    const { endTime } = payload

    // Clock drift defense
    const receivedAt = Date.now()
    const declaredEnd = new Date(endTime).getTime()
    const drift = receivedAt - declaredEnd

    let correctedEndTime = endTime
    if (drift < -10_000) {
      correctedEndTime = new Date(receivedAt).toISOString()
    }

    // Idempotency check
    const idempotencyKey = `${user.id}:${correctedEndTime}`
    const endTimeApprox = new Date(correctedEndTime)
    const existingRun = await prisma.runs.findFirst({
      where: {
        user_id: user.id,
        updated_at: {
          gte: new Date(endTimeApprox.getTime() - 2_000),
          lte: new Date(endTimeApprox.getTime() + 2_000),
        },
      },
      select: { id: true },
    })

    if (existingRun) {
      return NextResponse.json({ success: true, results: [], awarded: [] })
    }

    const results = await checkAndAwardBadges(user.id, 'RUN_FINISHED', {
      distance: payload.distance,
      duration: payload.duration,
      pace: payload.pace,
      endTime: correctedEndTime,
    })
    const awarded = results.filter((r: { status: string }) => r.status === 'awarded')

    return NextResponse.json({ success: true, results, awarded })
  } catch (error) {
    console.error('[achievements/check] Error:', error)
    return NextResponse.json({ success: false, error: '成就校验失败', results: [] }, { status: 500 })
  }
}
