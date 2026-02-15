import { NextResponse } from 'next/server'
import { getDailyStats } from '@/app/actions/faction'

export async function GET() {
  try {
    const stats = await getDailyStats()
    return NextResponse.json(stats || null)
  } catch (error) {
    console.error('Get daily stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch daily stats' },
      { status: 500 }
    )
  }
}
