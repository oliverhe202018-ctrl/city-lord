import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { touchUserActivity } from '@/app/actions/user'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await Sentry.startSpan({ op: 'http.client', name: 'auth.getUser' }, () => supabase.auth.getUser())

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    await Sentry.startSpan({ op: 'function', name: 'touchUserActivity' }, () => touchUserActivity())
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('touchUserActivity error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to touch user activity' }, { status: 500 })
  }
}
