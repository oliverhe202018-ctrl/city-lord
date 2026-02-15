import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendFriendRequest } from '@/app/actions/social'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { targetUserId } = body || {}

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
    }

    const result = await sendFriendRequest(targetUserId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('sendFriendRequest error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to send friend request' }, { status: 500 })
  }
}
