import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRoom } from '@/app/actions/room'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    if (!body?.name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }

    const result = await createRoom(body)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('createRoom error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to create room' }, { status: 500 })
  }
}
