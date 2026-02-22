import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getJoinedRooms } from '@/app/actions/room'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const data = await getJoinedRooms()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('getJoinedRooms error:', error)
    return NextResponse.json({ success: true, rooms: [] }, { status: 200 })
  }
}
