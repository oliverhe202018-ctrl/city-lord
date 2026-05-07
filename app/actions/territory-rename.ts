'use server'

import { prisma } from '@/lib/prisma'
import { MintFilter } from 'mint-filter'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const filter = new MintFilter(['敏感词', '违规', '垃圾', '广告', '政治', '色情', '暴力', '赌博'])

const NAME_MAX_LENGTH = 10
const COOLDOWN_DAYS = 7

export async function renameTerritory(territoryId: string, newName: string) {
  try {
    const cookieStore = await import('next/headers').then(m => m.cookies())
    const supabase = await createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return {
        success: false,
        error: '未登录',
        code: 'UNAUTHORIZED'
      }
    }

    const trimmedName = newName.trim()

    if (trimmedName.length === 0 || trimmedName.length > NAME_MAX_LENGTH) {
      return {
        success: false,
        error: '名称长度必须为 1-10 个字符',
        code: 'INVALID_LENGTH'
      }
    }

    const territory = await prisma.territories.findUnique({
      where: { id: territoryId, owner_id: user.id },
      select: {
        owner_id: true,
        name_updated_at: true,
        custom_name: true
      }
    })

    if (!territory) {
      return {
        success: false,
        error: '领地不存在或无权操作',
        code: 'TERRITORY_NOT_FOUND'
      }
    }

    if (territory.name_updated_at) {
      const daysSinceLastUpdate = (Date.now() - territory.name_updated_at.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceLastUpdate < COOLDOWN_DAYS) {
        const remainingDays = Math.ceil(COOLDOWN_DAYS - daysSinceLastUpdate)
        return {
          success: false,
          error: `改名冷却期还剩 ${remainingDays} 天`,
          code: 'COOLDOWN',
          remainingDays
        }
      }
    }

    const result = filter.verify(trimmedName)
    if (result.words.length > 0) {
      return {
        success: false,
        error: '名称包含敏感词汇，请修改后重试',
        code: 'SENSITIVE_WORD',
        words: result.words
      }
    }

    await prisma.territories.update({
      where: { id: territoryId, owner_id: user.id },
      data: {
        custom_name: trimmedName,
        name_updated_at: new Date()
      }
    })

    revalidatePath('/map')

    return {
      success: true,
      customName: trimmedName
    }
  } catch (error) {
    console.error('Failed to rename territory:', error)
    return {
      success: false,
      error: '服务器错误，请稍后重试',
      code: 'SERVER_ERROR'
    }
  }
}
