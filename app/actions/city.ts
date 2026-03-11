'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { UserCityProgress, Territory, ExtTerritory } from '@/types/city'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Redefine types to avoid dependency on mock-api
export interface CityLeaderboardEntry {
  rank: number
  userId: string
  nickname: string
  level: number
  avatar: string
  totalArea: number
  tilesCaptured: number
  reputation: number
}

export async function fetchTerritories(cityId: string): Promise<ExtTerritory[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const currentUserId = user?.id

  try {
    const { data: terrData, error } = await supabaseAdmin
      .from('territories')
      .select('id, city_id, owner_id, owner_club_id, owner_faction, captured_at, health, last_maintained_at, owner_change_count, last_owner_change_at')
      .eq('city_id', cityId)

    if (error) {
      console.error('Error fetching territories:', error)
      return []
    }

    if (!terrData || terrData.length === 0) {
      return []
    }

    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - 7)

    return terrData.map((t: any) => {
      const changeCount = t.owner_change_count ?? 0
      const lastChange = t.last_owner_change_at ? new Date(t.last_owner_change_at) : null
      const isHotZone = changeCount >= 2 && lastChange != null && lastChange >= windowStart

      return {
        id: t.id,
        cityId: t.city_id,
        ownerId: t.owner_id ?? null,
        ownerType: !t.owner_id ? 'neutral' : (t.owner_id === currentUserId ? 'me' : 'enemy'),
        ownerClubId: t.owner_club_id ?? null,
        ownerFaction: t.owner_faction ?? null,
        capturedAt: t.captured_at,
        health: t.health ?? 1000,
        maxHealth: 1000,
        lastMaintainedAt: t.last_maintained_at,
        isHotZone,
        ownerChangeCount: changeCount,
      }
    })
  } catch (err) {
    console.error('Territory fetch failed:', err)
    return []
  }
}

import { checkHiddenBadges } from './badge'
import { prisma } from '@/lib/prisma'
import { calculateFactionBalance } from '@/utils/faction-balance'
import { checkAndAwardBadges } from '@/app/actions/check-achievements'
import {
  H3_TILE_AREA_KM2,
  BASE_SCORE_PER_KM2,
  HOT_ZONE_CAPTURE_MULTIPLIER,
  NORMAL_CAPTURE_MULTIPLIER,
  LOSS_PENALTY_RATIO,
  HOT_ZONE_THRESHOLD,
  HOT_ZONE_WINDOW_DAYS,
} from '@/lib/constants/territory'
import { HotZoneCacheService } from '@/lib/services/hotzone-cache-service'
import { redis } from '@/lib/redis'
import { evaluatePenalty, getPenaltyConfig } from '@/lib/services/territory-penalty'

