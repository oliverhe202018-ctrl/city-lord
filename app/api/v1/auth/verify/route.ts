import { NextResponse } from 'next/server'
import { verifySmsCode } from '@/app/actions/sms-auth'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, email, code, type, origin } = body

    if (!code || !type) {
      return NextResponse.json({ success: false, message: '缺少必要参数 code 或 type' }, { status: 400 })
    }

    if (!phone && !email) {
      return NextResponse.json({ success: false, message: '缺少账号参数' }, { status: 400 })
    }

    const supabase = await createClient()

    if (email) {
      // Direct Email OTP Verification
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: type === 'register' ? 'signup' : 'magiclink'
      })

      if (error) {
        return NextResponse.json({ success: false, message: '邮箱验证失败', error: error.message })
      }

      return NextResponse.json({
        success: true,
        message: '验证成功',
        data: {
          token: data.session?.access_token,
          userId: data.user?.id
        }
      })
    } else if (phone) {
      // Phone SMS Verification (Returns tokenHash)
      const result = await verifySmsCode(phone, code, type as 'login' | 'register', origin)
      
      if (!result.success || !result.tokenHash) {
        return NextResponse.json(result) // Pass through the error from sms-auth
      }

      // Exchange tokenHash for actual JWT Session
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: result.tokenHash,
        type: 'magiclink'
      })

      if (error) {
        return NextResponse.json({ success: false, message: '登录会话获取失败', error: error.message })
      }

      return NextResponse.json({
        success: true,
        message: '验证成功',
        data: {
          token: data.session?.access_token,
          userId: data.user?.id
        }
      })
    }
  } catch (error: any) {
    console.error('[API] /api/v1/auth/verify Error:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误', error: error.message },
      { status: 500 }
    )
  }
}

