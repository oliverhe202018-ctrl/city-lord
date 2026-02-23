import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchFriends } from '@/app/actions/social'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const friends = await fetchFriends()
    return NextResponse.json(friends || [])
  } catch (error: any) {
    console.error('fetchFriends error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
