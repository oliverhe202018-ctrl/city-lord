import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRooms } from '@/app/actions/room'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const rooms = await getRooms()
    return NextResponse.json(rooms || [])
  } catch (error: any) {
    console.error('getRooms error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
