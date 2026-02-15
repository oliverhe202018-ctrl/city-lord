'use server'

import { checkAndAwardBadges as checkAndAwardBadgesCore, TriggerType, BadgeCheckContext } from '@/lib/game-logic/achievement-core'

export type { TriggerType, BadgeCheckContext }

export async function checkAndAwardBadges(
  userId: string, 
  triggerType: TriggerType, 
  context?: BadgeCheckContext
) {
  return checkAndAwardBadgesCore(userId, triggerType, context)
}
