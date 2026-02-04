import { NextResponse } from 'next/server'
import { getFactionStats } from '@/app/actions/faction'

export async function GET() {
  try {
    const data = await getFactionStats()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API Error [FactionStats]:', error)
    return NextResponse.json({ error: 'Failed to fetch faction stats' }, { status: 500 })
  }
}
