'use server'

import { prisma } from '@/lib/prisma'

export type TriggerType = 'RUN_FINISHED' | 'TERRITORY_CAPTURE' | 'SOCIAL'

export interface BadgeCheckContext {
  distance?: number // meters
  duration?: number // seconds
  pace?: number // seconds per km or min/km? Usually min/km in logic, let's standardize.
  // The user input said "pace < 4'00"". That's 4 minutes/km.
  // We'll accept seconds per km for precision or min/km float. 
  // Let's use min/km float.
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

    // 2. Fetch User Stats (needed for most checks)
    const profile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: {
        total_area: true,
        total_distance_km: true,
        nickname: true
      }
    })

    if (!profile) return []

    const newBadges: any[] = []

    // 3. Iterate and Check Conditions
    for (const badge of unearnedBadges) {
      let isQualified = false
      const code = badge.code // Using code as the unique identifier for logic
      
      // Optimization: Filter by category/trigger if possible
      // But codes are specific, so we switch on code or category

      // --- Territory Logic ---
      if (triggerType === 'TERRITORY_CAPTURE') {
        if (code === 'landlord') {
           // 大地主: active领地数 >= 10
           const count = await prisma.territories.count({ where: { owner_id: userId } })
           if (count >= 10) isQualified = true
        }
        else if (code === 'territory-raider') {
           // 掠夺者: 历史总领地数 >= 50
           // Using user_city_progress sum
           const progress = await prisma.user_city_progress.aggregate({
             where: { user_id: userId },
             _sum: { tiles_captured: true }
           })
           const totalCaptured = progress._sum.tiles_captured || 0
           if (totalCaptured >= 50) isQualified = true
        }
        else if (code === 'first-territory') {
           // First Territory
           // If we are here, user just captured one. 
           // If they don't have the badge, and they captured one, grant it.
           // Or check totalCaptured >= 1
           const progress = await prisma.user_city_progress.aggregate({
             where: { user_id: userId },
             _sum: { tiles_captured: true }
           })
           if ((progress._sum.tiles_captured || 0) >= 1) isQualified = true
        }
      }

      // --- Running Logic ---
      if (triggerType === 'RUN_FINISHED') {
        if (code === 'shoe-killer') {
            // 跑鞋终结者: 总里程 >= 500km
            if ((profile.total_distance_km || 0) >= 500) isQualified = true
        }
        else if (code === '100km-club') {
            if ((profile.total_distance_km || 0) >= 100) isQualified = true
        }
        else if (code === 'city-walker') {
            if ((profile.total_distance_km || 0) >= 50) isQualified = true // As per previous migration
        }
        else if (code === 'flash' && context) {
            // 闪电侠: 配速 < 4'00" (4.0 min/km)
            // context.pace is expected in min/km
            // Ensure distance is reasonable (e.g. > 1km) to avoid GPS glitch
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
        // Double Check inside transaction to prevent race conditions
        // Although we filtered earlier, concurrency could happen.
        // We use insert ignore or try/catch.
        
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
