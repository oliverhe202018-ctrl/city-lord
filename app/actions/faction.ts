'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export type Faction = 'RED' | 'BLUE'

export async function getFactionStats() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // We can do two queries or one with aggregation. 
  // Since we have an index on faction, simple counts are fast.
  const { count: redCount, error: redError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('faction', 'RED')

  const { count: blueCount, error: blueError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('faction', 'BLUE')

  if (redError || blueError) {
    console.error('Error fetching faction stats:', redError, blueError)
    return { RED: 0, BLUE: 0 }
  }

  return {
    RED: redCount || 0,
    BLUE: blueCount || 0
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
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('faction, last_faction_change_at')
    .eq('id', user.id)
    .single()

  if (fetchError || !profile) {
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
