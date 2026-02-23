import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFeedTimeline } from '@/app/actions/social-hub'

export async function GET(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const filter = (searchParams.get('filter') as 'GLOBAL' | 'FRIENDS' | 'USER') || 'FRIENDS'
        const limit = parseInt(searchParams.get('limit') || '10')
        const cursor = searchParams.get('cursor') || undefined
        const targetUserId = searchParams.get('targetUserId') || undefined

        const res = await getFeedTimeline({
            filter,
            limit,
            cursor,
            targetUserId
        })

        return NextResponse.json(res)
    } catch (error: any) {
        console.error('getSocialFeed error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
