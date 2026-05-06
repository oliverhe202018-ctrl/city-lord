import { NextResponse } from 'next/server'
import { fetchUserBadges } from '@/app/actions/badge'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await fetchUserBadges()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API Error [UserBadges]:', error)
    // Return empty array instead of 500 error to prevent frontend crash
    return NextResponse.json([], { status: 200 })
  }
}
