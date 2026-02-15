import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAvailableProvinces } from '@/app/actions/club'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const provinces = await getAvailableProvinces()
    return NextResponse.json(provinces || [])
  } catch (error: any) {
    console.error('getAvailableProvinces error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