export async function claimTerritory(cityId: string, cellId: string, requestId?: string): Promise<{ success: boolean; error?: string; grantedBadges?: string[]; scoreChange?: number; isHotZone?: boolean }> {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const generatedRequestId = requestId || crypto.randomUUID()

  const lockKey = `territory_claim_lock:${cellId}`
  const redisLock = await redis.set(lockKey, user.id, "EX", 10, "NX")
  if (!redisLock) {
    return { success: false, error: '该领地正在结算中，请稍后再试' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock territory row (FOR UPDATE) and check if it exists
      const existingRows = await tx.$queryRaw<any[]>`
        SELECT * FROM territories WHERE id = ${cellId} FOR UPDATE
      `
      const existing = existingRows.length > 0 ? existingRows[0] : null

      // If territory exists, check cooldown
      if (existing?.neutral_until && existing.neutral_until > new Date()) {
        throw new Error('该领地处于冷却期中，请稍后再试')
      }

      // 2. Read existing snapshot data
      const previousOwnerId = existing?.owner_id ?? null
      const previousClubId = existing?.owner_club_id ?? null
      const previousFaction = existing?.owner_faction ?? null

      // 3. Read Attacker Profile Snapshot
      const profile = await tx.profiles.findUnique({
        where: { id: user.id },
        select: { faction: true, club_id: true, id: true }
      })

      if (!profile) throw new Error('Profile not found')

      // Check current Hot Zone status before updating the territory
      const windowStart = new Date()
      windowStart.setDate(windowStart.getDate() - 7)

      let isHotZone = false
      if (existing) {
        const changeCount = existing.owner_change_count ?? 0
        const lastChange = existing.last_owner_change_at ? new Date(existing.last_owner_change_at) : null
        isHotZone = changeCount >= 2 && lastChange != null && lastChange >= windowStart
      }

      const hotZoneMultiplier = isHotZone ? HOT_ZONE_CAPTURE_MULTIPLIER : NORMAL_CAPTURE_MULTIPLIER
      const baseScore = Math.round(H3_TILE_AREA_KM2 * BASE_SCORE_PER_KM2)
      let earnedScore = Math.round(baseScore * hotZoneMultiplier)

      let actionState = 'captured'
      let penaltyLog: any = null

      if (existing && existing.owner_id !== user.id && (existing.health ?? 0) <= 0) {
        // It's a capture against an enemy/neutral. Evaluate penalty.
        const PENALTY_FLAGS = getPenaltyConfig();
        const lookbackDate = new Date()
        lookbackDate.setHours(lookbackDate.getHours() - PENALTY_FLAGS.lookbackHours)

        const recentEvents = await tx.$queryRaw<any[]>`
          SELECT id, user_id, new_owner_id, created_at
          FROM territory_events
          WHERE territory_id = ${cellId}
            AND created_at >= ${lookbackDate}
          ORDER BY created_at DESC
        `

        const penaltyResult = evaluatePenalty(user.id, profile.club_id, recentEvents)
        const penaltyRatio = penaltyResult.appliedRatio;

        if (penaltyRatio < 1.0 || penaltyResult.matchedRule !== 'NORMAL_REWARD') {
          const originalScore = earnedScore;
          earnedScore = Math.round(earnedScore * penaltyRatio)
          penaltyLog = {
            territory_id: cellId,
            attacker_user_id: user.id,
            attacker_club_id: profile.club_id,
            defender_user_id: previousOwnerId,
            matched_rule: penaltyResult.matchedRule,
            applied_ratio: penaltyRatio,
            reason_window: penaltyResult.reasonWindow,
            source_event_ids: penaltyResult.sourceEventIds,
            penalty_enabled_snapshot: penaltyResult.penaltyEnabledSnapshot,
            reward_payload_snapshot: { originalScore, finalScore: earnedScore }
          }
        }
      }

      // 4. Territory Upsert / Update
      if (!existing) {
        // Create new territory
        await tx.territories.create({
          data: {
            id: cellId,
            city_id: cityId,
            owner_id: user.id,
            owner_club_id: profile.club_id,
            owner_faction: profile.faction,
            captured_at: new Date(),
            health: 1000,
            level: 1,
            owner_change_count: 0,
            last_owner_change_at: new Date(),
            neutral_until: null,
          }
        })
      } else if (existing.owner_id === user.id) {
        // Heal own territory (already owned, no faction/club overwrite needed)
        await tx.territories.update({
          where: { id: cellId },
          data: {
            health: Math.min(1000, (existing.health || 0) + 100),
            last_maintained_at: new Date(),
          }
        })
        actionState = 'healed'
      } else if ((existing.health ?? 0) <= 0) {
        // Capture enemy territory (overwrite attacker's club and faction)
        await tx.territories.update({
          where: { id: cellId },
          data: {
            owner_id: user.id,
            owner_club_id: profile.club_id,
            owner_faction: profile.faction,
            city_id: cityId,
            captured_at: new Date(),
            health: 1000,
            level: 1,
            last_maintained_at: new Date(),
            owner_change_count: { increment: 1 },
            last_owner_change_at: new Date(),
            neutral_until: null,
          }
        })
      } else {
        throw new Error('Territory is protected')
      }

      // 5. Insert territory_events (Only if captured)
      if (actionState === 'captured') {
        // Try inserting into territory_events, which acts as the idempotent lock too. 
        // If a duplicate request ID is used, this throws and rolls back the transaction.
        let newEventId: bigint | null = null;
        try {
          const insertResult = await tx.$queryRaw<any[]>`
            INSERT INTO territory_events (
              territory_id, event_type, user_id, 
              old_owner_id, new_owner_id, 
              old_club_id, new_club_id, 
              old_faction, new_faction, 
              source_request_id, created_at
            ) VALUES (
              ${cellId}, 'CLAIM', ${user.id}::uuid, 
              ${previousOwnerId ? previousOwnerId + '::uuid' : null}, ${user.id}::uuid, 
              ${previousClubId ? previousClubId + '::uuid' : null}, ${profile.club_id ? profile.club_id + '::uuid' : null}, 
              ${previousFaction}, ${profile.faction}, 
              ${generatedRequestId}::uuid, NOW()
            ) RETURNING id
          `
          if (insertResult.length > 0) {
            newEventId = insertResult[0].id;
          }
        } catch (eventError: any) {
          // If the unique constraint idx_territory_events_idempotency is violated, fail gracefully.
          if (eventError.message && eventError.message.includes('idx_territory_events_idempotency')) {
            return { action: 'idempotent_skip', scoreChange: 0, isHotZone: false }
          }
          throw eventError
        }

        // Insert Penalty Log if triggered
        if (penaltyLog && newEventId !== null) {
          await tx.$executeRaw`
            INSERT INTO territory_reward_penalties (
              territory_id, claim_event_id, attacker_user_id, attacker_club_id, defender_user_id,
              matched_rule, applied_ratio, reason_window, source_event_ids,
              penalty_enabled_snapshot, reward_payload_snapshot
            ) VALUES (
              ${penaltyLog.territory_id}, ${newEventId}, ${penaltyLog.attacker_user_id}::uuid, 
              ${penaltyLog.attacker_club_id ? penaltyLog.attacker_club_id + '::uuid' : null}, 
              ${penaltyLog.defender_user_id ? penaltyLog.defender_user_id + '::uuid' : null},
              ${penaltyLog.matched_rule}, ${penaltyLog.applied_ratio}, ${penaltyLog.reason_window},
              ${JSON.stringify(penaltyLog.source_event_ids)}::jsonb, ${penaltyLog.penalty_enabled_snapshot},
              ${JSON.stringify(penaltyLog.reward_payload_snapshot)}::jsonb
            )
          `
        }

        // Invalidate hot zone cache for this territory
        await HotZoneCacheService.invalidate(cellId)
      }

      return { action: actionState, scoreChange: actionState === 'healed' ? 0 : earnedScore, isHotZone }
    })

    // 9. Check Hidden Badges (Outside Transaction)
    const newBadges = await checkAndAwardBadges(user.id, 'TERRITORY_CAPTURE')
    const grantedBadges = newBadges.map(b => b.code)

    // Trigger Task Center Event
    try {
      const { TaskService } = await import('@/lib/services/task')
      await TaskService.processEvent(user.id, {
        type: 'GRID_CAPTURED',
        userId: user.id,
        timestamp: new Date(),
        data: { gridId: cellId, isNew: true, isSelf: true }
      })
    } catch (e) {
      console.error('Task event failed:', e)
    }

    return {
      success: true,
      grantedBadges,
      scoreChange: result.scoreChange,
      isHotZone: result.isHotZone
    }

  } catch (err: any) {
    console.error('Error claiming territory:', err)
    return { success: false, error: err.message || 'Claim failed' }
  } finally {
    const currentLockVal = await redis.get(lockKey)
    if (currentLockVal === user.id) {
      await redis.del(lockKey)
    }
  }
}

