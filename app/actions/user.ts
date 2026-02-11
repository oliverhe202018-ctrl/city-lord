'use server'

import { createClient } from '@/lib/supabase/server'
import { checkAndRewardMissions, RunContext } from '@/lib/game-logic/mission-checker'
import { initializeUserMissions } from '@/lib/game-logic/mission-service'
import { cache } from 'react'
import { calculateLevel } from '@/lib/game-logic/level-system'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

import { checkAndAwardBadges } from '@/app/actions/check-achievements'

export async function stopRunningAction(context: RunContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  // Ensure dates are proper Date objects
  context.startTime = new Date(context.startTime)
  context.endTime = new Date(context.endTime)

  // Ensure daily missions are valid before processing run
  await initializeUserMissions(user.id)

  // Anti-Cheat: Verify Hex Ownership if needed
  if (context.capturedHexIds && context.capturedHexIds.length > 0) {
    const uniqueIds = Array.from(new Set(context.capturedHexIds))
    const count = await prisma.territories.count({
      where: {
        owner_id: user.id,
        id: { in: uniqueIds },
        captured_at: {
          gte: new Date(new Date(context.startTime).getTime() - 60000)
        }
      }
    })
    context.newHexCount = count || 0
  }

  // --- Transactional Submission ---
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mission Progress Updates
      // Fetch active missions
      const userMissions = await tx.user_missions.findMany({
        where: {
          user_id: user.id,
          status: { notIn: ['completed', 'claimed'] }
        },
        include: {
          missions: true
        }
      })

      const completedMissionIds: string[] = []
      
      // Calculate derived stats
      const durationMinutes = (context.endTime.getTime() - context.startTime.getTime()) / 1000 / 60
      const pace = context.distance > 0 ? durationMinutes / context.distance : 999
      const distanceMeters = context.distance * 1000

      // Pre-fetch hex count for HEX_TOTAL check if needed
      let totalHexCount = -1;

      for (const um of userMissions) {
        const mission = um.missions
        if (!mission) continue

        let isCompleted = false
        let newProgress = um.progress || 0

        // Logic mirrors checkAndRewardMissions
        if (mission.type === 'DISTANCE' || mission.type === 'DISTANCE_DAILY') {
          newProgress += distanceMeters
        } else if (mission.type === 'RUN_COUNT') {
          newProgress += 1
        } else if (mission.type === 'ACTIVE_DAYS') {
          const lastUpdate = um.updated_at ? new Date(um.updated_at) : new Date(0)
          const now = new Date()
          const isSameDay = lastUpdate.getDate() === now.getDate() && 
                            lastUpdate.getMonth() === now.getMonth() && 
                            lastUpdate.getFullYear() === now.getFullYear()
          
          if (newProgress === 0 || !isSameDay) {
            newProgress += 1
          }
        } else if (mission.type === 'HEX_COUNT') {
          newProgress += context.capturedHexes
        } else if (mission.type === 'UNIQUE_HEX') {
          newProgress += (context.newHexCount || 0)
        } else if (mission.type === 'HEX_TOTAL') {
          if (totalHexCount === -1) {
             totalHexCount = await tx.territories.count({ where: { owner_id: user.id } })
          }
          newProgress = totalHexCount
        } else if (mission.type === 'SPEED_BURST') {
          if (context.distance > 0.1 && pace <= (mission.target || 0)) {
            isCompleted = true
            newProgress = mission.target || 0
          }
        } else if (mission.type === 'NIGHT_RUN') {
          const hour = context.endTime.getHours()
          if (hour >= 22 || hour < 4) {
             newProgress += 1
          }
        }

        // Check completion
        if (mission.target && newProgress >= mission.target) {
          isCompleted = true
          newProgress = mission.target
        }

        if (newProgress !== um.progress || isCompleted) {
           await tx.user_missions.update({
             where: { id: um.id },
             data: {
               progress: newProgress,
               status: isCompleted ? 'completed' : um.status,
               updated_at: new Date()
             }
           })
           if (isCompleted) completedMissionIds.push(mission.id)
        }
      }

      // 2. Update User Profile (Distance & Area)
      const userProfile = await tx.profiles.findUnique({ where: { id: user.id } })
      let userProvince = userProfile?.province || ''

      if (userProfile && context.distance > 0) {
        const currentDistance = userProfile.total_distance_km || 0
        const capturedArea = (context.newHexCount || 0) * 0.00065 // 650m2 in km2
        const currentArea = Number(userProfile.total_area || 0)

        await tx.profiles.update({
          where: { id: user.id },
          data: {
            total_distance_km: currentDistance + context.distance,
            total_area: currentArea + capturedArea,
            updated_at: new Date()
          }
        })

        // 3. Create Run Record
        if (userProfile.club_id) {
           // Update Club Area
           const club = await tx.clubs.findUnique({ where: { id: userProfile.club_id } })
           if (club) {
             const newTotal = Number(club.total_area || 0) + capturedArea
             await tx.clubs.update({
               where: { id: userProfile.club_id },
               data: { total_area: newTotal }
             })
           }

           // Insert Run
           await tx.runs.create({
             data: {
               user_id: user.id,
               club_id: userProfile.club_id,
               area: Number(capturedArea.toFixed(4)),
               duration: Math.floor(context.duration * 60),
               province: userProvince || context.regionId,
               created_at: new Date()
             }
           })
        } else {
           // Insert Run (No Club)
           await tx.runs.create({
            data: {
              user_id: user.id,
              area: Number(((context.newHexCount || 0) * 0.00065).toFixed(4)),
              duration: Math.floor(context.duration * 60),
              province: userProvince || context.regionId,
              created_at: new Date()
            }
          })
        }
      }

      return { completedMissionIds }
    })
    
    // Check Badges after transaction
    const newBadges = await checkAndAwardBadges(user.id, 'RUN_FINISHED', {
        distance: context.distance * 1000,
        endTime: context.endTime,
        pace: context.distance > 0 ? ((context.endTime.getTime() - context.startTime.getTime()) / 1000 / 60) / context.distance : 0 // min/km
    })

    return { 
      success: true, 
      completedMissionIds: result.completedMissionIds,
      newBadges: newBadges
    }

  } catch (err: any) {
    console.error("Transaction failed:", err)
    return { success: false, error: err.message || 'Transaction failed' }
  }
}

