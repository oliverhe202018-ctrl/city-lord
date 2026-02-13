import { prisma } from '@/lib/prisma'

/**
 * 勋章判定核心逻辑
 * 触发时机：跑步结束 (runs/create)、占领领地 (territories/capture)
 * 
 * @param userId 用户ID
 * @param activityData 本次活动数据 (可选，用于优化判定范围)
 */
export async function checkAndAwardBadges(userId: string, activityData?: any) {
  // 1. 获取所有勋章定义
  const allBadges = await prisma.badges.findMany()

  // 2. 获取用户已拥有的勋章ID
  const userBadges = await prisma.user_badges.findMany({
    where: { user_id: userId },
    select: { badge_id: true }
  })
  const ownedBadgeIds = new Set(userBadges.map(ub => ub.badge_id))

  // 3. 过滤出未获得的勋章
  const unearnedBadges = allBadges.filter(b => !ownedBadgeIds.has(b.id))

  if (unearnedBadges.length === 0) return []

  // 4. 获取用户统计数据 (一次性获取，避免循环查询)
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: {
      total_distance_km: true,
      // 其他统计字段需确认 schema，这里假设存在或通过计算获取
    }
  })

  // 补充统计数据
  // a. 领地总数
  const territoryCount = await prisma.territories.count({
    where: { owner_id: userId }
  })

  // b. 访问过的不同区域 (districts) - 假设通过 runs 或 territories 统计
  // 这里简化处理，若 schema 无直接字段，可能需要复杂查询
  const distinctDistricts = await prisma.runs.findMany({
    where: { user_id: userId },
    select: { province: true }, // 暂用 province 代替 district
    distinct: ['province']
  })
  const districtCount = distinctDistricts.length

  // c. 单次最长跑步距离
  const maxRun = await prisma.runs.findFirst({
    where: { user_id: userId },
    orderBy: { distance: 'desc' }
  })
  const maxDistance = maxRun?.distance || 0

  // d. 最高速度 (Pace 换算或直接记录) - 假设 runs 表有 max_speed 或通过 pace 估算
  // 这里暂无 max_speed 字段，暂略或用 pace
  
  const newBadges = []

  // 5. 逐个判定
  for (const badge of unearnedBadges) {
    let earned = false

    switch (badge.requirement_type) {
      // 探索类
      case 'districts_visited':
        if (districtCount >= (Number(badge.requirement_value) || 0)) earned = true
        break
      case 'total_distance':
        // profile.total_distance_km is in km, requirement might be in meters based on seed
        // Seed data: 10000 (10km), 100000 (100km), 500000 (500km)
        // Profile stores km? Let's check schema. Schema says total_distance_km: Float.
        // Assuming requirement_value is in meters based on seed (10000), need conversion.
        // Or if seed value is consistent with DB unit. 
        // Let's assume seed values are meters (10000 = 10km) and DB is km.
        if ((profile?.total_distance_km || 0) * 1000 >= (Number(badge.requirement_value) || 0)) earned = true
        break
      case 'time_of_day_before':
        // Check current activity time or last run
        if (activityData?.endTime) {
            const hour = new Date(activityData.endTime).getHours()
            if (hour < (Number(badge.requirement_value) || 0)) earned = true
        }
        break
      case 'time_of_day_after':
        if (activityData?.endTime) {
            const hour = new Date(activityData.endTime).getHours()
            if (hour >= (Number(badge.requirement_value) || 0)) earned = true
        }
        break

      // 耐力类
      case 'single_run_distance':
        // Check max run or current run
        const currentRunDist = activityData?.distance || 0
        if (Math.max(maxDistance, currentRunDist) >= (Number(badge.requirement_value) || 0)) earned = true
        break

      // 征服类
      case 'total_territories': // 累计占领 (Historical total) - Prisma count is current holding?
        // If we want historical total, we need a separate counter or audit log.
        // For now, use current holding as proxy or assume territory table is current.
        // If 'Territory Raider' means capture 50 times (even if lost), we need a 'territories_captured_count' in profile.
        // Falling back to current holding for MVP.
        if (territoryCount >= (Number(badge.requirement_value) || 0)) earned = true
        break
      case 'current_territories': // 同时持有
        if (territoryCount >= (Number(badge.requirement_value) || 0)) earned = true
        break

      // 速度类
      case 'pace_for_distance':
         // Pace < X sec/km (lower is faster) AND Distance >= 5km
         // activityData should have pace and distance
         if (activityData && activityData.distance >= 5000) {
             // Pace in seed: 240 (4 min/km). Activity pace usually seconds/km or min/km.
             // Assuming activityData.pace is seconds/km.
             if (activityData.pace > 0 && activityData.pace <= (Number(badge.requirement_value) || 0)) earned = true
         }
         break
      case 'max_speed':
         // Seed: 15 km/h.
         // If activityData has maxSpeed (km/h)
         if (activityData?.maxSpeed >= (Number(badge.requirement_value) || 0)) earned = true
         break

      // 特殊类
      case 'invites':
         // Count invited users
         const inviteCount = await prisma.profiles.count({
             where: { invited_by: userId }
         })
         if (inviteCount >= (Number(badge.requirement_value) || 0)) earned = true
         break
    }

    if (earned) {
      // 写入数据库
      await prisma.user_badges.create({
        data: {
          user_id: userId,
          badge_id: badge.id,
          earned_at: new Date()
        }
      })

      // 发送站内信通知
      await prisma.notifications.create({
        data: {
          user_id: userId,
          title: '获得新勋章！',
          body: `恭喜！你已解锁【${badge.name}】勋章！${badge.description || ''}`,
          type: 'badge',
          is_read: false
        }
      })

      newBadges.push(badge)
    }
  }

  return newBadges
}
