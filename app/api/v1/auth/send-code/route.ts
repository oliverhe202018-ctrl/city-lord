import { NextResponse } from 'next/server'
import { sendSmsCode } from '@/app/actions/sms-auth'
import { sendAuthCode } from '@/app/actions/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, email, type, password } = body

    if (!type) {
      return NextResponse.json({ success: false, message: '缺少必要参数 type' }, { status: 400 })
    }

    if (!phone && !email) {
      return NextResponse.json({ success: false, message: '缺少账号参数' }, { status: 400 })
    }

    let result;
    if (email) {
      result = await sendAuthCode(email, type as 'login' | 'register', password)
    } else if (phone) {
      result = await sendSmsCode(phone, type as 'login' | 'register', password)
    }
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API] /api/v1/auth/send-code Error:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误', error: error.message },
      { status: 500 }
    )
  }
}
