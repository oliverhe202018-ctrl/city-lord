import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma' // 确保你导出了全局 prisma 实例

export const dynamic = 'force-dynamic' // 确保不被静态缓存

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ count: 0 }, { status: 401 })
    }

    // ⚡️ 核心优化：直接使用 Prisma 的 count 聚合查询
    // 配合刚才添加的 @@index([user_id, is_read])，这个查询是 O(1) 复杂度的瞬间操作
    const count = await prisma.messages.count({
      where: {
        user_id: user.id,
        is_read: false
      }
    })

    return NextResponse.json({ count })
  } catch (error: any) {
    console.error('Count unread error:', error)
    return NextResponse.json({ count: 0 })
  }
}