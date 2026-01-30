'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'

type Challenge = Database['public']['Tables']['challenges']['Row']

export async function createChallenge(data: {
  type: 'race' | 'territory' | 'distance'
  targetId: string
  distance?: number
  duration?: string
  rewardXp: number
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: challenge, error } = await (supabase
    .from('challenges' as any) as any)
    .insert({
      type: data.type,
      creator_id: user.id,
      target_id: data.targetId,
      distance: data.distance,
      duration: data.duration,
      reward_xp: data.rewardXp,
      status: 'pending'
    })
    .select()
    .single()

  if (error) throw error
  return challenge
}

export async function getPendingChallenges() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: challenges, error } = await supabase
    .from('challenges')
    .select(`
      *,
      creator:profiles!creator_id(nickname, level, avatar_url)
    `)
    .eq('target_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching challenges:', error)
    return []
  }
  
  return challenges
}

export async function respondToChallenge(challengeId: string, accept: boolean) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const status = accept ? 'accepted' : 'declined'
  
  const { error } = await (supabase
    .from('challenges' as any) as any)
    .update({ status })
    .eq('id', challengeId)

  if (error) throw error
  return { success: true }
}
