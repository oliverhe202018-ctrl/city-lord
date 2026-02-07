'use server'

import { createClient } from '@/lib/supabase/server'

import { ACHIEVEMENT_DEFINITIONS } from '@/lib/achievements'

export async function syncBadges() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  // Iterate local definitions
  const upsertData = ACHIEVEMENT_DEFINITIONS.map(def => {
    // Smart Parsing Logic
    let reqType = 'count' // Default fallback
    let reqValue = def.maxProgress

    // 1. Analyze Category & Description
    const desc = def.description
    const cat = def.category

    if (cat === 'running') {
        reqType = 'distance' // Default for running
        if (desc.includes('次') || desc.includes('天')) {
            reqType = 'count' // "Run 30 days" or "Run 1 time"
        } else if (desc.includes('配速')) {
            reqType = 'pace'
        }
    } else if (cat === 'territory') {
        reqType = 'count' // Default for territory (tiles)
        if (desc.includes('面积') || desc.includes('占有率')) {
            reqType = 'area'
        }
    }

    // 2. Extract number from description if needed (User requested parsing text)
    // Actually, maxProgress is usually the source of truth for the threshold.
    // But let's respect the "Smart Parse" request if maxProgress is 1 (generic) but text has a number.
    // However, looking at the data, maxProgress seems accurate (e.g. 100km -> 100).
    // Let's stick to maxProgress for value to be safe, but use text for type inference.
    
    // Override type if description strongly suggests otherwise
    if (desc.includes('公里') || desc.includes('km')) {
        // If it's a cumulative distance badge, ensure type is distance
        if (!desc.includes('次') && !desc.includes('天')) {
             reqType = 'distance'
        }
    }

    return {
        code: def.id,
        name: def.title,
        description: def.description, // Requirement Description
        icon_path: def.image || null,
        category: def.category, // 'territory' | 'running' | 'special'
        level: def.rarity, // Map rarity to level/tier
        requirement_type: reqType,
        requirement_value: reqValue,
        tier: def.rarity, // Keep tier column sync
        condition_value: reqValue // Legacy column
    }
  })

  const { error } = await supabase
    .from('badges')
    .upsert(upsertData, { onConflict: 'code' })

  if (error) {
    console.error('Sync badges error:', error)
    return { success: false, error: error.message }
  }

  return { success: true, count: upsertData.length }
}

export interface Badge {
  id: string
  code: string
  name: string
  description: string
  icon_name: string
  category: 'exploration' | 'endurance' | 'conquest' | 'hidden'
  condition_value: number
  requirement_type?: string
  requirement_value?: number
  icon_path?: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  level?: string
}

export interface UserBadge {
  badge_id: string
  earned_at: string
  badge: Badge
}

export async function deleteBadge(badgeId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase
    .from('badges')
    .delete()
    .eq('id', badgeId)

  if (error) {
    console.error('Delete badge error:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function upsertBadge(data: Partial<Badge>) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Validate required fields
  if (!data.code || !data.name) {
    return { success: false, error: 'Code and Name are required' }
  }

  // Ensure tier is set if level is present (sync logic)
  // And ensure category is valid
  
  const upsertData = {
    ...data,
    tier: data.level || data.tier || 'common', // fallback
    condition_value: data.requirement_value || 0, // legacy sync
  }

  const { error } = await supabase
    .from('badges')
    .upsert(upsertData as any, { onConflict: 'code' })

  if (error) {
    console.error('Upsert badge error:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function fetchAllBadges() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .order('condition_value', { ascending: true })

  if (error) {
    console.error('Error fetching badges:', error)
    return []
  }

  return data as Badge[]
}

export async function fetchUserBadges() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('user_badges')
    .select(`
      badge_id,
      earned_at,
      badge:badges (*)
    `)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error fetching user badges:', error)
    return []
  }

  return data.map((item: any) => ({
    badge_id: item.badge_id,
    earned_at: item.earned_at,
    badge: item.badge
  })) as UserBadge[]
}

/**
 * Grant a specific badge to a user by code
 */
export async function grantBadge(userId: string, badgeCode: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. Find badge ID by code
  const { data: badge, error: badgeError } = await supabase
    .from('badges')
    .select('id, name')
    .eq('code', badgeCode)
    .single()

  if (badgeError || !badge) {
    console.error(`Badge code not found: ${badgeCode}`)
    return { success: false, error: 'Badge not found' }
  }

  // 2. Check if user already has it
  const { data: existing, error: checkError } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)
    .eq('badge_id', badge.id)
    .single()

  if (existing) {
    return { success: false, alreadyHas: true }
  }

  // 3. Grant badge
  const { error: insertError } = await supabase
    .from('user_badges')
    .insert({
      user_id: userId,
      badge_id: badge.id,
      earned_at: new Date().toISOString()
    })

  if (insertError) {
    console.error('Error granting badge:', insertError)
    return { success: false, error: insertError.message }
  }

  return { success: true, badgeName: badge.name }
}

import { getUserProfileStats } from './user'

/**
 * Check and grant hidden badges based on context
 */
export async function checkHiddenBadges(userId: string, context: { type: 'run_end' | 'territory_claim', timestamp: Date }) {
  const hour = context.timestamp.getHours()
  const results: string[] = []

  // Logic for 'night_owl': Activity between 22:00 (10 PM) and 04:00 (4 AM)
  // 22, 23, 0, 1, 2, 3
  if (hour >= 22 || hour < 4) {
    const result = await grantBadge(userId, 'night_owl')
    if (result.success && result.badgeName) {
      results.push(result.badgeName)
    }
  }

  // Logic for 'early_bird': Activity between 05:00 and 07:00 (Example)
  if (hour >= 5 && hour < 8) {
     const result = await grantBadge(userId, 'early_bird')
     if (result.success && result.badgeName) {
       results.push(result.badgeName)
     }
  }

  // Also check progress badges whenever hidden badges are checked (e.g. after a claim)
  const progressBadges = await checkProgressBadges(userId)
  results.push(...progressBadges)

  return results
}

/**
 * Check standard progress badges (Exploration, Endurance, Conquest)
 */
export async function checkProgressBadges(userId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const results: string[] = []

  // 1. Get User Stats
  const stats = await getUserProfileStats()
  
  // 2. Get All Badges (that are not hidden)
  const { data: badges } = await supabase
    .from('badges')
    .select('*')
    .neq('category', 'hidden')
  
  if (!badges) return []

  // 3. Get User's Existing Badges
  const { data: userBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)

  const ownedBadgeIds = new Set(userBadges?.map(ub => ub.badge_id) || [])

  // 4. Check Conditions
  for (const badge of badges) {
    if (ownedBadgeIds.has(badge.id)) continue

    let qualified = false
    
    switch (badge.category) {
      case 'exploration': // Based on Tiles Captured
        if (stats.totalTiles >= badge.condition_value) qualified = true
        break
      case 'endurance': // Based on Distance (km)
        if (stats.totalDistance >= badge.condition_value) qualified = true
        break
      case 'conquest': // Based on Area (km2) or maybe just count
        // Assuming condition_value for conquest is Area or maybe Tiles too?
        // Let's assume Area for Conquest.
        if (stats.totalArea >= badge.condition_value) qualified = true
        break
    }

    if (qualified) {
      // Grant it
      const { error } = await supabase
        .from('user_badges')
        .insert({
          user_id: userId,
          badge_id: badge.id,
          earned_at: new Date().toISOString()
        })
      
      if (!error) {
        results.push(badge.name)
      }
    }
  }

  return results
}
