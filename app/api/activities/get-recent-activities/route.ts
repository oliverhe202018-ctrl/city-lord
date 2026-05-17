import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecentActivities } from '@/app/actions/activities'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Number(limitParam) : 5

    const data = await getRecentActivities(user.id, limit)
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('getRecentActivities error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
