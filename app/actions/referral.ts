// 'use server'

import { createClient } from '@/mock-supabase'
import { cookies } from '@/mock-headers'

export type InvitedUser = {
  id: string
  nickname: string
  avatar_url: string | null
  joined_at: string
}

export type ReferralData = {
  referralCode: string
  invitedCount: number
  invitedUsers: InvitedUser[]
  milestoneProgress: number
  milestoneTarget: number
}

export async function getReferralData(): Promise<{ success: boolean; data?: ReferralData; error?: string }> {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: '未登录' }

    // 1. Get current user's referral code
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return { success: false, error: '无法获取推广码' }
    }

    // 2. Get invited users
    const { data: invitees, error: inviteesError } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url, created_at')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false })

    if (inviteesError) {
      console.error('Error fetching invitees:', inviteesError)
      return { success: false, error: '获取邀请列表失败' }
    }

    const invitedUsers: InvitedUser[] = invitees.map((p: any) => ({
      id: p.id,
      nickname: p.nickname || 'Unknown',
      avatar_url: p.avatar_url,
      joined_at: p.created_at
    }))

    const invitedCount = invitedUsers.length
    
    // Simple logic for milestone: Next target is next multiple of 3
    const milestoneTarget = Math.ceil((invitedCount + 1) / 3) * 3

    return {
      success: true,
      data: {
        referralCode: profile.referral_code,
        invitedCount,
        invitedUsers,
        milestoneProgress: invitedCount,
        milestoneTarget
      }
    }

  } catch (error: any) {
    console.error('getReferralData exception:', error)
    return { success: false, error: error.message }
  }
}

export async function getReferrerProfile(referralCode: string) {
  // Fetch referrer profile by code
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('referral_code', referralCode)
      .single()

    if (error || !profile) return null

    return {
      nickname: profile.nickname,
      avatar_url: profile.avatar_url
    }
  } catch (error) {
    console.error('getReferrerProfile error:', error)
    return null
  }
}
