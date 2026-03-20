import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { joinRoom } from '@/app/actions/room'
import { JoinRoomSchema } from '@/lib/schemas/room'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = JoinRoomSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const result = await joinRoom(parsed.data.roomId, parsed.data.password)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('joinRoom error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to join room' }, { status: 500 })
  }
}
