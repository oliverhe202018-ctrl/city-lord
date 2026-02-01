'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

import { calculateLevel } from '@/lib/game-logic/level-system'

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
  status: 'todo' | 'ongoing' | 'in-progress' | 'completed' | 'claimed'
  progress: number
  missions: Mission
}

export async function fetchUserMissions() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

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

  if (error) {
    console.error('Error fetching user missions:', error)
    return []
  }

  interface UserMissionResult {
    mission_id: string
    status: 'todo' | 'ongoing' | 'in-progress' | 'completed' | 'claimed'
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

  const typedData = data as unknown as UserMissionResult[]

  // Helper to filter out valid missions
  const isValidMission = (item: UserMissionResult): boolean => {
    return !!item.missions
  }

  return (typedData || []).filter(isValidMission).map((item) => ({
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
}

export async function claimMissionReward(missionId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Unauthorized' }

  // 1. Check if mission is completed but not claimed
  const { data: userMission, error: fetchError } = await supabase
    .from('user_missions')
    .select('status, missions(reward_coins, reward_experience)')
    .eq('user_id', user.id)
    .eq('mission_id', missionId)
    .single()

  if (fetchError || !userMission) {
    return { success: false, error: 'Mission not found' }
  }

  if (userMission.status !== 'completed') {
    return { success: false, error: 'Mission not ready to claim' }
  }

  // 2. Update status to claimed
  const { error: updateError } = await supabase
    .from('user_missions')
    .update({ status: 'claimed', claimed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('mission_id', missionId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 3. Award rewards to user profile
  // Note: Ideally this should be a transaction or an RPC to ensure atomicity.
  // For now, we do it sequentially. If this fails, the user might lose rewards but mission is claimed.
  // A better approach: create an RPC 'claim_mission(user_id, mission_id)'
  
  // @ts-ignore - missions is an object due to single join, but types might be array/null
  const missionData = userMission.missions as any
  const { reward_coins, reward_experience } = missionData

  if ((reward_coins && reward_coins > 0) || (reward_experience && reward_experience > 0)) {
    // Fetch current profile first to increment (or use RPC if available)
    // We'll use the rpc 'increment_user_stats' if we had one, or just update.
    // Let's use a simple update for now, but handle the read-modify-write.
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('coins, current_exp, level')
      .eq('id', user.id)
      .single()
      
    if (profile) {
      const newCoins = (profile.coins || 0) + (reward_coins || 0)
      const newExp = (profile.current_exp || 0) + (reward_experience || 0)
      
      const newLevel = calculateLevel(newExp)
      
      const updates: { coins: number; current_exp: number; updated_at: string; level?: number } = { 
        coins: newCoins,
        current_exp: newExp,
        updated_at: new Date().toISOString()
      }
      
      if (newLevel > (profile.level || 1)) {
        updates.level = newLevel
      }

      await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
    }
  }

  return { success: true }
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
