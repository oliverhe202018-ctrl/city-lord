import { NextResponse } from 'next/server'
import { getRecentActivities } from '@/app/actions/activities'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // 从 URL 参数获取 limit
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '3')
    
    const activities = await getRecentActivities(user.id, limit)
    return NextResponse.json(activities)
  } catch (error) {
    console.error('Get activities error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}
