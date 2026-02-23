import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTerritories } from '@/app/actions/city'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId')

    if (!cityId) {
      return NextResponse.json({ error: 'cityId required' }, { status: 400 })
    }

    const territories = await fetchTerritories(cityId)
    return NextResponse.json(territories || [])
  } catch (error: any) {
    console.error('fetchTerritories error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
