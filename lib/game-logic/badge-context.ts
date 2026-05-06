import { prisma } from '@/lib/prisma'
import { fetchUserProfileStats, UserProfileStats } from '@/lib/game-logic/user-core'

export interface BadgeCheckContext {
  userId: string
  stats: UserProfileStats
  completedMissionCount: number
  uniqueDaysRunInLast7Days: number
  activeTileCount: number
  completedActivityCount: number
  earnedBadgeCodes: Set<string>
  eventData?: {
    distance?: number // meters
    duration?: number // seconds
    pace?: number // min/km
    endTime?: Date
    [key: string]: any
  }
}

/**
 * 构建勋章检查所需的全量上下文
 * 通过一次性集中查询，避免后续独立检查每个勋章时的 N+1 查询风暴
 */
export async function buildBadgeContext(userId: string, eventData?: any): Promise<BadgeCheckContext> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6) // -6 ensures today + last 6 days = 7 days window

  const [stats, completedMissionCount, recentRuns, activeTileCount, completedActivityCount, userBadges] = await Promise.all([
    fetchUserProfileStats(userId),
    prisma.userTaskProgress.count({
      where: {
        userId: userId,
        status: { in: ['COMPLETED', 'CLAIMED'] }
      }
    }),
    prisma.runs.findMany({
      where: { user_id: userId, created_at: { gte: sevenDaysAgo } },
      select: { created_at: true }
    }),
    prisma.territories.count({
      where: { owner_id: userId }
    }),
    prisma.club_activity_registrations.count({
      where: { user_id: userId, status: 'completed' }
    }),
    prisma.user_badges.findMany({
      where: { user_id: userId },
      include: { badges: { select: { code: true } } }
    })
  ])

  const recentRunsArray = Array.isArray(recentRuns) ? recentRuns : []
  const uniqueDays = new Set(
    recentRunsArray
      .filter((r) => r.created_at != null)
      .map((r) => r.created_at!.toISOString().split('T')[0])
  )

  const earnedBadgeCodes = new Set(userBadges.map((ub: any) => ub.badges.code as string))

  return {
    userId,
    stats,
    completedMissionCount,
    uniqueDaysRunInLast7Days: uniqueDays.size,
    activeTileCount,
    completedActivityCount,
    earnedBadgeCodes,
    eventData
  }
}
