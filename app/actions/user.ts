// 'use server'

import { createClient } from '@/mock-supabase'
import { cookies } from '@/mock-headers'

import { checkAndRewardMissions, RunContext } from '@/lib/game-logic/mission-checker'
import { initializeUserMissions } from '@/lib/game-logic/mission-service'

export async function stopRunningAction(context: RunContext) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  // Ensure dates are proper Date objects (Server Actions serialize Dates to strings)
  context.startTime = new Date(context.startTime)
  context.endTime = new Date(context.endTime)

  // Ensure daily missions are valid before processing run
  await initializeUserMissions(user.id)

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
  // BUT we should update `total_distance_km` in profile if it's a persistent stat.
  let userProvince = '';

  // Get user profile for distance update and province
  const { data: profile } = await supabase.from('profiles').select('total_distance_km, province').eq('id', user.id).single()
  
  if (profile) {
      userProvince = (profile as any).province || '';
      if (context.distance > 0) {
          const newDistance = ((profile as any).total_distance_km || 0) + context.distance
          await (supabase.from('profiles') as any).update({ total_distance_km: newDistance }).eq('id', user.id)
      }
  }

  // 3. Record Run for Club (Territory)
  // Check if user is in a club
  const { data: clubMember } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (clubMember) {
      // Calculate area (approx 650m2 per hex, converted to relevant unit if needed, or just raw count)
      // The UI shows "mi²" which suggests miles squared? Or maybe it's just a label.
      // Usually games use km² or m². Let's assume the 'area' field stores the value to be displayed.
      // If the UI shows "mi²", maybe we should store it as such.
      // However, check ClubDetailView: `t.area` is displayed directly.
      // If context.newHexCount is the number of hexes.
      // Let's assume 1 hex = 0.01 area unit for now, or just use hex count if that's the metric.
      // The user prompt said "area (面积)".
      // Let's use context.newHexCount * 0.001 (arbitrary) or just context.distance * 0.1?
      // Better: Use `context.newHexCount` (captured tiles) * 650 (m2) / 1000000 (to km2)
      // If newHexCount is undefined, use 0.
      
      const capturedArea = (context.newHexCount || 0) * 0.00065; // 650m2 in km2
      
      // Insert into runs
      await supabase.from('runs').insert({
          user_id: user.id,
          club_id: clubMember.club_id,
          area: Number(capturedArea.toFixed(4)), // Keep 4 decimals
          duration: Math.floor(context.duration * 60), // Convert minutes to seconds
          province: userProvince || context.regionId || null, // context.regionId might be province code
          created_at: new Date().toISOString() // Use now or endTime
      })

      // Also update Club Total Area (Trigger or manual update)
      // We can do it here for simplicity
      // First get current area
      const { data: club } = await supabase.from('clubs').select('total_area').eq('id', clubMember.club_id).single()
      if (club) {
          const newTotal = (Number(club.total_area) || 0) + Number(capturedArea.toFixed(4))
          await supabase.from('clubs').update({ total_area: newTotal }).eq('id', clubMember.club_id)
      }
      
      // Update User Total Area (Contribution)
      if (profile) {
           // We need to fetch current total_area from profile if it exists (it was added in migration)
           const { data: profileArea } = await supabase.from('profiles').select('total_area').eq('id', user.id).single()
           const currentArea = Number((profileArea as any)?.total_area || 0)
           await (supabase.from('profiles') as any).update({ 
               total_area: currentArea + Number(capturedArea.toFixed(4)) 
           }).eq('id', user.id)
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
    .select('level, current_exp, total_distance_km, coins, faction')
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
    (progress as any[]).forEach((p: any) => {
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
    coins: profile?.coins || 0,
    faction: profile?.faction || null
  }
}

export async function touchUserActivity() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return

  await (supabase
    .from('profiles') as any)
    .update({ updated_at: new Date().toISOString() })
    .eq('id', user.id)
}

import { cache } from 'react'

export const ensureUserProfile = cache(async (userId: string) => {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 🚀 Fast Path: Check ID existence only (<50ms)
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  // If profile exists, return immediately (Read-only path)
  if (data && !error) {
    return { success: true, isExisting: true }
  }

  // 🐢 Slow Path: Create new profile (Only for new users)
  console.log('[UserProfile] Creating new profile for:', userId)
  
  // We assume the user is authenticated in auth.users
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || user.id !== userId) {
      return { success: false, error: 'Unauthorized or ID mismatch' }
  }

  // Insert default profile
  const { error: insertError } = await (supabase
    .from('profiles') as any)
    .upsert({
      id: userId,
      nickname: user.email?.split('@')[0] || `Runner_${userId.slice(0, 6)}`,
      avatar_url: '',
      level: 1,
      current_exp: 0,
      max_exp: 100,
      stamina: 100,
      max_stamina: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (insertError) {
    console.error('Failed to create profile:', insertError)
    return { success: false, error: insertError.message }
  }

  return { success: true, isNew: true }
})

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

  const { error } = await (supabase
    .from('profiles') as any)
    .update(updates)
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  return { 
    success: true, 
    newLevel, 
    levelUp: newLevel > ((profile as any).level || 1),
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

  const { error } = await (supabase
    .from('profiles') as any)
    .update({
      coins: newCoins,
      updated_at: new Date().toISOString()
    } as any)
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  return { success: true, newCoins }
}
