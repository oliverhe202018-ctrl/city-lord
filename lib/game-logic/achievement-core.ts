import { prisma } from '@/lib/prisma'
import { fetchUserProfileStats } from '@/lib/game-logic/user-core'

export type TriggerType = 'RUN_FINISHED' | 'TERRITORY_CAPTURE' | 'SOCIAL'

export interface BadgeCheckContext {
  distance?: number // meters
  duration?: number // seconds
  pace?: number // min/km
  endTime?: Date
}

export async function checkAndAwardBadges(
  userId: string, 
  triggerType: TriggerType, 
  context?: BadgeCheckContext
) {
  try {
    // 1. Fetch all badges and user's earned badges
    const [allBadges, earnedBadges] = await Promise.all([
      prisma.badges.findMany(),
      prisma.user_badges.findMany({
        where: { user_id: userId },
        select: { badge_id: true }
      })
    ])

    const earnedBadgeIds = new Set(earnedBadges.map(ub => ub.badge_id))
    const unearnedBadges = allBadges.filter(b => !earnedBadgeIds.has(b.id))

    if (unearnedBadges.length === 0) return []

    // 2. Fetch User Stats using the shared logic (replaces direct prisma call)
    // This avoids circular dependency with user.ts and unifies logic
    const stats = await fetchUserProfileStats(userId)

    const newBadges: any[] = []

    // 3. Iterate and Check Conditions
    for (const badge of unearnedBadges) {
      let isQualified = false
      const code = badge.code // Using code as the unique identifier for logic
      
      // --- Territory Logic ---
      if (triggerType === 'TERRITORY_CAPTURE') {
        if (code === 'landlord') {
           // 大地主: active领地数 >= 10
           const count = await prisma.territories.count({ where: { owner_id: userId } })
           if (count >= 10) isQualified = true
        }
        else if (code === 'territory-raider') {
           // 掠夺者: 历史总领地数 >= 50
           if (stats.totalTiles >= 50) isQualified = true
        }
        else if (code === 'first-territory') {
           // First Territory
           if (stats.totalTiles >= 1) isQualified = true
        }
      }

      // --- Running Logic ---
      if (triggerType === 'RUN_FINISHED') {
        if (code === 'shoe-killer') {
            // 跑鞋终结者: 总里程 >= 500km
            if (stats.totalDistance >= 500) isQualified = true
        }
        else if (code === '100km-club') {
            if (stats.totalDistance >= 100) isQualified = true
        }
        else if (code === 'city-walker') {
            if (stats.totalDistance >= 50) isQualified = true 
        }
        else if (code === 'flash' && context) {
            // 闪电侠: 配速 < 4'00" (4.0 min/km)
            const distKm = (context.distance || 0) / 1000
            if (distKm >= 1 && context.pace && context.pace < 4.0) {
                isQualified = true
            }
        }
        else if (code === 'marathon-god' && context) {
             // Marathon: Single run > 42km
             const distKm = (context.distance || 0) / 1000
             if (distKm >= 42) isQualified = true
        }
        else if (code === 'early-bird' && context?.endTime) {
            // 早起的鸟儿: 5:00 - 7:00
            const hour = context.endTime.getHours()
            if (hour >= 5 && hour < 7) isQualified = true
        }
        else if (code === 'night-walker' && context?.endTime) {
            // 夜行者: 22:00 - 02:00
            const hour = context.endTime.getHours()
            if (hour >= 22 || hour < 2) isQualified = true
        }
      }

      // --- Awarding ---
      if (isQualified) {
        try {
            await prisma.$transaction(async (tx) => {
                // Check again
                const existing = await tx.user_badges.findUnique({
                    where: {
                        user_id_badge_id: {
                            user_id: userId,
                            badge_id: badge.id
                        }
                    }
                })

                if (!existing) {
                    // 1. Award Badge
                    await tx.user_badges.create({
                        data: {
                            user_id: userId,
                            badge_id: badge.id,
                            earned_at: new Date()
                        }
                    })

                    // 2. Create Notification
                    await tx.notifications.create({
                        data: {
                            user_id: userId,
                            title: '恭喜获得新勋章！',
                            body: `你已解锁【${badge.name}】勋章！${badge.description || ''}`,
                            type: 'badge',
                            is_read: false
                        }
                    })
                    
                    newBadges.push(badge)
                }
            })
        } catch (error) {
            console.error(`Failed to award badge ${badge.code}:`, error)
            // Continue to next badge
        }
      }
    }

    return newBadges

  } catch (error) {
    console.error('checkAndAwardBadges error:', error)
    return []
  }
}
