import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

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

    // Generate a unique ID for the client to track this run locally
    // And use it as the idempotency_key when they call /api/v1/run/finish
    const runId = randomUUID()

    return NextResponse.json({ 
        success: true, 
        data: {
            runId,
            userId: user.id,
            startTime: Date.now()
        }
    })
  } catch (error: any) {
    console.error('[API] /api/v1/run/start Error:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误', error: error.message },
      { status: 500 }
    )
  }
}
