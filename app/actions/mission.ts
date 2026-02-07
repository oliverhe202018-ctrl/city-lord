'use server'

import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
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
    return []
  }

  // Filter out invalid joins (where mission might have been deleted)
  // And map to clean structure
  const missions = (data as unknown as UserMissionResult[])
    .filter(item => item.missions !== null)
    .map(item => ({
      mission_id: item.mission_id,
      status: item.status,
      progress: item.progress,
      missions: item.missions!
    })) as UserMission[]

  console.log(`[MissionAction] Total execution took ${(performance.now() - startTime).toFixed(2)}ms`)
  return missions
}

export async function claimMissionReward(missionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  // 1. Verify mission is completed but not claimed
  const { data: userMission, error: fetchError } = await supabase
    .from('user_missions')
    .select('status, missions (reward_coins, reward_experience)')
    .eq('user_id', user.id)
    .eq('mission_id', missionId)
    .single()

  if (fetchError || !userMission) {
    return { success: false, error: 'Mission not found' }
  }

  if (userMission.status !== 'completed') {
    return { success: false, error: 'Mission not completed or already claimed' }
  }

  const reward = (userMission.missions as any) || { reward_coins: 0, reward_experience: 0 }

  // 2. Transaction (Update status + Give rewards)
  // Supabase doesn't support transactions in client lib easily, so we do sequential updates
  // Ideally this should be an RPC or RLS protected flow
  
  // A. Update status to claimed
  const { error: updateError } = await supabase
    .from('user_missions')
    .update({ status: 'claimed', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('mission_id', missionId)

  if (updateError) {
    return { success: false, error: 'Failed to claim reward' }
  }

  // B. Give Rewards
  const { error: profileError } = await supabase.rpc('increment_user_stats', {
    p_user_id: user.id,
    p_coins: reward.reward_coins,
    p_exp: reward.reward_experience
  })

  // If RPC fails (e.g. function missing), fallback to manual update
  if (profileError) {
      console.warn('RPC increment_user_stats failed, falling back to manual update', profileError)
      // Fetch current profile
      const { data: profile } = await supabase.from('profiles').select('coins, current_exp').eq('id', user.id).single()
      if (profile) {
          await supabase.from('profiles').update({
              coins: (profile.coins || 0) + reward.reward_coins,
              current_exp: (profile.current_exp || 0) + reward.reward_experience
          }).eq('id', user.id)
      }
  }

  return { 
    success: true, 
    rewards: { 
      coins: reward.reward_coins, 
      experience: reward.reward_experience 
    } 
  }
}
