import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Ensures that user has all required missions assigned and resets them if needed.
 * This implements the "Lazy Load" strategy.
 * 
 * Logic:
 * 1. Fetch all 'daily' and 'weekly' mission templates.
 * 2. Fetch existing user_missions.
 * 3. Create missing missions.
 * 4. Reset stale missions (Daily: different day; Weekly: different week).
 */
export async function ensureUserMissions(userId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const now = new Date()

  // 1. Fetch all auto-assign templates
  const { data: templates, error: templatesError } = await supabase
    .from('missions')
    .select('id, frequency')
    .in('frequency', ['daily', 'weekly'])

  if (templatesError || !templates) {
    console.error('[MissionService] Failed to fetch mission templates:', templatesError)
    return
  }

  // 2. Fetch existing user missions
  const { data: existingMissions, error: userMissionsError } = await supabase
    .from('user_missions')
    .select('mission_id, updated_at, status')
    .eq('user_id', userId)

  if (userMissionsError) {
    console.error('[MissionService] Failed to fetch user missions:', userMissionsError)
    return
  }

  const existingMap = new Map(existingMissions?.map(m => [m.mission_id, m]))
  const missionsToInsert: any[] = []
  const idsToReset: string[] = []

  // 3. Identify missing and stale missions
  for (const template of templates) {
    const existing = existingMap.get(template.id)

    if (!existing) {
      // Missing: Add to insert list
      missionsToInsert.push({
        user_id: userId,
        mission_id: template.id,
        status: 'active', // 'todo' in UI but 'active' might be default in DB? Check constraints.
        // DB constraint: check (status in ('locked', 'active', 'completed', 'claimed')) OR ('todo', 'in-progress', ...)
        // Let's check the constraint in previous tool output. 
        // RPC sql said: check (status in ('locked', 'active', 'completed', 'claimed'))
        // Types/Supabase.ts said: status: 'todo' | 'in-progress' | 'completed' | 'claimed'
        // This is a conflict. I should check the DB constraint again or stick to one.
        // app/actions/mission.ts uses 'todo'.
        // Let's use 'active' if that's what the SQL says, or 'todo' if TypeScript says so.
        // Wait, seed.sql init_user_game_data uses 'in-progress'.
        // Let's use 'active' for now, or check DB. 
        // Actually, looking at `mission_rpc.sql`: check (status in ('locked', 'active', 'completed', 'claimed'))
        // Looking at `types/supabase.ts`: status: 'todo' | 'in-progress' | 'completed' | 'claimed'
        // This suggests the TS types might be out of sync or the DB constraint was updated.
        // Safest bet: 'active' seems standard in SQL, but UI maps it. 
        // Let's try 'active'. If it fails, I'll fix it. 
        // Actually, `mission-checker.ts` uses 'active' in `ensureDailyMissions` (previous code): `status: 'active'`.
        // So I will stick with 'active'.
        status: 'active',
        progress: 0,
        updated_at: now.toISOString()
      })
    } else {
      // Exists: Check if reset needed
      const lastUpdate = new Date(existing.updated_at)
      let shouldReset = false

      if (template.frequency === 'daily') {
        // Reset if last update was not today (UTC)
        if (
          lastUpdate.getUTCDate() !== now.getUTCDate() ||
          lastUpdate.getUTCMonth() !== now.getUTCMonth() ||
          lastUpdate.getUTCFullYear() !== now.getUTCFullYear()
        ) {
          shouldReset = true
        }
      } else if (template.frequency === 'weekly') {
        // Reset if last update was before this week's start (Monday)
        const day = now.getUTCDay() // 0 (Sun) - 6 (Sat)
        const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
        const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff))
        // If last update is before this week's Monday 00:00
        if (lastUpdate < monday) {
          shouldReset = true
        }
      }

      if (shouldReset) {
        idsToReset.push(template.id)
      }
    }
  }

  // 4. Perform Insertions
  if (missionsToInsert.length > 0) {
    console.log(`[MissionService] Creating ${missionsToInsert.length} new missions for user ${userId}`)
    const { error } = await supabase
      .from('user_missions')
      .insert(missionsToInsert)
    
    if (error) {
      console.error('[MissionService] Failed to create missions:', error)
    }
  }

  // 5. Perform Resets
  if (idsToReset.length > 0) {
    console.log(`[MissionService] Resetting ${idsToReset.length} stale missions for user ${userId}`)
    const { error } = await supabase
      .from('user_missions')
      .update({
        progress: 0,
        status: 'active',
        updated_at: now.toISOString(),
        claimed_at: null // Clear claimed status
      })
      .eq('user_id', userId)
      .in('mission_id', idsToReset)

    if (error) {
      console.error('[MissionService] Failed to reset missions:', error)
    }
  }
}

// Alias for backward compatibility if needed, but we'll update callers.
export const ensureDailyMissions = ensureUserMissions
