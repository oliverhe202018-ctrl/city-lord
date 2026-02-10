import { NextResponse } from 'next/server'
import { getCurrentRoom, createRoom } from '@/app/actions/room'

export const dynamic = 'force-static'

export async function GET() {
  try {
    // This action already handles auth and returns null if no room
    const room = await getCurrentRoom()
    return NextResponse.json(room || null)
  } catch (error) {
    console.error('API Error [UserRoom]:', error)
    return NextResponse.json({ error: 'Failed to fetch room data' }, { status: 500 })
  }
}

/*
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const room = await createRoom(body)
    return NextResponse.json(room)
  } catch (error: any) {
    console.error('API Error [CreateRoom]:', error)
    return NextResponse.json({ error: error.message || 'Failed to create room' }, { status: 500 })
  }
}
*/
