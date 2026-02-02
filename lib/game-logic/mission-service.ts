import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Ensures that daily missions are reset if they are from a previous day.
 * This implements the "Lazy Load" strategy.
 */
export async function ensureDailyMissions(userId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. Fetch user's daily missions with their update time
  // We join with the 'missions' table to filter by frequency='daily'
  const { data: dailyMissions, error } = await supabase
    .from('user_missions')
    .select(`
      mission_id,
      updated_at,
      status,
      missions!inner (
        frequency
      )
    `)
    .eq('user_id', userId)
    .eq('missions.frequency', 'daily')

  if (error || !dailyMissions || dailyMissions.length === 0) {
    return
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  
  const idsToReset: string[] = []

  for (const um of dailyMissions) {
    const lastUpdate = new Date(um.updated_at).getTime()
    
    // If the mission was last updated before today (00:00:00 local time approx, or UTC depending on server)
    // Note: 'updated_at' from Supabase is ISO string (UTC usually).
    // Comparing with local server time might have issues if users are global.
    // Ideally, use user's timezone or fixed UTC day.
    // For now, we assume UTC day for consistency.
    
    const lastUpdateDate = new Date(um.updated_at)
    const isDifferentDay = lastUpdateDate.getUTCDate() !== now.getUTCDate() || 
                           lastUpdateDate.getUTCMonth() !== now.getUTCMonth() ||
                           lastUpdateDate.getUTCFullYear() !== now.getUTCFullYear()
    
    // Logic: If it's a new day, we reset.
    // BUT, what if they just completed it today? updated_at would be today.
    // What if they started it yesterday but didn't finish? updated_at is yesterday. Reset.
    // What if they completed it yesterday? updated_at is yesterday. Reset.
    // So any 'updated_at' NOT today needs reset.
    
    if (isDifferentDay) {
      idsToReset.push(um.mission_id)
    }
  }

  if (idsToReset.length > 0) {
    console.log(`[MissionService] Resetting ${idsToReset.length} daily missions for user ${userId}`)
    
    const { error: resetError } = await supabase
      .from('user_missions')
      .update({
        progress: 0,
        status: 'active', // Reset to active (todo)
        updated_at: new Date().toISOString(),
        // If we have a claimed_at, we might want to keep history? 
        // Typically daily missions overwrite the same record.
      })
      .eq('user_id', userId)
      .in('mission_id', idsToReset)

    if (resetError) {
      console.error('[MissionService] Failed to reset missions:', resetError)
    }
  }
}
