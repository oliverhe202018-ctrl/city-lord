import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTerritories } from '@/app/actions/city'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cityId = searchParams.get('cityId')
  console.log(`📡 [GET /api/city/fetch-territories] Called with cityId: ${cityId}`);
  try {
    const supabase = await createClient()

    // 1. 优先尝试 Bearer Token（Capacitor Native App）
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    let user = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data } = await supabase.auth.getUser(token);
      user = data.user;
    }

    // 2. 降级：基于 Cookie 的方式（Web 浏览器环境）
    if (!user) {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
