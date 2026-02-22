import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { markAsRead } from '@/app/actions/message'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { messageId } = body || {}

    if (!messageId) {
      return NextResponse.json({ error: 'messageId required' }, { status: 400 })
    }

    const result = await markAsRead(messageId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('markAsRead error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to mark as read' }, { status: 500 })
  }
}
