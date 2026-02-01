'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

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
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
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
