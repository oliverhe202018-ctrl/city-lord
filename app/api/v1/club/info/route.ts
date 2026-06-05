import { NextResponse } from 'next/server'
import { getUserClub, getClubs } from '@/app/actions/club'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined

    if (!token) {
        return NextResponse.json({ success: false, message: '未提供访问令牌' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'my_club'

    if (action === 'all') {
      const clubs = await getClubs(token)
      return NextResponse.json({ success: true, data: clubs })
    }

    const userClub = await getUserClub(token)
    return NextResponse.json({ success: true, data: userClub })
  } catch (error: any) {
    console.error('[API] /api/v1/club/info Error:', error)
    return NextResponse.json(
      { success: false, message: '获取俱乐部信息失败', error: error.message },
      { status: 500 }
    )
  }
}
