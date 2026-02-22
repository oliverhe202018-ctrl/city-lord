import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leaveRoom } from '@/app/actions/room'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { roomId } = body || {}

    if (!roomId) {
      return NextResponse.json({ error: 'roomId required' }, { status: 400 })
    }

    const result = await leaveRoom(roomId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('leaveRoom error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to leave room' }, { status: 500 })
  }
}
