import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCityLeaderboard } from '@/app/actions/city'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Number(limitParam) : undefined

    if (!cityId) {
      return NextResponse.json({ error: 'cityId required' }, { status: 400 })
    }

    const data = await fetchCityLeaderboard(cityId, limit)
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('fetchCityLeaderboard error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
