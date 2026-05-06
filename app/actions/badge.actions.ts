'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { BADGE_REGISTRY } from '@/lib/game-logic/badge-conditions'
import { buildBadgeContext } from '@/lib/game-logic/badge-context'

export interface BadgeProgress {
  id: string
  code: string
  name: string
  description: string | null
  iconPath: string | null
  tier: string | null
  isEarned: boolean
  earnedAt: string | null
  progress: {
    current: number
    target: number
  }
}

async function getAuthUserId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

/**
 * 获取用户所有勋章的进度与状态
 * 用于勋章墙 UI 展示
 */
export async function getBadgeProgressAction(): Promise<{ success: boolean; data?: BadgeProgress[]; error?: string }> {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return { success: false, error: '未登录' }
    }

    // 1. 获取数据库中的勋章元数据和用户已获得的勋章
    const [allBadges, userBadges] = await Promise.all([
      prisma.badges.findMany({
        orderBy: { code: 'asc' }
      }),
      prisma.user_badges.findMany({
        where: { user_id: userId },
        select: { badge_id: true, earned_at: true }
      })
    ])

    const earnedMap = new Map(userBadges.map(ub => [ub.badge_id, ub.earned_at]))
    
    // 2. 构建勋章检查上下文（包含里程、活动数等）
    const ctx = await buildBadgeContext(userId)

    // 3. 组合元数据与实时进度
    const data = allBadges.map((badge): BadgeProgress => {
      const isEarned = earnedMap.has(badge.id)
      const earnedAt = earnedMap.get(badge.id)?.toISOString() ?? null
      
      // 在注册表中查找对应的进度计算逻辑
      const condition = BADGE_REGISTRY.find(c => c.id === badge.code)
      
      // 如果注册表有 progressCheck 则调用，否则返回默认的 二值进度
      const progress = condition?.progressCheck 
        ? condition.progressCheck(ctx)
        : { current: isEarned ? 1 : 0, target: 1 }

      return {
        id: badge.id,
        code: badge.code,
        name: badge.name,
        description: badge.description,
        iconPath: badge.icon_path,
        tier: badge.tier,
        isEarned,
        earnedAt,
        progress
      }
    })

    return { success: true, data }

  } catch (error) {
    console.error('[getBadgeProgressAction] Error:', error)
    return { success: false, error: '获取勋章进度失败' }
  }
}
