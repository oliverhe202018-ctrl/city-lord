import { NextResponse } from 'next/server'
import { verifySmsCode } from '@/app/actions/sms-auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, code, type, origin } = body

    if (!phone || !code || !type) {
      return NextResponse.json({ success: false, message: '缺少必要参数' }, { status: 400 })
    }

    const result = await verifySmsCode(phone, code, type as 'login' | 'register', origin)
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API] /api/v1/auth/verify Error:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误', error: error.message },
      { status: 500 }
    )
  }
}
