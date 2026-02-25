import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await Sentry.startSpan({ op: 'http.client', name: 'auth.getUser' }, () => supabase.auth.getUser())

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // ADR: 此处使用 Prisma 直连绕过了 Supabase RLS 策略。
    // 安全性由两点保障：1. 上方的 getUser() 完成了服务端 JWT 身份验证；
    // 2. 这里的 where: { id: user.id } 严格限定了仅能写入已验证用户自身的数据。
    // 此设计内联了更新逻辑，消除了 Server Action 的 async context 隔离带来的孤儿 span。
    await Sentry.startSpan({ op: 'db', name: 'prisma.profiles.update' }, () =>
      prisma.profiles.update({
        where: { id: user.id },
        data: { updated_at: new Date() },
      })
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('touchUserActivity error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to touch user activity' }, { status: 500 })
  }
}
