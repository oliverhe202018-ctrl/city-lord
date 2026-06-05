import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined

    if (!token) {
        return NextResponse.json({ success: false, message: '未提供访问令牌' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
        return NextResponse.json({ success: false, message: '令牌无效或已过期' }, { status: 401 })
    }

    const body = await request.json()
    // payload should contain { runId, currentPoint, isPaused }
    // Currently, backend uses "finish" to process the entire run, 
    // so this is a placeholder for real-time live map updates in the future.

    return NextResponse.json({ 
        success: true, 
        message: 'Sync received'
    })
  } catch (error: any) {
    console.error('[API] /api/v1/run/sync Error:', error)
    return NextResponse.json(
      { success: false, message: '同步异常', error: error.message },
      { status: 500 }
    )
  }
}
