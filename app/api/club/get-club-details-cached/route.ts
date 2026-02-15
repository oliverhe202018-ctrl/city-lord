import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClubDetailsCached } from '@/app/actions/club'

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

    const data = await getClubDetailsCached(clubId)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('getClubDetailsCached error:', error)
    return NextResponse.json(null, { status: 200 })
  }
}
