
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
    reward_experience: 500,
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

/**
 * Ensures that user has all required missions assigned and resets them if needed.
 * This implements the "Lazy Load" strategy.
 */
export async function initializeUserMissions(userId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const now = new Date()

  // 0. Ensure Mission Templates Exist (Auto-Seeding)
  // We check if the 'daily_run_1' exists as a proxy for initialization
  const { data: checkTemplate } = await supabase
    .from('missions')
    .select('id')
    .eq('id', 'daily_run_1')
    .single()

  if (!checkTemplate) {
    console.log('[MissionService] Seeding default missions...')
    const { error: seedError } = await supabase
      .from('missions')
      .upsert(DEFAULT_MISSIONS.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        type: m.type,
        target: m.target,
        reward_coins: m.reward_coins,
        reward_experience: m.reward_experience,
        frequency: m.frequency
      })))
    
    if (seedError) {
      console.error('[MissionService] Failed to seed missions:', seedError)
    }
  }

  // 1. Fetch all 'daily', 'weekly', and 'achievement' mission templates
  const { data: templates, error: templatesError } = await supabase
    .from('missions')
    .select('*')
  
  if (templatesError || !templates) {
    console.error('[MissionService] Failed to fetch mission templates:', templatesError)
    return
  }

  // 2. Fetch existing user missions
  const { data: existingMissions, error: userMissionsError } = await supabase
    .from('user_missions')
    .select('mission_id, updated_at, status, progress, claimed_at')
    .eq('user_id', userId)

  if (userMissionsError) {
    console.error('[MissionService] Failed to fetch user missions:', userMissionsError)
    return
  }

  const existingMap = new Map(existingMissions?.map(m => [m.mission_id, m]))
  const missionsToInsert: any[] = []
  
  // 3. Identify missing and stale missions
  for (const template of templates) {
    const existing = existingMap.get(template.id)

    if (!existing) {
      // Missing: Add to insert list
      missionsToInsert.push({
        user_id: userId,
        mission_id: template.id,
        status: 'in-progress', 
        progress: 0,
        updated_at: now.toISOString()
      })
    } else {
      // Exists: Check if reset needed
      // Achievements never reset
      if (template.frequency === 'achievement') continue;

      const lastUpdate = new Date(existing.updated_at)
      let shouldReset = false

      if (template.frequency === 'daily') {
        // Reset if last update was not today (local time or UTC? Using UTC for consistency)
        // Ideally we use user's timezone, but server usually uses UTC.
        // Let's use simple Day check.
        const isSameDay = lastUpdate.getDate() === now.getDate() && 
                          lastUpdate.getMonth() === now.getMonth() && 
                          lastUpdate.getFullYear() === now.getFullYear()
        
        if (!isSameDay) {
          shouldReset = true
        }
      } else if (template.frequency === 'weekly') {
        // Reset if it's a new week. 
        // Simple check: Get Monday of current week and compare.
        const getMonday = (d: Date) => {
          d = new Date(d);
          const day = d.getDay(),
              diff = d.getDate() - day + (day == 0 ? -6 : 1); 
          return new Date(d.setDate(diff));
        }
        
        const currentMonday = getMonday(now)
        const lastUpdateMonday = getMonday(lastUpdate)
        
        // If the Mondays are different, it's a new week
        if (currentMonday.getTime() !== lastUpdateMonday.getTime()) {
           shouldReset = true
        }
      }

      if (shouldReset) {
        // Reset progress and status
        await supabase
          .from('user_missions')
          .update({
            status: 'in-progress',
            progress: 0,
            claimed_at: null,
            updated_at: now.toISOString()
          })
          .eq('user_id', userId)
          .eq('mission_id', template.id)
      }
    }
  }

  // 4. Batch Insert Missing
  if (missionsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('user_missions')
      .insert(missionsToInsert)
    
    if (insertError) {
      console.error('[MissionService] Failed to insert new missions:', insertError)
    }
  }
}
