import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { fetchFriends } from '@/app/actions/social'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await Sentry.startSpan({ op: 'http.client', name: 'auth.getUser' }, () => supabase.auth.getUser())

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const friends = await Sentry.startSpan({ op: 'function', name: 'fetchFriends' }, () => fetchFriends())
    return NextResponse.json(friends || [])
  } catch (error: any) {
    console.error('fetchFriends error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
