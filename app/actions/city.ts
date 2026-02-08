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

export async function claimTerritory(cityId: string, cellId: string): Promise<{ success: boolean; error?: string; grantedBadges?: string[] }> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // 1. Call claim_territory RPC (Handles capture, repair, and decay logic)
  const { data: claimResult, error: claimError } = await supabase.rpc('claim_territory', {
    p_city_id: cityId,
    p_cell_id: cellId
  })

  if (claimError) {
    console.error('Error claiming territory:', claimError)
    return { success: false, error: claimError.message }
  }

  const result = claimResult as any

  // 2. Update user progress (increment tiles captured) - Only if NEW capture
  if (result && result.action === 'captured') {
    const { error: progressError } = await supabase.rpc('increment_user_tiles', { 
      p_user_id: user.id, 
      p_city_id: cityId 
    } as any)

    if (progressError) {
      console.error('Error incrementing user tiles:', progressError)
      // We still consider the claim successful if the territory row was inserted/updated
    }
  }

  // 3. Check for Hidden Badges (Night Owl, Early Bird)
  const grantedBadges = await checkHiddenBadges(user.id, {
    type: 'territory_claim',
    timestamp: new Date()
  })

  return { success: true, grantedBadges }
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
