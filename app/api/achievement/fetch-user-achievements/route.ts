import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUserAchievements } from '@/app/actions/achievement'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const data = await fetchUserAchievements()
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('fetchUserAchievements error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
