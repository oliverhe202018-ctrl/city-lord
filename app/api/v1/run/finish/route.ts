import { NextResponse } from 'next/server'
import { saveRunActivity } from '@/app/actions/run-service'
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
    const { runData, clubId } = body

    if (!runData || !runData.path) {
      return NextResponse.json({ success: false, message: '跑步数据不完整' }, { status: 400 })
    }

    // Call the heavy backend function
    const result = await saveRunActivity(user.id, runData, clubId)
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API] /api/v1/run/finish Error:', error)
    return NextResponse.json(
      { success: false, message: '结算异常', error: error.message },
      { status: 500 }
    )
  }
}