// ⚡️ 核心优化：外置 unstable_cache，分离纯净的聚合查询，杜绝隐式使用 cookies()
import { unstable_cache } from 'next/cache'

const getCachedCityStats = unstable_cache(
  async (cityId: string) => {
    // 1. Count total players in this city
    const totalPlayers = await prisma.user_city_progress.count({
      where: { city_id: cityId }
    })

    // 2. Count active players
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    const activePlayers = await prisma.user_city_progress.count({
      where: {
        city_id: cityId,
        last_active_at: { gt: lastWeek }
      }
    })

    // 3. Count total tiles captured
    const totalTiles = await prisma.territories.count({
      where: { city_id: cityId }
    })

    const ESTIMATED_AREA_PER_TILE = 0.01
    const totalArea = totalTiles * ESTIMATED_AREA_PER_TILE

    return {
      totalPlayers,
      activePlayers,
      totalArea: parseFloat(totalArea.toFixed(2)),
      totalTiles
    }
  },
  ['city-stats-agg'], // 缓存前缀
  { revalidate: 60, tags: ['city-stats'] }
)

export async function fetchCityStats(cityId: string) {
  if (!cityId) {
    return { totalPlayers: 0, activePlayers: 0, totalArea: 0, totalTiles: 0 }
  }
  // 隔离：直接传入参数，不再在缓存流中读取 headers/cookies
  return await getCachedCityStats(cityId)
}

