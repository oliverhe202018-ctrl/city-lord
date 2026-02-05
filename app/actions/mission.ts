'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { getFactionStats } from '@/app/actions/faction'
import { ensureUserProfile } from '@/app/actions/user'

import { initializeUserMissions } from '@/lib/game-logic/mission-service'

export interface Mission {
  id: string
  title: string
  description: string
  type: string
  target: number
  reward_coins: number
  reward_experience: number
  frequency: 'one_time' | 'daily' | 'weekly' | 'achievement'
}

export interface UserMission {
  mission_id: string
  status: 'locked' | 'active' | 'todo' | 'in-progress' | 'ongoing' | 'completed' | 'claimed'
  progress: number
  missions: Mission
}

interface UserMissionResult {
  mission_id: string
  status: 'locked' | 'active' | 'todo' | 'in-progress' | 'ongoing' | 'completed' | 'claimed'
  progress: number
  missions: {
    id: string
    title: string
    description: string
    type: string
    target: number
    reward_coins: number
    reward_experience: number
    frequency: 'one_time' | 'daily' | 'weekly' | 'achievement'
  } | null
}

export async function fetchUserMissions() {
  const startTime = performance.now()
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.log('[MissionAction] No user found, returning empty missions')
    return []
  }

  console.log(`[MissionAction] Starting fetch for user ${user.id.slice(0, 8)}...`)

  // Ensure user missions are assigned/reset if needed (Lazy Load)
  try {
    // Ensure profile exists first to avoid FK violations
    const profileStart = performance.now()
    await ensureUserProfile(user.id)
    console.log(`[MissionAction] ensureUserProfile took ${(performance.now() - profileStart).toFixed(2)}ms`)

    const initStart = performance.now()
    console.log('[MissionAction] Initializing user missions...')
    await initializeUserMissions(user.id)
    console.log(`[MissionAction] initializeUserMissions took ${(performance.now() - initStart).toFixed(2)}ms`)
  } catch (e) {
    console.error('[MissionAction] Failed to initialize missions:', e)
  }

  const fetchStart = performance.now()
  const { data, error } = await supabase
    .from('user_missions')
    .select(`
      mission_id,
      status,
      progress,
      missions (
        id,
        title,
        description,
        type,
        target,
        reward_coins,
        reward_experience,
        frequency
      )
    `)
    .eq('user_id', user.id)

  console.log(`[MissionAction] Supabase fetch took ${(performance.now() - fetchStart).toFixed(2)}ms`)

  if (error) {
    console.error('Error fetching user missions:', error)
    return []
  }
  
  if (!data || data.length === 0) {
    console.log('[MissionAction] No user missions found after initialization.')
  } else {
    console.log(`[MissionAction] Found ${data.length} user missions`)
  }

  const typedData = data as unknown as UserMissionResult[]

  // Helper to filter out valid missions
  const isValidMission = (item: UserMissionResult): boolean => {
    return !!item.missions
  }

  const result = (typedData || []).filter(isValidMission).map((item) => ({
    id: item.missions!.id,
    title: item.missions!.title,
    description: item.missions!.description,
    type: item.missions!.frequency === 'achievement' ? 'achievement' : item.missions!.type,
    frequency: item.missions!.frequency,
    target: item.missions!.target,
    current: item.progress,
    reward: {
      reward_coins: item.missions!.reward_coins,
      reward_experience: item.missions!.reward_experience
    },
    status: item.status
  }))

  const totalDuration = (performance.now() - startTime).toFixed(2)
  console.log(`[MissionAction] Total fetchUserMissions took ${totalDuration}ms`)

  return result
}

