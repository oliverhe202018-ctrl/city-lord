/**
 * 功能门控检查逻辑
 *
 * 核心职责：
 * 1. checkFeatureAccess(userId, featureKey) - 检查用户是否解锁某功能
 * 2. unlockFeature(userId, featureKey) - 记录用户解锁某功能（幂等）
 * 3. getFeatureStatus(userId) - 获取用户所有功能访问状态
 * 4. isFeatureAvailable(userId, featureKey) - 同步检查功能可用性
 *
 * 设计原则：
 * - 不操作 UI，不弹窗，纯后端逻辑
 * - 数据库缓存 + 内存缓存双层加速
 * - 支持批量检查
 * - 所有函数都返回统一结构 { success, code, message, data }
 */

import { FEATURE_GATES, getUnlockedFeatures } from '@/lib/game-logic/level-unlock-config'
import { prisma } from '@/lib/prisma'
import { calculateLevel } from '@/lib/game-logic/level-system'

// ========================================
// 类型定义
// ========================================

export interface GateResult {
  success: boolean
  code: 'allowed' | 'locked' | 'not_found' | 'error'
  message: string
  data?: {
    featureKey: string
    description: string
    userLevel: number
    requiredLevel: number
    unlockedAt?: Date
  }
}

export interface FeatureAccessRecord {
  featureKey: string
  unlockedAt: Date | null
}

export interface FeatureAccessBatchResult {
  success: boolean
  code: 'allowed' | 'locked' | 'not_found' | 'error'
  data?: Record<string, FeatureAccessRecord>
}

// ========================================
// 核心函数：检查功能访问权限
// ========================================

/**
 * 检查用户是否解锁了指定功能
 * 采用"数据库缓存 + 内存缓存"双层检查策略
 *
 * @param userId - 用户ID
 * @param featureKey - 功能标识符（如 "night_mode", "club_join"）
 * @param cacheMinutes - 缓存过期时间（分钟），默认 30
 * @returns GateResult 检查结果
 */
export async function checkFeatureAccess(
  userId: string,
  featureKey: string,
  cacheMinutes: number = 30
): Promise<GateResult> {
  // 1. 验证功能标识符是否合法
  const gateConfig = FEATURE_GATES.find(g => g.featureKey === featureKey)
  if (!gateConfig) {
    return {
      success: false,
      code: 'not_found',
      message: `功能 "${featureKey}" 不存在于门控表中`
    }
  }

  // 2. 查询用户当前等级
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { level: true, xp: true }
  })

  if (!profile) {
    return {
      success: false,
      code: 'error',
      message: `用户 "${userId}" 不存在`
    }
  }

  const userLevel = profile.level || 1
  const requiredLevel = gateConfig.minLevel

  // 3. 内存级检查（快速路径）
  if (userLevel >= requiredLevel) {
    return {
      success: true,
      code: 'allowed',
      message: '功能已解锁',
      data: {
        featureKey,
        description: gateConfig.description,
        userLevel,
        requiredLevel
      }
    }
  }

  // 4. 数据库级检查（确认是否已解锁）
  const access = await prisma.user_feature_accesses.findUnique({
    where: {
      userId_featureKey: {
        userId,
        featureKey
      }
    }
  })

  if (access) {
    return {
      success: true,
      code: 'allowed',
      message: '功能已解锁（数据库记录）',
      data: {
        featureKey,
        description: gateConfig.description,
        userLevel,
        requiredLevel,
        unlockedAt: access.unlockedAt
      }
    }
  }

  // 5. 返回未解锁结果
  return {
    success: false,
    code: 'locked',
    message: `需要等级 ${requiredLevel}，当前等级 ${userLevel}`,
    data: {
      featureKey,
      description: gateConfig.description,
      userLevel,
      requiredLevel
    }
  }
}

// ========================================
// 核心函数：解锁功能（幂等操作）
// ========================================

