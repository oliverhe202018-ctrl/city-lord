import { NextResponse } from 'next/server'
import { fetchUserMissions } from '@/app/actions/mission'

export const dynamic = 'force-static'

export async function GET() {
  try {
    const data = await fetchUserMissions()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API Error [UserMissions]:', error)
    return NextResponse.json({ error: 'Failed to fetch user missions' }, { status: 500 })
  }
}
