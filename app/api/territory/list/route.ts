import { NextResponse } from 'next/server'
import { fetchTerritories } from '@/app/actions/city'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId')
    
    if (!cityId) {
      return NextResponse.json({ error: 'cityId required' }, { status: 400 })
    }
    
    const territories = await fetchTerritories(cityId)
    return NextResponse.json(territories || [])
  } catch (error: any) {
    console.error('Fetch territories error:', error)
    return NextResponse.json([], { status: 200 }) // 返回空数组避免崩溃
  }
}