export async function getUserProfileStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      totalTiles: 0,
      totalArea: 0,
      totalDistance: 0,
      battlesWon: 0,
      level: 1,
      xp: 0,
      coins: 0
    }
  }

  // Get Profile Data
  const { data: profileData } = await supabase
    .from('profiles')
    .select('level, current_exp, total_distance_km, coins, faction')
    .eq('id', user.id)
    .single()
    
  const profile = profileData as any;

  // Get User City Progress for Area/Tiles
  const { data: progressData } = await supabase
    .from('user_city_progress')
    .select('tiles_captured, area_controlled')
    .eq('user_id', user.id)
    
  const progress = progressData as any;

  let totalTiles = 0
  let totalArea = 0
  
  if (progress) {
    (progress as any[]).forEach((p: any) => {
      totalTiles += (p.tiles_captured || 0)
      totalArea += Number(p.area_controlled || 0)
    })
  }

  return {
    totalTiles,
    totalArea,
    totalDistance: profile?.total_distance_km || 0,
    battlesWon: 0, // Future: fetch from battle logs
    level: profile?.level || 1,
    xp: profile?.current_exp || 0,
    coins: profile?.coins || 0,
    faction: profile?.faction || null
  }
}

export async function touchUserActivity() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return

  await (supabase
    .from('profiles') as any)
    .update({ updated_at: new Date().toISOString() })
    .eq('id', user.id)
}

export const ensureUserProfile = cache(async (userId: string) => {
  const supabase = await createClient()

  // 🚀 Fast Path: Check ID existence only (<50ms)
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  // If profile exists, return immediately (Read-only path)
  if (data && !error) {
    return { success: true, isExisting: true }
  }

  // 🐢 Slow Path: Create new profile (Only for new users)
  console.log('[UserProfile] Creating new profile for:', userId)
  
  // We assume the user is authenticated in auth.users
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || user.id !== userId) {
      return { success: false, error: 'Unauthorized or ID mismatch' }
  }

  // Insert default profile
  const { error: insertError } = await (supabase
    .from('profiles') as any)
    .upsert({
      id: userId,
      nickname: user.email?.split('@')[0] || `Runner_${userId.slice(0, 6)}`,
      avatar_url: '',
      level: 1,
      current_exp: 0,
      max_exp: 100,
      stamina: 100,
      max_stamina: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (insertError) {
    console.error('Failed to create profile:', insertError)
    return { success: false, error: insertError.message }
  }

  return { success: true, isNew: true }
})

export async function addExperience(amount: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('level, current_exp')
    .eq('id', user.id)
    .single()

  if (!profile) return { success: false, error: 'Profile not found' }

  const newExp = ((profile as any).current_exp || 0) + amount
  const newLevel = calculateLevel(newExp)
  
  const updates: { current_exp: number; updated_at: string; level?: number } = {
    current_exp: newExp,
    updated_at: new Date().toISOString()
  }

  if (newLevel > ((profile as any).level || 1)) {
    updates.level = newLevel
    // Here we could also trigger level up notification or rewards
  }

  const { error } = await (supabase
    .from('profiles') as any)
    .update(updates)
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  return { 
    success: true, 
    newLevel, 
    levelUp: newLevel > ((profile as any).level || 1),
    newExp 
  }
}

export async function addCoins(amount: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('coins')
    .eq('id', user.id)
    .single()

  if (!profile) return { success: false, error: 'Profile not found' }

  const newCoins = ((profile as any).coins || 0) + amount

  const { error } = await (supabase
    .from('profiles') as any)
    .update({
      coins: newCoins,
      updated_at: new Date().toISOString()
    } as any)
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  return { success: true, newCoins }
}
