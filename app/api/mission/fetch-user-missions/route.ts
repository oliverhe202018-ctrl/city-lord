import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUserMissions } from '@/app/actions/mission'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const missions = await fetchUserMissions()
    return NextResponse.json(missions || [])
  } catch (error: any) {
    console.error('fetchUserMissions error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