export async function claimMissionReward(missionId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Unauthorized' }

  // 1. Validation Logic
  // Fetch mission config first to check type/code
  const { data: config } = await supabase
    .from('mission_configs')
    .select('code, points_reward, frequency')
    .eq('id', missionId)
    .single()

  if (!config) return { success: false, error: '任务不存在' }

  // Custom validation for specific missions
  if (config.code === 'join_club') {
     // Check if user is in a club
     const { data: membership } = await supabase
       .from('club_members')
       .select('id')
       .eq('user_id', user.id)
       .eq('status', 'active')
       .maybeSingle()
     
     if (!membership) {
        return { success: false, error: '未达标：请先加入一个俱乐部' }
     }
  }

  // 2. Insert into user_missions (Claim)
  const resetKey = config.frequency === 'daily' 
    ? new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'
    : 'permanent'

  // Upsert to handle potential race conditions or re-claims if logic allows
  // For 'once', we want to fail if exists. For 'daily', fail if exists for today.
  // We can use a unique constraint on (user_id, mission_id, reset_key) if it existed,
  // but currently user_missions might not have mission_id FK or structure changed.
  // Based on prompt: insert user_id, mission_code, status: 'completed', reset_key
  
  // Note: Schema seems to use 'mission_id' (UUID) linking to 'mission_configs'
  // But prompt says "write mission_code". Let's check schema.
  // Schema types says: user_missions has mission_id (uuid).
  // We will follow schema: mission_id.
  
  // Check if already claimed
  const { data: existing } = await supabase
    .from('user_missions')
    .select('id')
    .eq('user_id', user.id)
    .eq('mission_id', missionId)
    .eq('reset_key', resetKey)
    .eq('status', 'completed')
    .maybeSingle()

  if (existing) {
      return { success: false, error: '今日已领取或任务已完成' }
  }

  const { error: insertError } = await supabase
    .from('user_missions')
    .upsert({
        user_id: user.id,
        mission_id: missionId,
        status: 'completed',
        reset_key: resetKey,
        progress: 1, // Assume 1 means done for simple claims,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, mission_id, reset_key' })

  if (insertError) {
      console.error('Claim insert error:', insertError)
      return { success: false, error: insertError.message }
  }

  // 3. Grant Rewards (Points/Coins)
  // Assuming points_reward maps to coins for now
  if (config.points_reward > 0) {
      await supabase.rpc('increment_user_stats', {
          p_user_id: user.id,
          p_xp: 0,
          p_coins: config.points_reward
      })
  }

  // Invalidate cache immediately
  invalidateMissionCache(user.id)

  // 4. Return success with bonus info (Mock bonus for now or implement real logic)
  // Re-using the faction bonus logic structure if needed, or simplified
  let bonusDetails = { xp: 0, coins: 0, percentage: 0 };
  
  // --- FACTION BONUS LOGIC (Simplified from original) ---
  try {
    const { data: profile } = await supabase.from('profiles').select('faction').eq('id', user.id).single();
    const userFaction = profile?.faction;

    if (userFaction) {
      const factionStats = await getFactionStats();
      const bonusPercent = userFaction === 'RED' ? factionStats.bonus.RED : factionStats.bonus.BLUE;

      if (bonusPercent > 0) {
        const extraCoins = Math.floor(config.points_reward * (bonusPercent / 100));
        if (extraCoins > 0) {
           await supabase.rpc('increment_user_stats', {
             p_user_id: user.id,
             p_xp: 0,
             p_coins: extraCoins
           });
           bonusDetails = { xp: 0, coins: extraCoins, percentage: bonusPercent };
        }
      }
    }
  } catch (e) { /* Ignore bonus error */ }

  return {
      success: true,
      data: {
          reward_coins: config.points_reward,
          new_coins: config.points_reward + bonusDetails.coins, // Approximation
          bonus: bonusDetails.percentage > 0 ? bonusDetails : null
      }
  }
}

export async function claimAllMissionsRewards(missionIds: string[]) {
  // Parallel execution might be faster but could hit rate limits or race conditions on profile updates.
  // Sequential is safer for profile updates (read-modify-write pattern in claimMissionReward).
  let successCount = 0;
  let failures = [];

  for (const id of missionIds) {
    const result = await claimMissionReward(id);
    if (result.success) {
      successCount++;
    } else {
      failures.push({ id, error: result.error });
    }
  }

  return {
    success: true,
    claimedCount: successCount,
    failures
  };
}
