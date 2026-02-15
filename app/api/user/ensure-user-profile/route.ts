import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureUserProfile } from '@/app/actions/user'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const result = await ensureUserProfile(user.id)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('ensureUserProfile error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to ensure user profile' }, { status: 500 })
  }
}
