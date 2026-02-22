import { NextResponse } from 'next/server'
import { fetchRoomDetails } from '@/app/actions/room'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Validate UUID format to prevent database errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid Room ID' }, { status: 400 });
    }

    const room = await fetchRoomDetails(id)
    
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    return NextResponse.json(room)
  } catch (error) {
    console.error('API Error [RoomDetails]:', error)
    return NextResponse.json({ error: 'Failed to fetch room details' }, { status: 500 })
  }
}
