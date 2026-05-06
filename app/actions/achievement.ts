'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export interface UserAchievementProgress {
  achievementId: string
  progress: number
  isCompleted: boolean
  completedAt?: string
  name: string
  description: string
  type: string
  tier: string
  condition: {
    type: string
    threshold: number
  }
  rewards: {
    badge?: string | null
    experience: number
    points: number
  }
}

export async function fetchUserAchievements(): Promise<UserAchievementProgress[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      achievement_id, 
      progress, 
      is_completed, 
      completed_at,
      achievement:achievements (
        id,
        name,
        description,
        type,
        tier,
        condition_type,
        condition_threshold,
        reward_badge,
        reward_exp,
        reward_points
      )
    `)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error fetching user achievements:', error)
    return []
  }

  interface AchievementResult {
    achievement_id: string
    progress: number
    is_completed: boolean
    completed_at: string | null
    achievement: {
      id: string
      name: string
      description: string
      type: string
      tier: string
      condition_type: string
      condition_threshold: number
      reward_badge: string | null
      reward_exp: number
      reward_points: number
    } | null
  }

  const typedData = data as unknown as AchievementResult[]

  // Helper to ensure achievement data is present
  const isValidAchievement = (item: AchievementResult): boolean => {
    return !!item.achievement
  }

  return (typedData || []).filter(isValidAchievement).map((item) => ({
    achievementId: item.achievement_id,
    progress: item.progress,
    isCompleted: item.is_completed,
    completedAt: item.completed_at || undefined,
    // Add joined data (safely accessed because of filter)
    name: item.achievement!.name,
    description: item.achievement!.description,
    type: item.achievement!.type,
    tier: item.achievement!.tier,
    condition: {
      type: item.achievement!.condition_type,
      threshold: item.achievement!.condition_threshold
    },
    rewards: {
      badge: item.achievement!.reward_badge,
      experience: item.achievement!.reward_exp,
      points: item.achievement!.reward_points
    }
  }))
}

// ──────────────────────────────────────────────
// Add achievement to a user (system/admin use)
// ──────────────────────────────────────────────
export async function addUserAchievement(
  userId: string,
  name: string,
  description: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Check if achievement definition exists by name
  const { data: achievement } = await supabase
    .from('badges')
    .select('id, code')
    .eq('name', name)
    .single()

  if (!achievement) {
    // Create notification for custom achievement (no matching badge definition)
    await prisma.notifications.create({
      data: {
        user_id: userId,
        title: '🏆 成就解锁！',
        body: `恭喜解锁成就【${name}】：${description}`,
        type: 'badge',
        is_read: false,
      },
    })
    return { success: true }
  }

  // Check if already earned
  const { data: existing } = await supabase
    .from('user_badges')
    .select('id')
    .eq('user_id', userId)
    .eq('badge_id', achievement.id)
    .single()

  if (existing) {
    return { success: true } // Already earned
  }

  // Award badge
  const { error } = await supabase.from('user_badges').insert({
    user_id: userId,
    badge_id: achievement.id,
    earned_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Failed to add achievement:', error)
    return { success: false, error: error.message }
  }

  // Create notification
  await prisma.notifications.create({
    data: {
      user_id: userId,
      title: '🏆 成就解锁！',
      body: `恭喜解锁成就【${name}】：${description}`,
      type: 'badge',
      is_read: false,
    },
  })

  return { success: true }
}

// ──────────────────────────────────────────────
// Get user achievement summary (counts + latest)
// ──────────────────────────────────────────────
export interface AchievementSummary {
  totalBadges: number
  earnedBadges: number
  latestBadge?: {
    name: string
    earnedAt: string
  }
}

export async function getUserAchievementSummary(
  userId: string
): Promise<AchievementSummary> {
  const supabase = await createClient()

  const [totalResult, earnedResult, latestResult] = await Promise.all([
    supabase.from('badges').select('id', { count: 'exact', head: true }),
    supabase
      .from('user_badges')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('user_badges')
      .select('earned_at, badges(name)')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const latest = latestResult.data as unknown as {
    earned_at: string
    badges: { name: string } | null
  } | null

  return {
    totalBadges: totalResult.count || 0,
    earnedBadges: earnedResult.count || 0,
    latestBadge: latest?.badges
      ? {
        name: latest.badges.name,
        earnedAt: latest.earned_at,
      }
      : undefined,
  }
}
