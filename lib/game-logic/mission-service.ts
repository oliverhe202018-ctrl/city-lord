
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

// Define the default missions structure
export const DEFAULT_MISSIONS = [
  // Daily Missions
  {
    id: 'daily_run_1',
    title: '每日开跑',
    description: '完成一次任意距离的跑步',
    type: 'RUN_COUNT',
    target: 1,
    reward_coins: 10,
    reward_experience: 50,
    frequency: 'daily'
  },
  {
    id: 'daily_dist_3',
    title: '每日3公里',
    description: '单日累计跑步距离达到3公里',
    type: 'DISTANCE',
    target: 3000, // meters
    reward_coins: 30,
    reward_experience: 100,
    frequency: 'daily'
  },
  {
    id: 'daily_hex_10',
    title: '领地扩张',
    description: '单日占领或访问10个地块',
    type: 'HEX_COUNT',
    target: 10,
    reward_coins: 20,
    reward_experience: 80,
    frequency: 'daily'
  },
  
  // Weekly Missions
  {
    id: 'weekly_dist_15',
    title: '周跑者',
    description: '本周累计跑步15公里',
    type: 'DISTANCE',
    target: 15000,
    reward_coins: 100,
    reward_experience: 800,
    frequency: 'weekly'
  },
  {
    id: 'weekly_run_5',
    title: '坚持不懈',
    description: '本周累计完成5次跑步',
    type: 'RUN_COUNT',
    target: 5,
    reward_coins: 80,
    reward_experience: 600,
    frequency: 'weekly'
  },
  {
    id: 'weekly_explorer_20',
    title: '城市探险',
    description: '本周探索20个新地块',
    type: 'UNIQUE_HEX',
    target: 20,
    reward_coins: 150,
    reward_experience: 700,
    frequency: 'weekly'
  },
  {
    id: 'weekly_night_3',
    title: '夜行侠',
    description: '本周完成3次夜跑（22:00-04:00）',
    type: 'NIGHT_RUN',
    target: 3,
    reward_coins: 80,
    reward_experience: 400,
    frequency: 'weekly'
  },
  {
    id: 'weekly_active_3',
    title: '活跃跑者',
    description: '本周累计跑步3天',
    type: 'ACTIVE_DAYS',
    target: 3,
    reward_coins: 50,
    reward_experience: 300,
    frequency: 'weekly'
  },
  {
    id: 'weekly_hex_50',
    title: '领地大亨',
    description: '本周占领或访问50个地块',
    type: 'HEX_COUNT',
    target: 50,
    reward_coins: 150,
    reward_experience: 600,
    frequency: 'weekly'
  },
  {
    id: 'weekly_calories_1000',
    title: '燃烧吧卡路里',
    description: '本周累计消耗1000千卡',
    type: 'CALORIES',
    target: 1000,
    reward_coins: 120,
    reward_experience: 500,
    frequency: 'weekly'
  },

  // Achievements
  {
    id: 'ach_first_run',
    title: '初次启程',
    description: '完成你的第一次跑步',
    type: 'RUN_COUNT',
    target: 1,
    reward_coins: 50,
    reward_experience: 200,
    frequency: 'achievement'
  },
  {
    id: 'ach_marathon',
    title: '累计马拉松',
    description: '累计跑步距离达到42.195公里',
    type: 'DISTANCE',
    target: 42195,
    reward_coins: 500,
    reward_experience: 2000,
    frequency: 'achievement'
  },
  {
    id: 'ach_landlord',
    title: '大地主',
    description: '累计拥有100个地块',
    type: 'HEX_TOTAL', // Check total owned hexes
    target: 100,
    reward_coins: 1000,
    reward_experience: 5000,
    frequency: 'achievement'
  }
] as const;

// Simple in-memory cache to avoid redundant checks per request
// Map<userId, lastCheckTimestamp>
const missionCheckCache = new Map<string, number>()
const CACHE_TTL_MS = 60 * 1000 // 60 seconds

/**
 * Ensures that user has all required missions assigned and resets them if needed.
 * This implements the "Lazy Load" strategy with READ-FIRST optimization.
 * 
 * Strategy:
 * 1. READ: Fetch all user missions first.
 * 2. MEMORY CHECK: Determine if any mission is missing or stale (needs daily/weekly reset).
 * 3. WRITE: Only perform DB writes if absolutely necessary.
 * 4. CACHE: Skip entire process if checked recently (60s).
 */
