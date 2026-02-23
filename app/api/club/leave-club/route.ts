import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leaveClub } from '@/app/actions/club'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { clubId } = body || {}

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 })
    }

    const result = await leaveClub(clubId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('leaveClub error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to leave club' }, { status: 500 })
  }
}