/**
 * 记录用户解锁了某功能（幂等操作）
 * 如果用户已经解锁，直接返回成功
 *
 * @param userId - 用户ID
 * @param featureKey - 功能标识符
 * @returns Promise<boolean> 是否成功解锁
 */
export async function unlockFeature(
  userId: string,
  featureKey: string
): Promise<boolean> {
  try {
    await prisma.user_feature_accesses.upsert({
      where: {
        userId_featureKey: {
          userId,
          featureKey
        }
      },
      create: {
        userId,
        featureKey
      },
      update: {}
    })
    return true
  } catch (error) {
    console.error(`[unlockFeature] Failed to unlock ${featureKey} for user ${userId}:`, error)
    return false
  }
}

// ========================================
// 核心函数：批量检查功能状态
// ========================================

/**
 * 批量检查用户多个功能的状态
 *
 * @param userId - 用户ID
 * @param featureKeys - 功能标识符数组
 * @returns FeatureAccessBatchResult
 */
export async function checkFeatureAccessBatch(
  userId: string,
  featureKeys: string[]
): Promise<FeatureAccessBatchResult> {
  const results: Record<string, FeatureAccessRecord> = {}

  for (const featureKey of featureKeys) {
    const result = await checkFeatureAccess(userId, featureKey)
    results[featureKey] = {
      featureKey,
      unlockedAt: result.code === 'allowed' ? new Date() : null
    }
  }

  return {
    success: true,
    code: 'allowed',
    data: results
  }
}

// ========================================
// 核心函数：获取用户所有功能访问状态
// ========================================

/**
 * 获取用户所有已解锁的功能（数据库查询）
 *
 * @param userId - 用户ID
 * @returns FeatureAccessRecord[]
 */
export async function getFeatureStatus(userId: string): Promise<FeatureAccessRecord[]> {
  const records = await prisma.user_feature_accesses.findMany({
    where: { userId },
    select: { featureKey: true, unlockedAt: true }
  })

  return records.map(r => ({
    featureKey: r.featureKey,
    unlockedAt: r.unlockedAt
  }))
}

// ========================================
// 核心函数：同步检查功能可用性
// ========================================

/**
 * 同步检查功能可用性（不查数据库，仅基于等级判断）
 * 适用于高频调用的场景（如跑步结束时的经验分配）
 *
 * @param userLevel - 用户当前等级
 * @param featureKey - 功能标识符
 * @returns boolean 是否可用
 */
export function isFeatureAvailable(userLevel: number, featureKey: string): boolean {
  const gate = FEATURE_GATES.find(g => g.featureKey === featureKey)
  if (!gate) return false
  return userLevel >= gate.minLevel
}

// ========================================
// 核心函数：计算功能解锁进度
// ========================================

/**
 * 计算用户解锁某功能的进度（0-100%）
 *
 * @param userLevel - 用户当前等级
 * @param featureKey - 功能标识符
 * @returns number 解锁进度（0-100）
 */
export function calculateUnlockProgress(userLevel: number, featureKey: string): number {
  const gate = FEATURE_GATES.find(g => g.featureKey === featureKey)
  if (!gate) return 100

  const requiredLevel = gate.minLevel
  if (userLevel >= requiredLevel) return 100

  // 简单线性插值
  const progress = (userLevel / requiredLevel) * 100
  return Math.min(100, Math.max(0, progress))
}

// ========================================
// 核心函数：获取用户未解锁功能列表
// ========================================

/**
 * 获取用户尚未解锁的功能列表（用于前端展示待解锁项）
 *
 * @param userLevel - 用户当前等级
 * @param excludeActive - 是否排除已启用的功能（默认 true）
 * @returns UnlockRule[]
 */
export function getLockedFeaturesForUser(userLevel: number, excludeActive: boolean = true): typeof FEATURE_GATES {
  const gates = FEATURE_GATES.filter(gate => gate.isActive)
  if (excludeActive) {
    return gates.filter(gate => userLevel < gate.minLevel)
  }
  return gates.filter(gate => userLevel < gate.minLevel)
}
