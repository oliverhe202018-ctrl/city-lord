import { prisma } from '@/lib/prisma'
import { fetchUserProfileStats, UserProfileStats } from '@/lib/game-logic/user-core'

export interface BadgeCheckContext {
  userId: string
  stats: UserProfileStats
  completedMissionCount: number
  uniqueDaysRunInLast7Days: number
  activeTileCount: number
  completedActivityCount: number
  distinctDistrictsCount: number
  earnedBadgeCodes: Set<string>
  eventData?: {
    distance?: number
    duration?: number
    pace?: number
    endTime?: Date
    [key: string]: any
  }
}

export async function buildBadgeContext(userId: string, eventData?: any): Promise<BadgeCheckContext> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  const [stats, completedMissionCount, recentRuns, activeTileCount, completedActivityCount, userBadges, distinctDistricts] = await Promise.all([
    fetchUserProfileStats(userId),
    prisma.user_missions.count({
      where: {
        user_id: userId,
        status: 'completed',
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
    }),
    prisma.territories.findMany({
      where: { owner_id: userId },
      select: { city_id: true },
      distinct: ['city_id'],
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
    distinctDistrictsCount: distinctDistricts.length,
    earnedBadgeCodes,
    eventData
  }
}
