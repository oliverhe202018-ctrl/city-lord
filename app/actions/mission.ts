'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { getFactionStats } from '@/app/actions/faction'

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
  status: 'todo' | 'ongoing' | 'in-progress' | 'completed' | 'claimed'
  progress: number
  missions: Mission
}

export async function fetchUserMissions() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  // Ensure user missions are assigned/reset if needed (Lazy Load)
  try {
    console.log('[MissionAction] Initializing user missions for', user.id)
    await initializeUserMissions(user.id)
  } catch (e) {
    console.error('[MissionAction] Failed to initialize missions:', e)
  }

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
