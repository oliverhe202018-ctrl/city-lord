import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createChallenge } from '@/app/actions/social'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { targetId, type, distance, duration, rewardXp } = body || {}

    if (!targetId || !type) {
      return NextResponse.json({ error: 'targetId and type required' }, { status: 400 })
    }

    const result = await createChallenge({ targetId, type, distance, duration, rewardXp })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('createChallenge error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to create challenge' }, { status: 500 })
  }
}
