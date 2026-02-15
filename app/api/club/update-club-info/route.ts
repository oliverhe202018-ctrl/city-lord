import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateClubInfo } from '@/app/actions/club'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { clubId, data } = body || {}

    if (!clubId || !data) {
      return NextResponse.json({ error: 'clubId and data required' }, { status: 400 })
    }

    const result = await updateClubInfo(clubId, data)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('updateClubInfo error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to update club' }, { status: 500 })
  }
}
