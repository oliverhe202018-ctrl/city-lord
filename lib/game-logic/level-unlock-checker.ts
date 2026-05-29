import { prisma } from '@/lib/prisma'
import { FEATURE_UNLOCK_MAP, type FeatureId } from './level-unlock-config'

export interface FeatureAccessResult {
  unlocked: boolean
  requiredLevel: number
  currentLevel: number
}

export async function checkFeatureAccess(
  userId: string,
  featureId: string
): Promise<FeatureAccessResult> {
  const requiredLevel = FEATURE_UNLOCK_MAP[featureId as FeatureId]

  if (requiredLevel === undefined) {
    return { unlocked: true, requiredLevel: 1, currentLevel: 1 }
  }

  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { level: true }
  })

  const currentLevel = profile?.level ?? 1

  return {
    unlocked: currentLevel >= requiredLevel,
    requiredLevel,
    currentLevel
  }
}

export async function batchCheckFeatureAccess(
  userId: string,
  featureIds: string[]
): Promise<Record<string, FeatureAccessResult>> {
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { level: true }
  })

  const currentLevel = profile?.level ?? 1

  const result: Record<string, FeatureAccessResult> = {}
  for (const featureId of featureIds) {
    const requiredLevel = FEATURE_UNLOCK_MAP[featureId as FeatureId] ?? 1
    result[featureId] = {
      unlocked: currentLevel >= requiredLevel,
      requiredLevel,
      currentLevel
    }
  }

  return result
}
