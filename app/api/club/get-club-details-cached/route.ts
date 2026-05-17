import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClubDetailsCached } from '@/app/actions/club'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    // Auth check removed because club details are public data.
    // This fixes "俱乐部信息不存在" errors in Capacitor apps where auth cookies might be missing.

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
