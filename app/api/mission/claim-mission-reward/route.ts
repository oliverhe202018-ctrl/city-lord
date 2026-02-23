import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claimMissionReward } from '@/app/actions/mission'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { missionId } = body || {}

    if (!missionId) {
      return NextResponse.json({ error: 'missionId required' }, { status: 400 })
    }

    const result = await claimMissionReward(missionId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('claimMissionReward error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to claim reward' }, { status: 500 })
  }
}
