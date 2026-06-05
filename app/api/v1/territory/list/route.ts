import { NextResponse } from 'next/server'
import { fetchTerritories } from '@/app/actions/city'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined

    if (!token) {
        return NextResponse.json({ success: false, message: '未提供访问令牌' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
        return NextResponse.json({ success: false, message: '令牌无效或已过期' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId') || 'global'
    const minLng = searchParams.get('minLng')
    const minLat = searchParams.get('minLat')
    const maxLng = searchParams.get('maxLng')
    const maxLat = searchParams.get('maxLat')

    let bounds: any = undefined
    if (minLng && minLat && maxLng && maxLat) {
        bounds = {
            minLng: parseFloat(minLng),
            minLat: parseFloat(minLat),
            maxLng: parseFloat(maxLng),
            maxLat: parseFloat(maxLat)
        }
    }

    const data = await fetchTerritories(cityId, bounds, token)
    
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[API] /api/v1/territory/list Error:', error)
    return NextResponse.json(
      { success: false, message: '获取领地数据失败', error: error.message },
      { status: 500 }
    )
  }
}
