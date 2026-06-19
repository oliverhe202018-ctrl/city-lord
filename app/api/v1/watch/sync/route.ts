import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ActivityService } from '@/lib/services/activity-service'
import { WatchSyncPayloadSchema } from '@/lib/schemas/watch-sync'
import type { WatchSyncResult } from '@/types/watch-sync'

export async function POST(request: NextRequest): Promise<NextResponse<WatchSyncResult>> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: '未授权：请先登录' }, { status: 401 })
    }
    const token = authHeader.substring(7)
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user || !user.id) {
      return NextResponse.json({ success: false, error: '未授权：请先登录' }, { status: 401 })
    }

    const userId = user.id
    const rawPayload = await request.json()

    const parseResult = WatchSyncPayloadSchema.safeParse(rawPayload)
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]
      const path = firstError.path.join('.') || 'root'
      return NextResponse.json({
        success: false,
        error: `数据验证失败 (${path}): ${firstError.message}`,
      }, { status: 400 })
    }

    const validatedPayload = parseResult.data
    const { externalId, sourceApp, ...payloadData } = validatedPayload

    // Anti-cheat: pace check
    for (let i = 1; i < payloadData.points.length; i++) {
      const prev = payloadData.points[i - 1]
      const curr = payloadData.points[i]
      const timeDiffSec = (curr.timestamp - prev.timestamp) / 1000
      if (timeDiffSec > 0 && curr.pace != null && curr.pace > 100) {
        return NextResponse.json({
          success: false,
          error: `第 ${i} 个点的配速异常（${curr.pace} km/h），超出人体极限`,
        }, { status: 400 })
      }
    }

    const result = await ActivityService.processWatchData(userId, payloadData, {
      externalId,
      sourceApp,
      rawData: rawPayload,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('[watch-sync api] Unexpected error:', e)
    return NextResponse.json({
      success: false,
      error: `服务器内部错误：${e instanceof Error ? e.message : '未知错误'}`,
    }, { status: 500 })
  }
}
