import { NextResponse } from 'next/server'
import { getFactionStats } from '@/app/actions/faction'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stats = await getFactionStats()
    
    // Map internal stats to API response expected by client
    return NextResponse.json({
      red_faction: stats.RED,
      blue_faction: stats.BLUE,
      redArea: stats.redArea,
      blueArea: stats.blueArea,
      percentages: stats.percentages,
      bonus: stats.bonus
    })
  } catch (error) {
    console.error('API Error [FactionStats]:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
