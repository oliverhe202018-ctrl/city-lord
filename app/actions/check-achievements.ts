'use server'

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

    const context: BadgeCheckContext = {
      eventData: {
        distance: payload.distance,
        duration: payload.duration,
        pace: payload.pace,
        endTime: payload.endTime,
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
