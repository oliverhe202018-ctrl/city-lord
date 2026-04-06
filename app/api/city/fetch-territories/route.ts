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
    const minLng = searchParams.get('minLng')
    const minLat = searchParams.get('minLat')
    const maxLng = searchParams.get('maxLng')
    const maxLat = searchParams.get('maxLat')

    if (!cityId) {
      return NextResponse.json({ error: 'cityId required' }, { status: 400 })
    }

    let bounds;
    if (minLng && minLat && maxLng && maxLat) {
      bounds = {
        minLng: parseFloat(minLng),
        minLat: parseFloat(minLat),
        maxLng: parseFloat(maxLng),
        maxLat: parseFloat(maxLat)
      }
    }

    const territories = await fetchTerritories(cityId, bounds)
    return NextResponse.json(territories || [])
  } catch (error: any) {
    console.error('fetchTerritories error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
