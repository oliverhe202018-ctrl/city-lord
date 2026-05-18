import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export interface AdminUserDetail {
  id: string
  nickname: string | null
  avatar_url: string | null
  level: number | null
  stamina: number | null
  max_stamina: number | null
  coins: number | null
  total_area: number | null
  created_at: string
  is_active: boolean
  banned_until: string | null
  banned_reason: string | null
  last_login_at: string | null
  faction: string | null
}

export interface AdminUserDetailResponse {
  success: boolean
  data?: AdminUserDetail
  error?: string
}

export async function getAdminUserDetail(
  userId: string
): Promise<AdminUserDetailResponse> {
  try {
    const profile = await prisma.profiles.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      return { success: false, error: '用户不存在' }
    }

    return {
      success: true,
      data: profile as unknown as AdminUserDetail,
    }
  } catch (err: any) {
    console.error('[getAdminUserDetail] Error:', err)
    return {
      success: false,
      error: err?.message || '获取用户详情失败',
    }
  }
}

export interface UpdateUserProfileResponse {
  success: boolean
  error?: string
}

export async function updateUserProfile(
  userId: string,
  updates: {
    nickname?: string
    faction?: string
  }
): Promise<UpdateUserProfileResponse> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.profiles.update({
        where: { id: userId },
        data: updates,
      })

      await tx.admin_logs.create({
        data: {
          action: 'update_user_profile',
          details: JSON.stringify({
            userId,
            updates,
          }),
        },
      })
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (err: any) {
    console.error('[updateUserProfile] Error:', err)
    return {
      success: false,
      error: err?.message || '更新用户信息失败',
    }
  }
}

export interface BanUserResponse {
  success: boolean
  error?: string
}

export async function banUser(
  userId: string,
  reason: string,
  durationHours: number
): Promise<BanUserResponse> {
  try {
    const bannedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000)

    await prisma.$transaction(async (tx) => {
      await tx.profiles.update({
        where: { id: userId },
        data: {
          is_active: false,
          banned_until: bannedUntil,
          banned_reason: reason,
        },
      })

      await tx.admin_logs.create({
        data: {
          action: 'ban_user',
          details: JSON.stringify({
            userId,
            reason,
            durationHours,
            bannedUntil: bannedUntil.toISOString(),
          }),
        },
      })
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (err: any) {
    console.error('[banUser] Error:', err)
    return {
      success: false,
      error: err?.message || '封禁用户失败',
    }
  }
}

export interface UnbanUserResponse {
  success: boolean
  error?: string
}

export async function unbanUser(
  userId: string
): Promise<UnbanUserResponse> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.profiles.update({
        where: { id: userId },
        data: {
          is_active: true,
          banned_until: null,
          banned_reason: null,
        },
      })

      await tx.admin_logs.create({
        data: {
          action: 'unban_user',
          details: JSON.stringify({
            userId,
          }),
        },
      })
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (err: any) {
    console.error('[unbanUser] Error:', err)
    return {
      success: false,
      error: err?.message || '解封用户失败',
    }
  }
}

export interface AdjustUserResourcesResponse {
  success: boolean
  error?: string
}

export async function adjustUserResources(
  userId: string,
  adjustments: {
    coins?: number
    stamina?: number
    level?: number
  }
): Promise<AdjustUserResourcesResponse> {
  try {
    await prisma.$transaction(async (tx) => {
      const currentUser = await tx.profiles.findUnique({
        where: { id: userId },
      })

      if (!currentUser) {
        throw new Error('用户不存在')
      }

      const updateData: any = {}
      
      if (adjustments.coins !== undefined) {
        updateData.coins = Math.max(0, (currentUser.coins || 0) + adjustments.coins)
      }
      
      if (adjustments.stamina !== undefined) {
        updateData.stamina = Math.max(0, Math.min(
          currentUser.max_stamina || 100,
          (currentUser.stamina || 0) + adjustments.stamina
        ))
      }
      
      if (adjustments.level !== undefined) {
        updateData.level = Math.max(1, adjustments.level)
      }

      await tx.profiles.update({
        where: { id: userId },
        data: updateData,
      })

      await tx.admin_logs.create({
        data: {
          action: 'adjust_user_resources',
          details: JSON.stringify({
            userId,
            adjustments,
          }),
        },
      })
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (err: any) {
    console.error('[adjustUserResources] Error:', err)
    return {
      success: false,
      error: err?.message || '调整用户资源失败',
    }
  }
}
