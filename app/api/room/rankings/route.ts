import { NextResponse } from 'next/server'
import { RoomRankingsService } from '@/lib/services/room-rankings-service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const filter = searchParams.get('filter') || 'overall'

    // 1. 参数校验 (Validation)
    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId parameter' }, { status: 400 })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(roomId)) {
      return NextResponse.json({ error: 'Invalid Room ID format' }, { status: 400 })
    }

    const validFilters = ['overall', 'ratio', 'rivals', 'stealers', 'gainers', 'losers']
    if (!validFilters.includes(filter)) {
      return NextResponse.json({ error: 'Invalid filter dimension' }, { status: 400 })
    }

    // 2. 调用服务层 (Service Layer)
    const rankings = await RoomRankingsService.getRankings(roomId, filter)

    // 3. 返回响应 (Response)
    return NextResponse.json({
      success: true,
      filter,
      data: rankings
    })

  } catch (error: any) {
    console.error('API Error [RoomRankings]:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to fetch rankings' 
    }, { status: 500 })
  }
}
