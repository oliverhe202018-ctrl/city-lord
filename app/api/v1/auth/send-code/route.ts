import { NextResponse } from 'next/server'
import { sendSmsCode } from '@/app/actions/sms-auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, type, password } = body

    if (!phone || !type) {
      return NextResponse.json({ success: false, message: '缺少必要参数' }, { status: 400 })
    }

    const result = await sendSmsCode(phone, type as 'login' | 'register', password)
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API] /api/v1/auth/send-code Error:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误', error: error.message },
      { status: 500 }
    )
  }
}
