import { NextResponse } from 'next/server'
import { getCurrentRoom } from '@/app/actions/room'

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
