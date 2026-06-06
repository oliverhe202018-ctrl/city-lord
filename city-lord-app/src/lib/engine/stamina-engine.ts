/**
 * Stamina Engine — Phase 3C
 * 
 * 核心职责：
 * 1. 跑前体力校验（拦截体力 < 10 的用户）
 * 2. 跑后体力扣减（带底线防御，确保体力不会被扣成负数）
 * 3. 体力自然恢复计算（每分钟恢复一定体力，不超过 max）
 */

import { prisma } from '@/lib/prisma'

// ─── 常量 ───────────────────────────────────────────────────────────────────

/** 允许开始跑步的最低体力阈值 */
export const MIN_STAMINA_TO_RUN = 10

/** 跑步基础体力消耗 */
export const BASE_STAMINA_COST = 10

/** 每公里额外体力消耗 */
export const STAMINA_COST_PER_KM = 10

/** 自然恢复速率（体力/分钟） */
export const STAMINA_RECOVERY_PER_MINUTE = 1

// ─── 类型 ───────────────────────────────────────────────────────────────────

export interface StaminaProfile {
  stamina: number
  maxStamina: number
}

// ─── 公共 API ───────────────────────────────────────────────────────────────

/**
 * 跑前拦截校验
 * @returns 返回用户当前体力，若 < MIN_STAMINA_TO_RUN 则抛错
 */
export async function assertCanRun(userId: string): Promise<number> {
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { stamina: true, max_stamina: true }
  })

  if (!profile) {
    throw new Error('用户资料不存在')
  }

  const currentStamina = profile.stamina ?? 0

  if (currentStamina < MIN_STAMINA_TO_RUN) {
    throw new Error(`体力不足（当前 ${currentStamina}/${profile.max_stamina}），请休息后再试`)
  }

  return currentStamina
}

/**
 * 计算跑步体力消耗
 */
export function calculateStaminaCost(distanceKm: number): number {
  const cost = Math.floor(BASE_STAMINA_COST + distanceKm * STAMINA_COST_PER_KM)
  return Math.max(0, cost) // 底线防御：消耗不能为负
}

/**
 * 扣减用户体力（带底线防御）
 * @returns 扣减后的体力值
 */
export async function deductStamina(userId: string, cost: number): Promise<number> {
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { stamina: true, max_stamina: true }
  })

  if (!profile) {
    throw new Error('用户资料不存在')
  }

  const currentStamina = profile.stamina ?? 0
  const remainingStamina = Math.max(0, currentStamina - cost) // 底线防御：不低于 0

  await prisma.profiles.update({
    where: { id: userId },
    data: { stamina: remainingStamina }
  })

  return remainingStamina
}

/**
 * 计算自然恢复后的体力值
 * @param currentStamina 当前体力
 * @param maxStamina 最大体力
 * @param minutesElapsed 距离上次活动过去的分钟数
 */
export function calculateRecoveredStamina(
  currentStamina: number,
  maxStamina: number,
  minutesElapsed: number
): number {
  const recovered = currentStamina + Math.floor(minutesElapsed * STAMINA_RECOVERY_PER_MINUTE)
  return Math.min(recovered, maxStamina) // 上限防御：不超过 maxStamina
}
