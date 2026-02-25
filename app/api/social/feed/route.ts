import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { getFeedTimeline } from '@/app/actions/social-hub'

export async function GET(request: Request) {
    try {
        const supabase = await createClient()

        const { searchParams } = new URL(request.url)
        const filter = (searchParams.get('filter') as 'GLOBAL' | 'FRIENDS' | 'USER') || 'FRIENDS'
        const limit = parseInt(searchParams.get('limit') || '10')
        const cursor = searchParams.get('cursor') || undefined
        const targetUserId = searchParams.get('targetUserId') || undefined

        const res = await Sentry.startSpan(
            { op: 'function', name: 'getFeedTimeline' },
            () => getFeedTimeline({
                filter,
                limit,
                cursor,
                targetUserId
            })
        )

        if (res.error && res.error.code === 403) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        return NextResponse.json(res)
    } catch (error: any) {
        console.error('getSocialFeed error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
