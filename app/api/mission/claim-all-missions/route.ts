import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claimAllMissions } from '@/app/actions/mission'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { missionIds } = body || {}

    if (!missionIds || !Array.isArray(missionIds) || missionIds.length === 0) {
      return NextResponse.json({ error: 'missionIds array required' }, { status: 400 })
    }

    const result = await claimAllMissions(missionIds)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('claimAllMissions error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to claim missions' }, { status: 500 })
  }
}
