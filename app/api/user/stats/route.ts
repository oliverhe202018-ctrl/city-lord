import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { fetchUserProfileStats } from '@/lib/game-logic/user-core'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await Sentry.startSpan({ op: 'http.client', name: 'auth.getUser' }, () => supabase.auth.getUser())

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const stats = await Sentry.startSpan({ op: 'function', name: 'fetchUserProfileStats' }, () => fetchUserProfileStats(user.id))
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Get user stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