export async function initializeUserMissions(userId: string) {
  const now = Date.now()
  const lastCheck = missionCheckCache.get(userId)

  // 1. Caching Strategy: Skip if checked recently
  if (lastCheck && (now - lastCheck < CACHE_TTL_MS)) {
    // console.log(`[MissionService] Skipping initialization for ${userId.slice(0, 8)} (cached)`)
    return
  }

  const startTime = performance.now()
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const nowDate = new Date()

  // console.log(`[MissionService] Starting initialization for user ${userId.slice(0, 8)}...`)

  try {
    // 2. READ FIRST: Fetch existing user missions
    const { data: existingMissions, error: userMissionsError } = await supabase
      .from('user_missions')
      .select('mission_id, updated_at, status, progress')
      .eq('user_id', userId)

    if (userMissionsError) {
      console.error('[MissionService] Failed to fetch user missions:', userMissionsError)
      return
    }

    // Update cache timestamp after successful fetch
    missionCheckCache.set(userId, now)

    // 3. MEMORY CHECK
    const existingMap = new Map(existingMissions?.map(m => [m.mission_id, m]) || [])
    
    const missionsToInsert: any[] = []
    const missionsToReset: string[] = []
    
    // Check every template against existing data
    for (const template of DEFAULT_MISSIONS) {
      const existing = existingMap.get(template.id)

      // A. Check for Missing
      if (!existing) {
        missionsToInsert.push({
          user_id: userId,
          mission_id: template.id,
          status: 'in-progress', 
          progress: 0,
          updated_at: nowDate.toISOString()
        })
        continue
      }

      // B. Check for Stale (Reset Logic)
      if (template.frequency === 'achievement') continue
      if (!existing.updated_at) continue // Defensive

      const lastUpdate = new Date(existing.updated_at)
      let shouldReset = false

      if (template.frequency === 'daily') {
        const isSameDay = lastUpdate.getDate() === nowDate.getDate() && 
                          lastUpdate.getMonth() === nowDate.getMonth() && 
                          lastUpdate.getFullYear() === nowDate.getFullYear()
        if (!isSameDay) shouldReset = true
      } else if (template.frequency === 'weekly') {
        const getMonday = (d: Date) => {
          d = new Date(d)
          const day = d.getDay()
          const diff = d.getDate() - day + (day === 0 ? -6 : 1)
          return new Date(d.setDate(diff))
        }
        const currentMonday = getMonday(nowDate)
        const lastUpdateMonday = getMonday(lastUpdate)
        // Reset if the last update was in a previous week
        if (currentMonday.getTime() !== lastUpdateMonday.getTime()) shouldReset = true
      }

      if (shouldReset) {
        missionsToReset.push(template.id)
      }
    }

    // 4. WRITE ONLY IF NEEDED
    
    // Handle Inserts (Missing Missions)
    if (missionsToInsert.length > 0) {
      console.log(`[MissionService] Inserting ${missionsToInsert.length} missing missions...`)
      
      // NOTE: We do NOT auto-seed the 'missions' table here because it requires admin privileges (RLS).
      // New missions must be added via SQL migration.
      // We assume the 'missions' table already contains the definition.
      
      const { error: insertError } = await supabase
        .from('user_missions')
        .insert(missionsToInsert)
      
      if (insertError) console.error('[MissionService] Failed to insert new missions:', insertError)
    }

    // Handle Resets (Stale Missions)
    if (missionsToReset.length > 0) {
      console.log(`[MissionService] Resetting ${missionsToReset.length} stale missions...`)
      
      // Bulk update is tricky without a stored procedure for multiple IDs with same values
      // But here we set all to same 'in-progress', 0, now()
      const { error: updateError } = await supabase
        .from('user_missions')
        .update({
          status: 'in-progress',
          progress: 0,
          updated_at: nowDate.toISOString()
        })
        .eq('user_id', userId)
        .in('mission_id', missionsToReset)

      if (updateError) {
        console.error('[MissionService] Failed to reset missions:', updateError)
      }
    }

    if (missionsToInsert.length === 0 && missionsToReset.length === 0) {
      // console.log('[MissionService] No changes needed.')
    } else {
       const duration = (performance.now() - startTime).toFixed(2)
       console.log(`[MissionService] Initialization (Writes performed) completed in ${duration}ms`)
    }

  } catch (error) {
    console.error('[MissionService] Unexpected error during initialization:', error)
  }
}
