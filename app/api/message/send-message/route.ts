import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMessage } from '@/app/actions/message'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { receiverId, content, type } = body || {}

    if (!receiverId || !content) {
      return NextResponse.json({ error: 'receiverId and content required' }, { status: 400 })
    }

    const message = await sendMessage(receiverId, content, type)
    return NextResponse.json(message)
  } catch (error: any) {
    console.error('sendMessage error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 })
  }
}
