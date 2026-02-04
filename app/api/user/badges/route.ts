import { NextResponse } from 'next/server'
import { fetchUserBadges } from '@/app/actions/badge'

export async function GET() {
  try {
    const data = await fetchUserBadges()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API Error [UserBadges]:', error)
    return NextResponse.json({ error: 'Failed to fetch user badges' }, { status: 500 })
  }
}
