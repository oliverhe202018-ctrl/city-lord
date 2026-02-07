// 'use server'

import { createClient } from '@/mock-supabase'
import { cookies } from '@/mock-headers'
import { ACHIEVEMENT_DEFINITIONS } from '@/lib/achievements'
import { getUserProfileStats } from './user'

export interface AchievementCheckResult {
  newBadges: string[]
  rewards: {
    xp: number
    coins: number
  }
}

export interface RunContext {
  distance: number // km
  duration: number // minutes
  startTime: Date
  endTime: Date
  tilesCaptured: number
  regionId?: string
  pace?: number // min/km
}

/**
 * Checks all achievement conditions against user stats and grants new ones.
 * This should be called after significant user actions (run finish, tile capture).
 * @param runContext Optional context from a just-finished run to check single-event achievements
 */
export async function checkAndGrantAchievements(runContext?: RunContext): Promise<AchievementCheckResult> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { newBadges: [], rewards: { xp: 0, coins: 0 } }

  // 1. Get User Stats
  const stats = await getUserProfileStats()
  
  // 2. Get Owned Badges
  const { data: userBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', user.id)
  
  const ownedIds = new Set(userBadges?.map(b => b.badge_id) || [])
  const newBadges: string[] = []
  let totalXp = 0
  let totalCoins = 0

  // Helper for region count
  let distinctRegionsCount = 0
  if (!ownedIds.has('exploration_4')) {
     const { count } = await supabase
       .from('user_city_progress')
       .select('city_id', { count: 'exact', head: true })
       .eq('user_id', user.id)
     distinctRegionsCount = count || 0
  }

  // 3. Iterate Definitions and Check Conditions
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (ownedIds.has(def.id)) continue

    let qualified = false

    // --- Territory Logic ---
    if (def.category === 'territory') {
      // Basic count checks
      if (def.id === 'exploration_1' && stats.totalTiles >= 1) qualified = true
      if (def.id === 'exploration_2' && stats.totalTiles >= 1) qualified = true 
      if (def.id === 'exploration_3' && stats.totalTiles >= 10) qualified = true
      if (def.id === 'exploration_7' && stats.totalTiles >= 100) qualified = true
      
      // "exploration_4": "3 different regions"
      if (def.id === 'exploration_4' && distinctRegionsCount >= 3) qualified = true

      // "exploration_5": "3 consecutive days" (Simulated/Placeholder: grant if > 50 tiles for now)
      if (def.id === 'exploration_5' && stats.totalTiles >= 50) qualified = true 

      // "exploration_6": "Complete region" (Simulated: grant if > 200 tiles)
      if (def.id === 'exploration_6' && stats.totalTiles >= 200) qualified = true

      // "exploration_8": "Regional Overlord" (Simulated: grant if > 500 tiles)
      if (def.id === 'exploration_8' && stats.totalTiles >= 500) qualified = true

      // "exploration_9": "World End" (Simulated: grant if > 1000 tiles)
      if (def.id === 'exploration_9' && stats.totalTiles >= 1000) qualified = true
    }

    // --- Endurance Logic ---
    if (def.category === 'running') {
      // Cumulative Distance
      if (def.id === 'endurance_1' && stats.totalDistance >= 1) qualified = true
      if (def.id === 'endurance_3' && stats.totalDistance >= 42.195) qualified = true
      if (def.id === 'endurance_4' && stats.totalDistance >= 50) qualified = true
      if (def.id === 'endurance_5' && stats.totalDistance >= 100) qualified = true
      if (def.id === 'endurance_6' && stats.totalDistance >= 100) qualified = true // Simplified: Treat same as 100km total for now
      if (def.id === 'endurance_8' && stats.totalDistance >= 500) qualified = true
      if (def.id === 'endurance_9' && stats.totalDistance >= 1000) qualified = true
      
      // Single Run Context Checks
      if (runContext) {
        // "endurance_2": Single run > 10km
        if (def.id === 'endurance_2' && runContext.distance >= 10) qualified = true
        
        // "endurance_7": 30 consecutive days (Simulated: grant if total > 300km)
        if (def.id === 'endurance_7' && stats.totalDistance >= 300) qualified = true

        // "endurance_10": Pace < 4:00/km (Run must be > 1km to count)
        if (def.id === 'endurance_10' && runContext.distance >= 1) {
           const pace = runContext.duration / runContext.distance
           if (pace <= 4.0) qualified = true
        }
      }
    }

    // --- Conquest Logic ---
    if (def.category === 'territory' && def.id.startsWith('conquest')) {
        // We lack "stolen" stats. Simulate based on battles won or total tiles.
        // "conquest_1": 1 tile (Simulate with 5 total tiles)
        if (def.id === 'conquest_1' && stats.totalTiles >= 5) qualified = true
        // "conquest_2": 10 tiles (Simulate with 50 total tiles)
        if (def.id === 'conquest_2' && stats.totalTiles >= 50) qualified = true
        // "conquest_3": 100 tiles (Simulate with 500 total tiles)
        if (def.id === 'conquest_3' && stats.totalTiles >= 500) qualified = true
    }

    // --- Hidden/Special Logic ---
    if (def.category === 'special' && runContext) {
        const hour = new Date(runContext.endTime).getHours()
        
        // "hidden_1": Early Bird (5-7 AM)
        if (def.id === 'hidden_1' && hour >= 5 && hour < 7) qualified = true
        
        // "hidden_2": Night Walker (22-4 AM)
        if (def.id === 'hidden_2' && (hour >= 22 || hour < 4)) qualified = true
        
        // "hidden_3": Flash/Rain (Simulated: Random chance 1/20 on run finish)
        if (def.id === 'hidden_3' && Math.random() < 0.05) qualified = true
    }

    // --- Grant if qualified ---
    if (qualified) {
      // First, ensure the badge exists in the 'badges' table to satisfy FK
      const { error: badgeError } = await supabase
        .from('badges')
        .upsert({
            id: def.id,
            name: def.title,
            description: def.description,
            category: def.category,
            condition_value: def.maxProgress,
            tier: def.rarity,
            icon_name: 'award'
        }, { onConflict: 'id' })

      if (badgeError) {
          console.error(`Failed to sync badge def ${def.id}`, badgeError)
          continue
      }

      // Now grant to user
      const { error: grantError } = await supabase
        .from('user_badges')
        .insert({
          user_id: user.id,
          badge_id: def.id,
          earned_at: new Date().toISOString()
        })

      if (!grantError) {
        newBadges.push(def.title)
        if (def.rewards.xp) totalXp += def.rewards.xp
        if (def.rewards.coins) totalCoins += def.rewards.coins
      }
    }
  }

  // 4. Apply Rewards
  if (totalXp > 0 || totalCoins > 0) {
    const { error: updateError } = await supabase.rpc('increment_user_stats', {
        p_user_id: user.id,
        p_xp: totalXp,
        p_coins: totalCoins
    })

    if (updateError) {
        const { data: p } = await supabase.from('profiles').select('current_exp, coins').eq('id', user.id).single()
        if (p) {
            await supabase.from('profiles').update({
                current_exp: (p.current_exp || 0) + totalXp,
                coins: (p.coins || 0) + totalCoins
            }).eq('id', user.id)
        }
    }
  }

  return {
    newBadges,
    rewards: { xp: totalXp, coins: totalCoins }
  }
}
