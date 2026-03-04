'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export type InvitedUser = {
  id: string
  nickname: string
  avatar_url: string | null
  joined_at: string
}

export type RoomInfo = {
  id: string
  name: string
}

export type ReferralData = {
  referralCode: string
  invitedCount: number
  invitedUsers: InvitedUser[]
  milestoneProgress: number
  milestoneTarget: number
  milestoneRewardLabel: string
  rooms: RoomInfo[]
}

export async function getReferralData(): Promise<{ success: boolean; data?: ReferralData; error?: string }> {
  try {
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: '未登录' }

    // 1. Get current user's profile and referral code
    const profile = await prisma.profiles.findUnique({
      where: { id: user.id },
      select: { referral_code: true }
    })

    if (!profile) {
      return { success: false, error: '无法获取用户主页数据' }
    }

    let referralCode = profile.referral_code
    if (!referralCode) {
      // Auto generate a robust code locally and update profile if missing
      referralCode = user.id.slice(0, 8).toUpperCase()
      await prisma.profiles.update({
        where: { id: user.id },
        data: { referral_code: referralCode }
      })
    }

    // 2. Get invited users
    const invitees = await prisma.profiles.findMany({
      where: { referrer_id: user.id },
      orderBy: { created_at: 'desc' },
      select: { id: true, nickname: true, avatar_url: true, created_at: true }
    })

    const invitedUsers: InvitedUser[] = invitees.map(p => ({
      id: p.id,
      nickname: p.nickname || 'Unknown',
      avatar_url: p.avatar_url,
      joined_at: p.created_at.toISOString()
    }))

    const invitedCount = invitedUsers.length

    // 3. Get user's hosted rooms
    const hostedRooms = await prisma.rooms.findMany({
      where: { host_id: user.id, status: { not: 'closed' } },
      select: { id: true, name: true }
    })

    const rooms: RoomInfo[] = hostedRooms.map(r => ({ id: r.id, name: r.name }))

    // Simple logic for milestone
    const milestoneTarget = Math.ceil((invitedCount + 1) / 3) * 3
    const milestoneRewardLabel = `获得 ${milestoneTarget * 100} 绿宝石`

    return {
      success: true,
      data: {
        referralCode,
        invitedCount,
        invitedUsers,
        milestoneProgress: invitedCount,
        milestoneTarget,
        milestoneRewardLabel,
        rooms
      }
    }

  } catch (error: any) {
    console.error('getReferralData exception:', error)
    return { success: false, error: error.message }
  }
}

export async function getReferrerProfile(referralCode: string) {
  try {
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)

    const profile = await prisma.profiles.findUnique({
      where: { referral_code: referralCode },
      select: { nickname: true, avatar_url: true }
    })

    if (!profile) return null

    return {
      nickname: profile.nickname,
      avatar_url: profile.avatar_url
    }
  } catch (error) {
    console.error('getReferrerProfile error:', error)
    return null
  }
}