const getCachedCityLeaderboard = unstable_cache(
  async (cityId: string, limit: number) => {
    const data = await prisma.user_city_progress.findMany({
      where: { city_id: cityId },
      select: {
        user_id: true,
        area_controlled: true,
        tiles_captured: true,
        reputation: true,
        profiles: {
          select: {
            nickname: true,
            avatar_url: true,
            level: true
          }
        }
      },
      orderBy: { area_controlled: 'desc' },
      take: limit
    })

    return data.map((entry, index) => ({
      rank: index + 1,
      userId: entry.user_id,
      nickname: entry.profiles?.nickname || 'Unknown',
      level: entry.profiles?.level || 1,
      avatar: entry.profiles?.avatar_url || '',
      totalArea: Number(entry.area_controlled || 0),
      tilesCaptured: entry.tiles_captured || 0,
      reputation: entry.reputation || 0
    }))
  },
  ['city-leaderboard'],
  { revalidate: 30, tags: ['city-leaderboard'] } // 榜单时效性高点设为30s
)

export async function fetchCityLeaderboard(cityId: string, limit = 50): Promise<CityLeaderboardEntry[]> {
  if (!cityId) return []
  // 增加边界与攻击防范：限制最大返回 100 条且禁止负值，防止被滥用刷爆 Redis 键名或打垮 DB
  const safeLimit = Math.min(Math.max(1, limit), 100)
  return await getCachedCityLeaderboard(cityId, safeLimit)
}

export async function getUserCityProgress(cityId: string): Promise<UserCityProgress | null> {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('user_city_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('city_id', cityId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
    console.error('Error fetching user progress:', error)
  }

  if (!data) {
    // Return default/empty progress if not found (or null to trigger creation)
    return null
  }

  // 2. Get user's rank
  // Rank = count of users with more area_controlled + 1
  const { count: rankCount, error: rankError } = await supabase
    .from('user_city_progress')
    .select('*', { count: 'exact', head: true })
    .eq('city_id', cityId)
    .gt('area_controlled', (data as any).area_controlled || 0)

  const ranking = (rankCount !== null) ? rankCount + 1 : 0

  return {
    userId: (data as any).user_id,
    cityId: (data as any).city_id,
    level: (data as any).level,
    experience: (data as any).experience,
    experienceProgress: { current: 0, max: 100 }, // Calc based on logic if needed
    tilesCaptured: (data as any).tiles_captured,
    areaControlled: (data as any).area_controlled,
    ranking: ranking,
    reputation: (data as any).reputation,
    completedChallenges: [], // Need relation
    unlockedAchievements: [], // Need relation
    lastActiveAt: (data as any).last_active_at,
    joinedAt: (data as any).joined_at
  }
}

export async function initUserCityProgress(cityId: string) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('user_city_progress')
    .insert({
      user_id: user.id,
      city_id: cityId,
      joined_at: new Date().toISOString(),
      last_active_at: new Date().toISOString()
    } as any)
    .select()
    .single()

  if (error) throw error
  return data
}
