import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUnreadMessageCount } from '@/app/actions/message'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const count = await getUnreadMessageCount()
    return NextResponse.json({ count: count || 0 })
  } catch (error: any) {
    console.error('getUnreadMessageCount error:', error)
    return NextResponse.json({ count: 0 }, { status: 200 })
  }
}
