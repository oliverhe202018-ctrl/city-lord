import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchFriendActivities } from '@/app/actions/social'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const activities = await fetchFriendActivities()
    return NextResponse.json(activities || [])
  } catch (error: any) {
    console.error('fetchFriendActivities error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
