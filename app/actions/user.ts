'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

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
  const { data: profile } = await supabase
    .from('profiles')
    .select('level, current_exp, total_distance_km, coins')
    .eq('id', user.id)
    .single()

  // Get User City Progress for Area/Tiles
  const { data: progress } = await supabase
    .from('user_city_progress')
    .select('tiles_captured, area_controlled')
    .eq('user_id', user.id)

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
    .update({ updated_at: new Date().toISOString() })
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
