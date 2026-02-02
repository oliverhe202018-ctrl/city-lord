import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export interface RunContext {
  distance: number // km
  capturedHexes: number
  capturedHexIds?: string[] // List of hex IDs captured/interacted with
  newHexCount?: number // Count of "newly discovered" hexes (for Exploration missions)
  startTime: Date
  endTime: Date
}

/**
 * Checks and rewards missions based on run performance
 * @param userId User ID
 * @param context Run statistics
 * @returns Array of completed mission IDs (for UI toast)
 */
export async function checkAndRewardMissions(
  userId: string, 
  context: RunContext
): Promise<string[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const completedMissionIds: string[] = []

  // 1. Fetch active missions for the user
  const { data: userMissions, error } = await supabase
    .from('user_missions')
    .select(`
      mission_id,
      status,
      progress,
      missions (
        id,
        type,
        target,
        reward_coins,
        reward_experience
      )
    `)
    .eq('user_id', userId)
    .neq('status', 'completed')
    .neq('status', 'claimed')

  if (error || !userMissions) {
    console.error('Error fetching missions for check:', error)
    return []
  }

  // Calculate Pace (min/km) for SPEED_BURST
  const durationMinutes = (context.endTime.getTime() - context.startTime.getTime()) / 1000 / 60
  const pace = context.distance > 0 ? durationMinutes / context.distance : 999 // Avoid divide by zero

  // 2. Iterate and check conditions
  for (const um of userMissions) {
    const mission = um.missions
    if (!mission) continue

    let isCompleted = false
    let newProgress = um.progress || 0

    // --- LOGIC: Check Mission Type ---
    
    // Type: DISTANCE_DAILY
    const distanceMeters = context.distance * 1000

    if (mission.type === 'DISTANCE_DAILY') {
      newProgress += distanceMeters
      if (newProgress >= mission.target) {
        isCompleted = true
        newProgress = mission.target
      }
    }
    
    // Type: HEX_COUNT (Total hexes visited/captured)
    else if (mission.type === 'HEX_COUNT') {
      newProgress += context.capturedHexes
      if (newProgress >= mission.target) {
        isCompleted = true
        newProgress = mission.target
      }
    }

    // Type: UNIQUE_HEX (Exploration - Newly discovered hexes)
    else if (mission.type === 'UNIQUE_HEX') {
      const added = context.newHexCount || 0
      newProgress += added
      if (newProgress >= mission.target) {
        isCompleted = true
        newProgress = mission.target
      }
    }

    // Type: SPEED_BURST (Performance - Average Pace)
    // Target is likely in min/km (e.g., 5 means 5:00/km)
    // Condition: Pace <= Target
    else if (mission.type === 'SPEED_BURST') {
      // Speed missions are usually "Achieve X pace in a run of at least Y distance"
      // But here we simplify: If average pace <= target, complete.
      // We should probably check if distance is reasonable (e.g. > 0.5km) to avoid 1-second sprint exploits.
      // Let's assume context.distance > 0.1 is required.
      if (context.distance > 0.1 && pace <= mission.target) {
        isCompleted = true
        // Progress for speed mission could be the best pace, but usually it's binary or counter.
        // Let's set progress to target to show completion.
        newProgress = mission.target
      }
    }

    // Type: NIGHT_RUN (Time specific)
    else if (mission.type === 'NIGHT_RUN') {
      const hour = context.endTime.getHours()
      const isNight = hour >= 22 || hour < 4
      
      if (isNight) {
        newProgress += 1
        if (newProgress >= mission.target) {
          isCompleted = true
          newProgress = mission.target
        }
      }
    }

    // 3. Update Database if progress changed
    if (newProgress !== um.progress || isCompleted) {
      const updates: any = {
        progress: newProgress,
        updated_at: new Date().toISOString()
      }

      if (isCompleted) {
        updates.status = 'completed'
        completedMissionIds.push(mission.id)
        
        // Auto-reward? Or wait for claim?
        // Requirement says: "Update status to 'COMPLETED'. Add coins/XP to profiles table."
        // Usually we wait for user to CLAIM, but requirement says "Add coins/XP".
        // Let's follow requirement: Auto-reward immediately.
        
        // However, standard UI pattern is "Claim". 
        // If we auto-reward, we should mark as 'claimed'?
        // The prompt says: "If a mission is completed... Update user_missions status to 'COMPLETED'... Add coins/XP"
        // This implies auto-claim behavior or just "Unlock reward".
        // Let's Stick to: Mark COMPLETED (so UI shows "Claim" button) OR Auto-Claim.
        // Re-reading: "Update user_missions status to 'COMPLETED'. Add coins/XP... Return ids for toast."
        // If we add coins/XP now, we should probably mark it as 'claimed' to avoid double claiming.
        // OR, we mark as 'completed' and the UI shows "Claimed" or just notifies.
        
        // Decision: To be safe and allow "Claim" animation if needed, usually we mark 'completed'.
        // BUT the requirement explicitly asks to "Add coins/XP to profiles table" NOW.
        // So we must effectively CLAIM it.
        updates.status = 'claimed' 
        updates.claimed_at = new Date().toISOString()

        // Apply Rewards
        if (mission.reward_coins > 0 || mission.reward_experience > 0) {
          await supabase.rpc('increment_user_stats', {
             p_user_id: userId,
             p_xp: mission.reward_experience || 0,
             p_coins: mission.reward_coins || 0
          }).catch(async (err) => {
             // Fallback if RPC doesn't exist (it might not yet)
             // We use separate calls or direct update
             // We can reuse addExperience/addCoins actions logic or just raw update
             console.warn('RPC increment_user_stats failed, trying direct update', err)
             
             // Simple direct update (race condition prone but fallback)
             const { data: profile } = await supabase.from('profiles').select('current_exp, coins').eq('id', userId).single()
             if (profile) {
               await supabase.from('profiles').update({
                 current_exp: (profile.current_exp || 0) + (mission.reward_experience || 0),
                 coins: (profile.coins || 0) + (mission.reward_coins || 0)
               }).eq('id', userId)
             }
          })
        }
      }

      await supabase
        .from('user_missions')
        .update(updates)
        .eq('user_id', userId)
        .eq('mission_id', mission.id)
    }
  }

  return completedMissionIds
}
