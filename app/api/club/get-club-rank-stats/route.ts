import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClubRankStats } from '@/app/actions/club'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    // Auth check removed because club rankings are public data.

    const { searchParams } = new URL(request.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 })
    }

    const data = await getClubRankStats(clubId)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('getClubRankStats error:', error)
    return NextResponse.json({ global: 0, provincial: 0 }, { status: 200 })
  }
}
