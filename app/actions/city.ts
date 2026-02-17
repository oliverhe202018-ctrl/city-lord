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

    return data.map((t: any) => ({
      id: t.id,
      cityId: t.city_id,
      ownerId: t.owner_id,
      ownerType: currentUserId ? (t.owner_id === currentUserId ? 'me' : 'enemy') : 'neutral',
      capturedAt: t.captured_at,
      health: t.health,
      lastMaintainedAt: t.last_maintained_at
    }))
  } catch (err) {
    console.error('Territory fetch failed:', err)
    return []
  }
}

import { checkHiddenBadges } from './badge'
import { prisma } from '@/lib/prisma'
import { calculateFactionBalance } from '@/utils/faction-balance'
import { checkAndAwardBadges } from '@/app/actions/check-achievements'

export async function claimTerritory(cityId: string, cellId: string): Promise<{ success: boolean; error?: string; grantedBadges?: string[] }> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
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
        // Fetch snapshot for balance check
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
          console.log('Faction bonus debug:', {
            redScore,
            blueScore,
            scoreDiffRatio: diffRatio,
            bonusMultiplier: bonus
          })
          if (underdog && underdog.toUpperCase() === profile.faction.toUpperCase()) {
            multiplier = bonus
          }
        }
      }

      // 3. Concurrency Control & Claim Logic
      // "Optimistic Locking": Update only if owner is null or health <= 0
      const updateResult = await tx.territories.updateMany({
        where: {
          id: cellId,
          OR: [
            // { owner_id: null }, // Removed because owner_id is required in schema
            { health: { lte: 0 } }
          ]
        },
        data: {
          owner_id: user.id,
          city_id: cityId,
          captured_at: new Date(),
          health: 100 * multiplier, // Apply Buff to Health
          level: 1, // Reset level on capture
          last_maintained_at: new Date()
        }
      })

      // If updateMany returns count 0, check if we need to INSERT (if it doesn't exist)
      if (updateResult.count === 0) {
        // Check if it exists
        const exists = await tx.territories.findUnique({ where: { id: cellId } })

        if (!exists) {
          // Create new
          await tx.territories.create({
            data: {
              id: cellId,
              city_id: cityId,
              owner_id: user.id,
              captured_at: new Date(),
              health: 100 * multiplier,
              level: 1
            }
          })
        } else {
          // It exists and didn't match criteria (owned by someone else and healthy)
          // If I already own it, maybe just heal it?
          if (exists.owner_id === user.id) {
            await tx.territories.update({
              where: { id: cellId },
              data: {
                health: Math.min(100, (exists.health || 0) + 10), // Heal
                last_maintained_at: new Date()
              }
            })
            return { action: 'healed' }
          }

          // Owned by enemy and healthy -> Attack logic (reduce health) could go here
          // But for now, we assume failure to capture
          throw new Error('Territory is protected')
        }
      }

      // 4. Update User Progress (Tiles Captured)
      // We upsert user_city_progress
      const progress = await tx.user_city_progress.findUnique({
        where: { user_id_city_id: { user_id: user.id, city_id: cityId } }
      })

      if (progress) {
        await tx.user_city_progress.update({
          where: { user_id_city_id: { user_id: user.id, city_id: cityId } },
          data: {
            tiles_captured: (progress.tiles_captured || 0) + 1,
            area_controlled: Number(progress.area_controlled || 0) + 0.01 * multiplier, // Apply buff to area too? User said "capture_score"
            last_active_at: new Date()
          }
        })
      } else {
        await tx.user_city_progress.create({
          data: {
            user_id: user.id,
            city_id: cityId,
            tiles_captured: 1,
            area_controlled: 0.01 * multiplier,
            last_active_at: new Date(),
            joined_at: new Date()
          }
        })
      }

      return { action: 'captured' }
    })

    // 5. Check Hidden Badges (Outside Transaction for speed/simplicity or keep inside if critical)
    const newBadges = await checkAndAwardBadges(user.id, 'TERRITORY_CAPTURE')
    const grantedBadges = newBadges.map(b => b.code)

    // [NEW] Trigger Task Center Event
    try {
      const { TaskService } = await import('@/lib/services/task')
      await TaskService.processEvent(user.id, {
        type: 'GRID_CAPTURED',
        userId: user.id,
        timestamp: new Date(),
        data: {
          gridId: cellId,
          isNew: true, // Optimistic: we don't track isNew perfectly here without history check, but claimTerritory usually implies capture.
          // Requirement says "解锁或占领一个新的网格". 
          // If we captured it, it's new ownership. Even if we owned it before?
          // "New" usually means "I didn't own it just before".
          // Since we updated owner_id to me, and previous owner might have been null or enemy.
          // Yes, it is a capture.
          isSelf: true
        }
      })
    } catch (e) {
      console.error('Task event failed:', e)
    }

    return { success: true, grantedBadges }

  } catch (err: any) {
    console.error('Error claiming territory:', err)
    return { success: false, error: err.message || 'Claim failed' }
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
