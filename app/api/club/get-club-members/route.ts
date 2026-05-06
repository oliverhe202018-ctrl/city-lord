import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClubMembers } from '@/app/actions/club'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 })
    }

    const data = await getClubMembers(clubId)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('getClubMembers error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to load members' }, { status: 500 })
  }
}
