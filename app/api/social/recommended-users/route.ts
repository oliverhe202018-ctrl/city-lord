import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecommendedUsers } from '@/app/actions/social'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const users = await getRecommendedUsers()
    return NextResponse.json(users || [])
  } catch (error: any) {
    console.error('getRecommendedUsers error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
