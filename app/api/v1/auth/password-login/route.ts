import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const PhoneSchema = z.string().regex(/^1[3-9]\d{9}$/)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { account, password } = body

    if (!account || !password) {
      return NextResponse.json({ success: false, message: '账号和密码不能为空' }, { status: 400 })
    }

    // Clean account input
    const cleanedAccount = account.replace(/\s+/g, '')

    let emailToLogin = cleanedAccount
    
    // If it's a valid phone number, convert to the virtual email used by the system
    if (PhoneSchema.safeParse(cleanedAccount).success) {
      emailToLogin = `${cleanedAccount}@sms.citylord.local`
    } else if (!cleanedAccount.includes('@')) {
      return NextResponse.json({ success: false, message: '请输入有效的邮箱或手机号' }, { status: 400 })
    }

    const supabase = await createClient()

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToLogin,
      password: password
    })

    if (error) {
      console.error('[API] /api/v1/auth/password-login Supabase Error:', error)
      let msg = '登录失败'
      if (error.message.includes('Invalid login credentials')) {
          msg = '账号或密码错误'
      } else if (error.message.includes('Email not confirmed')) {
          msg = '该账号尚未验证，请使用验证码登录一次'
      }
      return NextResponse.json({ success: false, message: msg, error: error.message })
    }

    return NextResponse.json({
      success: true,
      message: '登录成功',
      data: {
        token: data.session?.access_token,
        refreshToken: data.session?.refresh_token,
        userId: data.user?.id
      }
    })

  } catch (error: any) {
    console.error('[API] /api/v1/auth/password-login Error:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误', error: error.message },
      { status: 500 }
    )
  }
}
