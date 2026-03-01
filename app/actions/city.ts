// 'use server'

import { createClient } from '@/mock-supabase'
import { cookies } from '@/mock-headers'
import { UserCityProgress, Territory } from '@/types/city'

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

export async function fetchTerritories(cityId: string): Promise<Territory[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const currentUserId = user?.id

  try {
    const { data, error } = await supabase
      .from('territories')
      .select('*')
      .eq('city_id', cityId)

    if (error) {
      console.error('Error fetching territories:', error)
      return []
    }

    if (!data) {
      return []
    }

    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - 7)

    return data.map((t: any) => {
      const changeCount = t.owner_change_count ?? 0
      const lastChange = t.last_owner_change_at ? new Date(t.last_owner_change_at) : null
      const isHotZone = changeCount >= 2 && lastChange != null && lastChange >= windowStart

      return {
        id: t.id,
        cityId: t.city_id,
        ownerId: t.owner_id,
        ownerType: currentUserId ? (t.owner_id === currentUserId ? 'me' : 'enemy') : 'neutral',
        capturedAt: t.captured_at,
        health: t.health,
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

export async function claimTerritory(cityId: string, cellId: string): Promise<{ success: boolean; error?: string; grantedBadges?: string[]; scoreChange?: number; isHotZone?: boolean }> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const lockKey = `territory_claim_lock:${cellId}`
  const redisLock = await redis.set(lockKey, user.id, "EX", 10, "NX")
  if (!redisLock) {
    return { success: false, error: '该领地正在结算中，请稍后再试' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch User Profile for Faction
      const profile = await tx.profiles.findUnique({
        where: { id: user.id },
        select: { faction: true, id: true }
      })

      if (!profile) throw new Error('Profile not found')

      // 2. Faction Buff Logic (Underdog Bonus)
      let multiplier = 1.0
      if (profile.faction) {
        const snapshot = await tx.faction_stats_snapshot.findFirst({
          orderBy: { updated_at: 'desc' }
        })

        if (snapshot) {
          const redScore = snapshot.red_area || 0
          const blueScore = snapshot.blue_area || 0
          const { underdog, multiplier: bonus, diffRatio } = calculateFactionBalance(
            redScore,
            blueScore
          )
          if (underdog && underdog.toUpperCase() === profile.faction.toUpperCase()) {
            multiplier = bonus
          }
        }
      }

      // 3. Check territory state — cooldown, existing owner, etc.
      const existing = await tx.territories.findUnique({
        where: { id: cellId },
        select: {
          owner_id: true,
          health: true,
          neutral_until: true,
          owner_change_count: true,
        }
      })

      // If territory exists, check cooldown
      if (existing?.neutral_until && existing.neutral_until > new Date()) {
        throw new Error('该领地处于冷却期中，请稍后再试')
      }

      // Track previous owner for score deduction and owner_change_log
      const previousOwnerId = existing?.owner_id ?? null

      // 4. Claim Logic (HP 1000 scale)
      if (!existing) {
        // Create new territory — no previous owner
        await tx.territories.create({
          data: {
            id: cellId,
            city_id: cityId,
            owner_id: user.id,
            captured_at: new Date(),
            health: Math.round(1000 * multiplier),
            level: 1,
            owner_change_count: 0,
            last_owner_change_at: new Date(),
            neutral_until: null,
          }
        })
      } else if (existing.owner_id === user.id) {
        // Heal own territory
        await tx.territories.update({
          where: { id: cellId },
          data: {
            health: Math.min(1000, (existing.health || 0) + 100),
            last_maintained_at: new Date(),
          }
        })
        return { action: 'healed', scoreChange: 0, isHotZone: false }
      } else if ((existing.health ?? 0) <= 0) {
        // Enemy territory with 0 HP — capture it
        await tx.territories.update({
          where: { id: cellId },
          data: {
            owner_id: user.id,
            city_id: cityId,
            captured_at: new Date(),
            health: Math.round(1000 * multiplier),
            level: 1,
            last_maintained_at: new Date(),
            owner_change_count: { increment: 1 },
            last_owner_change_at: new Date(),
            neutral_until: null,
          }
        })
      } else {
        // Enemy territory with HP > 0 — cannot capture directly
        throw new Error('Territory is protected')
      }

      // 5. Write owner_change_log (only for REAL transfers: A→B)
      // A→neutral is NOT logged here — handled by attack neutralization
      if (previousOwnerId && previousOwnerId !== user.id) {
        await tx.territory_owner_change_logs.create({
          data: {
            territory_id: cellId,
            previous_owner: previousOwnerId,
            new_owner: user.id,
          }
        })
        // Invalidate hot zone cache for this territory
        await HotZoneCacheService.invalidate(cellId)
      }

      // 6. Hot Zone Score Calculation using owner_change_logs
      const windowStart = new Date()
      windowStart.setDate(windowStart.getDate() - 7)

      const recentChanges = await tx.territory_owner_change_logs.count({
        where: {
          territory_id: cellId,
          changed_at: { gte: windowStart },
        }
      })

      const isHotZone = recentChanges >= HOT_ZONE_THRESHOLD

      // Score: base per km² * hot zone multiplier
      // Hot zone: 0.5x (reduced reward for contested territory)
      // Normal:   1.0x
      const hotZoneMultiplier = isHotZone ? HOT_ZONE_CAPTURE_MULTIPLIER : NORMAL_CAPTURE_MULTIPLIER
      const baseScore = Math.round(H3_TILE_AREA_KM2 * BASE_SCORE_PER_KM2)
      const earnedScore = Math.round(baseScore * hotZoneMultiplier)

      // 7. Deduct score from previous owner (50% of their original score)
      if (previousOwnerId && previousOwnerId !== user.id) {
        const lossPenalty = Math.round(baseScore * LOSS_PENALTY_RATIO)
        await tx.user_city_progress.updateMany({
          where: { user_id: previousOwnerId, city_id: cityId },
          data: {
            score: { decrement: lossPenalty },
          }
        })
      }

      // 8. Update User Progress (Tiles + Area + Score)
      const progress = await tx.user_city_progress.findUnique({
        where: { user_id_city_id: { user_id: user.id, city_id: cityId } }
      })

      if (progress) {
        await tx.user_city_progress.update({
          where: { user_id_city_id: { user_id: user.id, city_id: cityId } },
          data: {
            tiles_captured: (progress.tiles_captured || 0) + 1,
            area_controlled: Number(progress.area_controlled || 0) + H3_TILE_AREA_KM2 * multiplier,
            score: (progress.score || 0) + earnedScore,
            last_active_at: new Date(),
          }
        })
      } else {
        await tx.user_city_progress.create({
          data: {
            user_id: user.id,
            city_id: cityId,
            tiles_captured: 1,
            area_controlled: H3_TILE_AREA_KM2 * multiplier,
            score: earnedScore,
            last_active_at: new Date(),
            joined_at: new Date(),
          }
        })
      }

      return { action: 'captured', scoreChange: earnedScore, isHotZone }
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

export async function fetchCityStats(cityId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. Count total players in this city (entries in user_city_progress)
  const { count: totalPlayers } = await supabase
    .from('user_city_progress')
    .select('*', { count: 'exact', head: true })
    .eq('city_id', cityId)

  // 2. Count active players (e.g., active in last 7 days)
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)

  const { count: activePlayers } = await supabase
    .from('user_city_progress')
    .select('*', { count: 'exact', head: true })
    .eq('city_id', cityId)
    .gt('last_active_at', lastWeek.toISOString())

  // 3. Count total tiles captured in this city
  const { count: totalTiles } = await supabase
    .from('territories')
    .select('*', { count: 'exact', head: true })
    .eq('city_id', cityId)

  // Approximate area (e.g. 1 tile = 0.01 km2, just an example constant)
  // Real calculation depends on H3 resolution.
  const ESTIMATED_AREA_PER_TILE = 0.01
  const totalArea = (totalTiles || 0) * ESTIMATED_AREA_PER_TILE

  return {
    totalPlayers: totalPlayers || 0,
    activePlayers: activePlayers || 0,
    totalArea: parseFloat(totalArea.toFixed(2)),
    totalTiles: totalTiles || 0
  }
}

export async function fetchCityLeaderboard(cityId: string, limit = 50): Promise<CityLeaderboardEntry[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('user_city_progress')
    .select(`
      user_id,
      area_controlled,
      tiles_captured,
      reputation,
      profiles (
        nickname,
        avatar_url,
        level
      )
    `)
    .eq('city_id', cityId)
    .order('area_controlled', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching leaderboard:', error)
    return []
  }

  interface CityLeaderboardResult {
    user_id: string
    area_controlled: number
    tiles_captured: number
    reputation: number
    profiles: {
      nickname: string
      avatar_url: string
      level: number
    } | null
  }

  const typedData = data as unknown as CityLeaderboardResult[]

  return (typedData || []).map((entry, index) => ({
    rank: index + 1,
    userId: entry.user_id,
    nickname: entry.profiles?.nickname || 'Unknown',
    level: entry.profiles?.level || 1,
    avatar: entry.profiles?.avatar_url || '',
    totalArea: entry.area_controlled,
    tilesCaptured: entry.tiles_captured,
    reputation: entry.reputation
  }))
}

export async function getUserCityProgress(cityId: string): Promise<UserCityProgress | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
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
  const supabase = createClient(cookieStore)
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
