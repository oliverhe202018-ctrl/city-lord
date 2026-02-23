import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTopClubsByArea } from '@/app/actions/club'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    // Auth check removed because top clubs by area is public data.

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const province = searchParams.get('province') || undefined
    const limit = limitParam ? Number(limitParam) : undefined

    const data = await getTopClubsByArea(limit, province)
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('getTopClubsByArea error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
