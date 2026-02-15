import { NextResponse } from 'next/server'
import { claimTerritory } from '@/app/actions/city'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const body = await request.json()
    const { cityId, h3Index } = body
    
    if (!cityId || !h3Index) {
      return NextResponse.json({ error: 'cityId and h3Index required' }, { status: 400 })
    }
    
    const result = await claimTerritory(cityId, h3Index)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Claim territory error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to claim territory' },
      { status: 500 }
    )
  }
}
