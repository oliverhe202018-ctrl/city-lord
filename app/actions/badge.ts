'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export interface Badge {
  id: string
  code: string
  name: string
  description: string
  icon_name: string
  category: 'exploration' | 'endurance' | 'conquest' | 'hidden'
  condition_value: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
}

export interface UserBadge {
  badge_id: string
  earned_at: string
  badge: Badge
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
