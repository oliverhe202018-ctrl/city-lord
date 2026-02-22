import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { joinRoomByCode } from '@/app/actions/room'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { code } = body || {}

    if (!code) {
      return NextResponse.json({ error: 'code required' }, { status: 400 })
    }

    const result = await joinRoomByCode(code)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('joinRoomByCode error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to join room' }, { status: 500 })
  }
}
