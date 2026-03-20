'use server'

import { createClient } from '@/lib/supabase/server'
import { getFactionStats } from '@/app/actions/faction'
import { ensureUserProfile } from '@/app/actions/user'

import { initializeUserMissions } from '@/lib/game-logic/mission-service'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { grantRewards } from '@/lib/game-logic/reward-service'
import { eventBus } from '@/lib/game-logic/event-bus'
import { MissionTemplateSchema } from '@/lib/validations/mission'
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

  // 1. Prisma Serializable Transaction to lock and update mission status
  let rewardExp = 0
  let rewardCoins = 0
  let missionTitle = ''

  try {
    await prisma.$transaction(
      async (tx) => {
        const um = await tx.user_missions.findUnique({
          where: { user_id_mission_id: { user_id: user.id, mission_id: missionId } },
          include: { missions: true }
        })

        if (!um) throw new Error('Mission not found')
        if (um.status === 'claimed') throw new Error('Mission already claimed')
        if (um.status !== 'completed') throw new Error('Mission not completed')

        const parseResult = MissionTemplateSchema.safeParse(um.missions);
        if (!parseResult.success) {
          console.error('[claimMissionReward] Invalid mission config:', parseResult.error.flatten());
          throw new Error('任务配置数据异常，无法领取奖励');
        }
        const mission = parseResult.data;

        rewardExp = mission.reward_experience || 0
        rewardCoins = mission.reward_coins || 0
        missionTitle = mission.title || ''

        await tx.user_missions.update({
          where: { id: um.id },
          data: {
            status: 'claimed',
            claimed_at: new Date(),
            updated_at: new Date()
          }
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to claim mission' }
  }

  // 1.5 Calculate Faction Bonus (Using Prisma)
  let finalCoins = rewardCoins
  let finalExp = rewardExp
  let appliedBonusPercentage = 0

  try {
    const profile = await prisma.profiles.findUnique({
      where: { id: user.id },
      select: { faction: true }
    })
    if (profile?.faction && profile.faction !== 'Neutral' && profile.faction !== 'Unknown') {
      const stats = await getFactionStats()
      const factionKey = profile.faction.toUpperCase() as 'RED' | 'BLUE'
      const bonusPercentage = stats.bonus?.[factionKey] || 0

      if (bonusPercentage > 0) {
        appliedBonusPercentage = bonusPercentage
        const multiplier = 1 + (bonusPercentage / 100)
        finalCoins = Math.round(finalCoins * multiplier)
        finalExp = Math.round(finalExp * multiplier)
      }
    }
  } catch (e) {
    console.warn('Failed to calculate faction bonus for mission claim:', e)
  }

  // 2. Grant Rewards via unified service
  const rewardResult = await grantRewards(
    user.id,
    { exp: finalExp, coins: finalCoins },
    'mission_claim',
    missionId
  )

  // 3. Emit Event for Phase 1 Listeners
  try {
    await eventBus.emit({
      type: 'MISSION_CLAIMED',
      userId: user.id,
      missionId: missionId,
      missionCode: missionId,
      rewards: { exp: finalExp, coins: finalCoins }
    })
  } catch (err) {
    console.error('[claimMissionReward] MISSION_CLAIMED emit failed:', err)
  }

  return {
    success: true,
    rewards: {
      coins: finalCoins,
      experience: finalExp
    },
    bonus: appliedBonusPercentage > 0 ? { percentage: appliedBonusPercentage } : null
  }
}
