import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processJoinRequest } from '@/app/actions/club'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { clubId, requestId, action } = body || {}

    if (!clubId || !requestId || !action) {
      return NextResponse.json({ error: 'clubId, requestId and action required' }, { status: 400 })
    }

    const result = await processJoinRequest(clubId, requestId, action)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('processJoinRequest error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to process request' }, { status: 500 })
  }
}
