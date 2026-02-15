import { NextResponse } from 'next/server'
import { fetchFriends } from '@/app/actions/social'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const res = await fetch('/api/social/friends', { credentials: 'include' })
const friends = await res.json()

    return NextResponse.json(friends)
  } catch (error) {
    console.error('Fetch friends error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch friends' },
      { status: 500 }
    )
  }
}
