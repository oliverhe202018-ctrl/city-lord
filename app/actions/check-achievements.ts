'use server'

import { prisma } from '@/lib/prisma'
import { checkAndAwardBadges as checkAndAwardBadgesCore, TriggerType, BadgeCheckContext } from '@/lib/game-logic/achievement-core'
import { createClient } from '@/lib/supabase/server'

export type { TriggerType, BadgeCheckContext }

export async function checkAndAwardBadges(
  userId: string, 
  triggerType: TriggerType, 
  context?: BadgeCheckContext
) {
  return checkAndAwardBadgesCore(userId, triggerType, context)
}

export interface RunEndAchievementPayload {
  distance: number
  duration: number
  pace?: number
  endTime: string
}

export async function checkRunEndAchievements(payload: RunEndAchievementPayload) {
  try {
    const cookieStore = await import('next/headers').then(m => m.cookies())
    const supabase = await createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: '未登录', results: [] }
    }

    // ================================================================
    // 🛡️ CLOCK DRIFT DEFENSE — 防系统时间篡改
    // ================================================================
    const receivedAt = Date.now()
    const declaredEnd = new Date(payload.endTime).getTime()
    const drift = receivedAt - declaredEnd

    let correctedEndTime = payload.endTime

    if (drift < -10_000) {
      // endTime 在未来超过 10 秒 → 用户可能调快了系统时间
      console.warn(
        `[ClockDefense] ⚠️ Future endTime detected: drift=${drift}ms, ` +
        `correcting to server receivedAt=${new Date(receivedAt).toISOString()}`
      )
      correctedEndTime = new Date(receivedAt).toISOString()
    } else if (drift > 0) {
      console.debug(`[ClockDefense] ✅ Normal drift=${drift}ms (endTime is in the past)`)
    } else {
      console.debug(`[ClockDefense] ✅ Minor negative drift=${drift}ms (within tolerance)`)
    }

    const idempotencyKey = `${user.id}:${correctedEndTime}`
    const endTimeApprox = new Date(correctedEndTime)
    const existingRun = await prisma.runs.findFirst({
      where: {
        user_id: user.id,
        end_time: {
          gte: new Date(endTimeApprox.getTime() - 2_000),
          lte: new Date(endTimeApprox.getTime() + 2_000),
        },
      },
      select: { id: true },
    })

    if (existingRun) {
      console.log(`[checkRunEndAchievements] Idempotent hit for key=${idempotencyKey}, skipping`)
      return { success: true, results: [], awarded: [] }
    }

    const context: BadgeCheckContext = {
      eventData: {
        distance: payload.distance,
        duration: payload.duration,
        pace: payload.pace,
        endTime: correctedEndTime,
      },
    }

    const results = await checkAndAwardBadgesCore(user.id, 'RUN_FINISHED', context)
    const awarded = results.filter(r => r.status === 'awarded')

    return {
      success: true,
      results,
      awarded,
    }
  } catch (error) {
    console.error('[checkRunEndAchievements] Error:', error)
    return { success: false, error: '成就校验失败', results: [] }
  }
}
