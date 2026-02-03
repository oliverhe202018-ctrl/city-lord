'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { calculateFactionBonus } from '@/lib/game-logic/faction-balance'

export type Faction = 'RED' | 'BLUE'

export async function getFactionStats() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Try to use RPC for efficiency
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_faction_stats_rpc')
  
  let redCount = 0
  let blueCount = 0
  let redArea = 0
  let blueArea = 0

  if (!rpcError && rpcData) {
    // Parse RPC result
    const redStats = (rpcData as any[]).find((r: any) => r.faction === 'RED')
    const blueStats = (rpcData as any[]).find((r: any) => r.faction === 'BLUE')
    
    redCount = redStats?.member_count || 0
    blueCount = blueStats?.member_count || 0
    redArea = Number(redStats?.total_area || 0)
    blueArea = Number(blueStats?.total_area || 0)
  } else {
    // Fallback to simple count if RPC fails (e.g. migration not run)
    // Note: This fallback won't get Area sum efficiently, so we default area to 0 or try separate queries if critical.
    // For now, let's just do the counts as before to keep basic functionality.
    
    const { count: rCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('faction', 'RED')
    
    const { count: bCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('faction', 'BLUE')

    redCount = rCount || 0
    blueCount = bCount || 0
    // Area remains 0 in fallback
  }

  const bonus = calculateFactionBonus(redCount, blueCount)

  return {
    RED: redCount,
    BLUE: blueCount,
    area: {
        RED: redArea,
        BLUE: blueArea
    },
    bonus
  }
}

export async function joinFaction(faction: Faction) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // 1. Get current profile to check restrictions
  let { data: profileData, error: fetchError } = await supabase
    .from('profiles')
    .select('faction, last_faction_change_at')
    .eq('id', user.id)
    .single()
  
  // Self-healing: If profile doesn't exist, create it
  if (!profileData || fetchError) {
    console.log('Profile missing or error for user, attempting to create...', user.id)
    
    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      nickname: user.email?.split('@')[0] || `Runner_${user.id.substring(0, 4)}`,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
      level: 1
    })

    // If insert failed and it wasn't because it already exists (race condition), return error
    if (insertError && insertError.code !== '23505') {
      console.error('Error creating profile during faction join:', insertError)
      return { success: false, error: 'Failed to initialize profile: ' + insertError.message }
    }

    // Retry fetch
    const retry = await supabase
      .from('profiles')
      .select('faction, last_faction_change_at')
      .eq('id', user.id)
      .single()
      
    profileData = retry.data
    fetchError = retry.error
  }

  const profile = profileData as any;

  if (fetchError || !profile) {
    console.error('Profile fetch error:', fetchError)
    return { success: false, error: 'Profile not found' }
  }

  // 2. Validate restriction (once per month)
  if (profile.last_faction_change_at) {
    const lastChange = new Date(profile.last_faction_change_at)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - lastChange.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 30) {
      return { 
        success: false, 
        error: `You can only change faction once a month. Try again in ${30 - diffDays} days.` 
      }
    }
  }

  // 3. Update faction
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      faction: faction,
      last_faction_change_at: new Date().toISOString()
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('Error joining faction:', updateError)
    return { success: false, error: 'Failed to join faction' }
  }

  return { success: true }
}
