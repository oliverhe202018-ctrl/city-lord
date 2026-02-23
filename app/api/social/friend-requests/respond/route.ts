import { NextResponse } from 'next/server'
import { respondToFriendRequest } from '@/app/actions/social'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const body = await request.json()
    const { requestId, accept } = body
    
    const result = await respondToFriendRequest(requestId, accept)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Respond to friend request error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
