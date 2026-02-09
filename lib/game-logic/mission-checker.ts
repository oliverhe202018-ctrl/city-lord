
import { createClient } from '@/mock-supabase'
import { cookies } from '@/mock-headers'

export interface RunContext {
  distance: number // km
  capturedHexes: number
  capturedHexIds?: string[] // List of hex IDs captured/interacted with
  newHexCount?: number // Count of "newly discovered" hexes (for Exploration missions)
  startTime: Date
  endTime: Date
  regionId?: string
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

  // Pre-fetch hex count for HEX_TOTAL check if needed
  let totalHexCount = -1;

  // 2. Iterate and check conditions
  for (const um of userMissions) {
    const mission = um.missions
    if (!mission) continue

    let isCompleted = false
    let newProgress = um.progress || 0

    // --- LOGIC: Check Mission Type ---
    
    // Type: DISTANCE (Generic) or DISTANCE_DAILY
    const distanceMeters = context.distance * 1000

    if (mission.type === 'DISTANCE' || mission.type === 'DISTANCE_DAILY') {
      newProgress += distanceMeters
      if (newProgress >= mission.target) {
        isCompleted = true
        newProgress = mission.target
      }
    }
    
    // Type: RUN_COUNT (Count runs)
    else if (mission.type === 'RUN_COUNT') {
      newProgress += 1
      if (newProgress >= mission.target) {
        isCompleted = true
        newProgress = mission.target
      }
    }

    // Type: ACTIVE_DAYS (Count days active)
    else if (mission.type === 'ACTIVE_DAYS') {
      const lastUpdate = new Date(um.updated_at)
      const now = new Date()
      
      const isSameDay = lastUpdate.getDate() === now.getDate() && 
                        lastUpdate.getMonth() === now.getMonth() && 
                        lastUpdate.getFullYear() === now.getFullYear()

      // Only increment if last update was NOT today, OR if progress is 0 (never started)
      // Note: If progress is 0, updated_at might be old (from reset).
      // So if progress is 0, we always increment.
      // If progress > 0, we check if already updated today.
      
      if (newProgress === 0 || !isSameDay) {
        newProgress += 1
        if (newProgress >= mission.target) {
          isCompleted = true
          newProgress = mission.target
        }
      }
    }

    // Type: HEX_COUNT (Total hexes visited/captured in THIS run)
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
    
    // Type: HEX_TOTAL (Achievement - Total owned hexes)
    else if (mission.type === 'HEX_TOTAL') {
      if (totalHexCount === -1) {
        // Fetch once
        const { count } = await supabase
          .from('territories')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', userId)
        totalHexCount = count || 0
      }
      
      // Set progress to current total
      newProgress = totalHexCount
      if (newProgress >= mission.target) {
        isCompleted = true
        newProgress = mission.target
      }
    }

    // Type: SPEED_BURST (Performance - Average Pace)
    else if (mission.type === 'SPEED_BURST') {
      if (context.distance > 0.1 && pace <= mission.target) {
        isCompleted = true
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
        updates.status = 'completed' // User must claim it manually
        completedMissionIds.push(mission.id)
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
