import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pendingRewards = await prisma.pending_rewards.findMany({
      where: {
        user_id: user.id,
        claimed_at: null
      },
      orderBy: { created_at: 'asc' }
    })

    return NextResponse.json({
      rewards: pendingRewards.map(r => ({
        id: r.id,
        rewardType: r.reward_type,
        payload: r.payload,
        created_at: r.created_at
      }))
    })
  } catch (error) {
    console.error('API Error [PendingRewards GET]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    await prisma.pending_rewards.updateMany({
      where: {
        user_id: user.id,
        claimed_at: null
      },
      data: {
        claimed_at: now
      }
    })

    return NextResponse.json({ claimedAt: now })
  } catch (error) {
    console.error('API Error [PendingRewards POST]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
