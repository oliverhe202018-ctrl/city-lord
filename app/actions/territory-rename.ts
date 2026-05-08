'use server'

import { prisma } from '@/lib/prisma'
import MintFilter from 'mint-filter'
import { revalidatePath, revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const RENAME_CONFIG = {
  MAX_LENGTH: 10,
  COOLDOWN_DAYS: 7,
} as const

const FALLBACK_WORDS = ['敏感词', '违规', '垃圾', '广告', '政治', '色情', '暴力', '赌博']

let _filterInstance: MintFilter | null = null

function getFilter(): MintFilter {
    if (_filterInstance) return _filterInstance

    const envWords = process.env.SENSITIVE_WORDS
        ? process.env.SENSITIVE_WORDS.split(',').map(w => w.trim()).filter(Boolean)
        : []

    const mergedWords = [...new Set([...envWords, ...FALLBACK_WORDS])]
    _filterInstance = new MintFilter(mergedWords)
    return _filterInstance
}

export async function renameTerritory(territoryId: string, newName: string) {
  try {
    const cookieStore = await cookies()
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
    const isResetToDefault = trimmedName.length === 0

    if (!isResetToDefault && trimmedName.length > RENAME_CONFIG.MAX_LENGTH) {
      return {
        success: false,
        error: `名称长度不能超过 ${RENAME_CONFIG.MAX_LENGTH} 个字符`,
        code: 'INVALID_LENGTH'
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const territory = await tx.territories.findUnique({
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

      if (territory.custom_name === trimmedName || (isResetToDefault && !territory.custom_name)) {
        return {
          success: true,
          customName: territory.custom_name ?? null,
          isIdempotent: true
        }
      }

      if (territory.name_updated_at) {
        const daysSinceLastUpdate = (Date.now() - territory.name_updated_at.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceLastUpdate < RENAME_CONFIG.COOLDOWN_DAYS) {
          const remainingDays = Math.ceil(RENAME_CONFIG.COOLDOWN_DAYS - daysSinceLastUpdate)
          return {
            success: false,
            error: `改名冷却期还剩 ${remainingDays} 天`,
            code: 'COOLDOWN',
            remainingDays
          }
        }
      }

      if (!isResetToDefault) {
        const filterResult = getFilter().verify(trimmedName)
        if (filterResult?.words && filterResult.words.length > 0) {
          return {
            success: false,
            error: '名称包含敏感词汇，请修改后重试',
            code: 'SENSITIVE_WORD',
            words: filterResult.words
          }
        }
      }

      await tx.territories.update({
        where: { id: territoryId, owner_id: user.id },
        data: {
          custom_name: isResetToDefault ? null : trimmedName,
          name_updated_at: new Date()
        }
      })

      return {
        success: true,
        customName: isResetToDefault ? null : trimmedName
      }
    })

    if (result.success) {
      revalidatePath('/map')
      revalidateTag(`territory-${territoryId}`)
    }

    return result
  } catch (error) {
    console.error('Failed to rename territory:', error)
    return {
      success: false,
      error: '服务器错误，请稍后重试',
      code: 'SERVER_ERROR'
    }
  }
}
