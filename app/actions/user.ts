'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

import { checkAndRewardMissions, RunContext } from '@/lib/game-logic/mission-checker'
import { ensureDailyMissions } from '@/lib/game-logic/mission-service'

export async function stopRunningAction(context: RunContext) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  // Ensure dates are proper Date objects (Server Actions serialize Dates to strings)
  context.startTime = new Date(context.startTime)
  context.endTime = new Date(context.endTime)

  // Ensure daily missions are valid before processing run
  await ensureDailyMissions(user.id)

  // Calculate newHexCount for UNIQUE_HEX mission
  // We filter the capturedHexIds to ensure they are valid and owned by the user (or just captured in this run)
  if (context.capturedHexIds && context.capturedHexIds.length > 0) {
    // Dedup IDs first
    const uniqueIds = Array.from(new Set(context.capturedHexIds))
    
    // Verify these hexes are actually owned by the user now (claimed during run)
    // This prevents cheating by sending random hex IDs
    const { count, error } = await supabase
      .from('territories')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .in('id', uniqueIds)
      // Optional: Check if captured_at is recent (during the run) to ensure it's from this session
      .gte('captured_at', new Date(new Date(context.startTime).getTime() - 60000).toISOString()) // 1 min buffer

    if (!error) {
      context.newHexCount = count || 0
    }
  }

  // 1. Check and reward missions
  const completedMissionIds = await checkAndRewardMissions(user.id, context)

  // 2. Update total distance in profile (if not already handled by client sync)
  // Usually client syncs incrementally, but let's ensure consistency here or skip if client handles it.
  // Assuming client handles distance updates via `updateLocation` or similar. 
  // BUT we should update `total_distance_km` in profile if it's a persistent stat.
  if (context.distance > 0) {
      // Use RPC if available or simple update
      const { data: profile } = await supabase.from('profiles').select('total_distance_km').eq('id', user.id).single()
      if (profile) {
          const newDistance = (profile.total_distance_km || 0) + context.distance
          await supabase.from('profiles').update({ total_distance_km: newDistance }).eq('id', user.id)
      }
  }

  return { 
    success: true, 
    completedMissionIds 
  }
}

export async function getUserProfileStats() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      totalTiles: 0,
      totalArea: 0,
      totalDistance: 0,
      battlesWon: 0,
      level: 1,
      xp: 0,
      coins: 0
    }
  }

  // Get Profile Data
  const { data: profileData } = await supabase
    .from('profiles')
    .select('level, current_exp, total_distance_km, coins')
    .eq('id', user.id)
    .single()
    
  const profile = profileData as any;

  // Get User City Progress for Area/Tiles
  const { data: progressData } = await supabase
    .from('user_city_progress')
    .select('tiles_captured, area_controlled')
    .eq('user_id', user.id)
    
  const progress = progressData as any;

  let totalTiles = 0
  let totalArea = 0
  
  if (progress) {
    progress.forEach((p) => {
      totalTiles += (p.tiles_captured || 0)
      totalArea += Number(p.area_controlled || 0)
    })
  }

  return {
    totalTiles,
    totalArea,
    totalDistance: profile?.total_distance_km || 0,
    battlesWon: 0, // Future: fetch from battle logs
    level: profile?.level || 1,
    xp: profile?.current_exp || 0,
    coins: profile?.coins || 0
  }
}

export async function touchUserActivity() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return

  await supabase
    .from('profiles')
    .update({ updated_at: new Date().toISOString() } as any)
    .eq('id', user.id)
}

import { calculateLevel } from '@/lib/game-logic/level-system'

export async function addExperience(amount: number) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('level, current_exp')
    .eq('id', user.id)
    .single()

  if (!profile) return { success: false, error: 'Profile not found' }

  const newExp = ((profile as any).current_exp || 0) + amount
  const newLevel = calculateLevel(newExp)
  
  const updates: { current_exp: number; updated_at: string; level?: number } = {
    current_exp: newExp,
    updated_at: new Date().toISOString()
  }

  if (newLevel > ((profile as any).level || 1)) {
    updates.level = newLevel
    // Here we could also trigger level up notification or rewards
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  return { 
    success: true, 
    newLevel, 
    levelUp: newLevel > (profile.level || 1),
    newExp 
  }
}

export async function addCoins(amount: number) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('coins')
    .eq('id', user.id)
    .single()

  if (!profile) return { success: false, error: 'Profile not found' }

  const newCoins = ((profile as any).coins || 0) + amount

  const { error } = await supabase
    .from('profiles')
    .update({
      coins: newCoins,
      updated_at: new Date().toISOString()
    } as any)
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  return { success: true, newCoins }
}
