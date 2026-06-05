import { NextResponse } from 'next/server'
import { getProfileData } from '@/app/actions/profile'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined

    if (!token) {
        return NextResponse.json({ success: false, message: '未提供访问令牌' }, { status: 401 })
    }

    // Determine target user ID (from query param or self)
    const { searchParams } = new URL(request.url)
    let targetUserId = searchParams.get('userId')

    // If no explicit userId is provided, we need to find who the current user is.
    if (!targetUserId) {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser(token)
        if (error || !user) {
            return NextResponse.json({ success: false, message: '令牌无效或已过期' }, { status: 401 })
        }
        targetUserId = user.id
    }

    const result = await getProfileData(targetUserId, token)
    
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[API] /api/v1/user/profile Error:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误', error: error.message },
      { status: 500 }
    )
  }
}
