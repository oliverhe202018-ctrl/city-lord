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

  // Invalidate cache immediately
  invalidateMissionCache(user.id)

  try {
    // Use RPC for atomic claiming
    const { data: rpcResult, error } = await supabase.rpc('claim_mission_reward_rpc', {
      p_user_id: user.id,
      p_mission_id: missionId
    } as any)

    if (error) {
      console.error('Error claiming mission:', error)
      return { success: false, error: error.message }
    }

    const resultData = rpcResult as any;
  let bonusApplied = false;
  let bonusDetails = { xp: 0, coins: 0, percentage: 0 };

  // --- FACTION BONUS LOGIC ---
  try {
    // 1. Get user's faction
    const { data: profile } = await supabase.from('profiles').select('faction').eq('id', user.id).single();
    const userFaction = profile?.faction;

    if (userFaction) {
      // 2. Get Faction Stats & Bonus
      const factionStats = await getFactionStats();
      const bonusPercent = userFaction === 'RED' ? factionStats.bonus.RED : factionStats.bonus.BLUE;

      if (bonusPercent > 0) {
        // 3. Calculate Extra Rewards based on Base Rewards
        const baseXp = resultData.reward_experience || 0;
        const baseCoins = resultData.reward_coins || 0;

        const extraXp = Math.floor(baseXp * (bonusPercent / 100));
        const extraCoins = Math.floor(baseCoins * (bonusPercent / 100));

        if (extraXp > 0 || extraCoins > 0) {
          // 4. Grant Extra Rewards
          await supabase.rpc('increment_user_stats', {
            p_user_id: user.id,
            p_xp: extraXp,
            p_coins: extraCoins
          });

          bonusApplied = true;
          bonusDetails = {
            xp: extraXp,
            coins: extraCoins,
            percentage: bonusPercent
          };
          
          // Update return data to reflect totals
          resultData.new_experience += extraXp;
          resultData.new_coins += extraCoins;
        }
      }
    }
  } catch (e) {
    console.error('Error applying faction bonus:', e);
    // Do not fail the claim if bonus fails
  }

  // The RPC returns a JSON object on success
  return { 
    success: true, 
    data: {
      ...resultData,
      bonus: bonusApplied ? bonusDetails : undefined
    } 
  }
  } catch (error: any) {
    console.error('Unexpected error in claimMissionReward:', error)
    return { success: false, error: error.message || 'Unknown error' }
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
