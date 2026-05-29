import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { calculateLevel, getTitle } from '@/lib/game-logic/level-system'
import { eventBus } from '@/lib/game-logic/event-bus'

const DAILY_BONUS_XP = 50
const DAILY_BONUS_TASK_ID = 'daily_bonus'

const STREAK_BONUS_MAP: Record<number, number> = {
  3: 30,
  7: 100,
  14: 200,
  30: 500,
}

function getPeriodKey(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

function getUTCDateStart(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * 缁熶竴缁忛獙绠＄悊鏈嶅姟
 *
 * 鍙鐞嗗崟涓€缁忛獙澧炲姞鍦烘櫙銆傚寘鍚細
 * 1. 涓茶鍖栦簨鍔★紙闃插苟鍙戜慨鏀瑰鑷寸粡楠屼涪澶憋級
 * 2. 鏁版嵁搴撳啓鍏ワ紙鐢ㄦ埛琛ㄤ笌缁忛獙娴佹按琛級
 * 3. 鍗囩骇鍒ゅ畾涓庝簨浠惰Е鍙?
 *
 * 娉ㄦ剰锛氬鏋滈渶瑕佸悓鏃堕鍙戠粡楠屽拰閲戝竵锛岃鐩存帴璋冪敤 reward-service.ts 涓殑 grantRewards
 */
export async function addExperienceUnified(
  userId: string,
  amount: number,
  source: string
): Promise<{ newExp: number; newLevel: number; levelUp: boolean }> {
  // --- 浜嬪姟鍐呮墽琛?---
  const result = await prisma.$transaction(
    async (tx) => {
      // 1. 获取当前等级与经验（找不到则抛出错误）
      const profile = await tx.profiles.findUniqueOrThrow({
        where: { id: userId },
        select: { level: true, xp: true, max_stamina: true }
      })

      const currentExp = profile.xp || 0
      const currentLevel = profile.level || 1
      const maxStamina = profile.max_stamina ?? 100

      // 2. 计算新经验与等级
      const newExp = currentExp + amount
      const newLevel = calculateLevel(newExp)
      const levelUp = newLevel > currentLevel

      // 3. 更新属性（升级时满血复活）
      await tx.profiles.update({
        where: { id: userId },
        data: {
          xp: newExp,
          level: newLevel,
          ...(levelUp ? { stamina: maxStamina } : {}),
          updated_at: new Date()
        }
      })

      // 4. 鍐欏叆娴佹按

      
      await tx.expLog.create({
        data: {
          userId,
          amount,
          oldExp: currentExp,
          newExp,
          source
        }
      })

      return {
        oldLevel: currentLevel,
        newLevel,
        newExp,
        levelUp
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

  // --- 浜嬪姟澶栨墽琛?---
  if (result.levelUp) {
    try {
      // 浜嬪姟宸叉彁浜わ紝鍗囩骇宸茬敓鏁堛€俥mit 澶辫触浠呭奖鍝嶉€氱煡锛屼笉褰卞搷鏁版嵁
      await eventBus.emit({
        type: 'LEVEL_UP',
        userId: userId,
        oldLevel: result.oldLevel,
        newLevel: result.newLevel,
        newTitle: getTitle(result.newLevel)
      })
    } catch (err) {
      console.error('[addExperienceUnified] LEVEL_UP emit failed:', err)
    }
  }

  return {
    newExp: result.newExp,
    newLevel: result.newLevel,
    levelUp: result.levelUp
  }
}

export async function claimDailyBonus(
  userId: string
): Promise<{ success: boolean; xpGranted: number; streak: number; alreadyClaimed: boolean; levelUp: boolean }> {
  const periodKey = getPeriodKey()

  const result = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.userTaskLogs.findUnique({
        where: {
          userId_taskId_periodKey: {
            userId,
            taskId: DAILY_BONUS_TASK_ID,
            periodKey
          }
        }
      })

      if (existing) {
        return { alreadyClaimed: true, xpGranted: 0, streak: 0, levelUp: false }
      }

      const keysToCheck: string[] = []
      for (let i = 1; i <= 30; i++) {
        keysToCheck.push(getPeriodKey(new Date(Date.now() - i * 86_400_000)))
      }

      const recentLogs = await tx.userTaskLogs.findMany({
        where: {
          userId,
          taskId: DAILY_BONUS_TASK_ID,
          periodKey: { in: keysToCheck }
        },
        select: { periodKey: true }
      })

      const logSet = new Set(recentLogs.map((l) => l.periodKey))

      let streak = 0
      for (const key of keysToCheck) {
        if (logSet.has(key)) {
          streak++
        } else {
          break
        }
      }
      streak += 1

      const profile = await tx.profiles.findUniqueOrThrow({
        where: { id: userId },
        select: { level: true, xp: true, max_stamina: true }
      })

      const currentExp = profile.xp || 0
      const currentLevel = profile.level || 1
      const maxStamina = profile.max_stamina ?? 100

      let streakBonus = 0
      for (const [threshold, bonus] of Object.entries(STREAK_BONUS_MAP)) {
        if (streak >= Number(threshold)) {
          streakBonus = Math.max(streakBonus, bonus)
        }
      }

      const totalXp = DAILY_BONUS_XP + streakBonus
      const newExp = currentExp + totalXp
      const newLevel = calculateLevel(newExp)
      const levelUp = newLevel > currentLevel

      await tx.profiles.update({
        where: { id: userId },
        data: {
          xp: newExp,
          level: newLevel,
          ...(levelUp ? { stamina: maxStamina } : {}),
          updated_at: new Date()
        }
      })

      await tx.userTaskLogs.create({
        data: {
          userId,
          taskId: DAILY_BONUS_TASK_ID,
          type: 'daily',
          periodKey,
          rewardCoins: 0,
          rewardXp: totalXp,
          completed_at: new Date()
        }
      })

      await tx.expLog.create({
        data: {
          userId,
          amount: totalXp,
          oldExp: currentExp,
          newExp,
          source: 'daily_bonus'
        }
      })

      return { alreadyClaimed: false, xpGranted: totalXp, streak, levelUp, newLevel, oldLevel: currentLevel }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

  if (result.levelUp) {
    try {
      await eventBus.emit({
        type: 'LEVEL_UP',
        userId,
        oldLevel: result.oldLevel,
        newLevel: result.newLevel,
        newTitle: getTitle(result.newLevel)
      })
    } catch (err) {
      console.error('[claimDailyBonus] LEVEL_UP emit failed:', err)
    }
  }

  return {
    success: true,
    xpGranted: result.xpGranted,
    streak: result.streak,
    alreadyClaimed: result.alreadyClaimed,
    levelUp: result.levelUp
  }
}

export async function getDailyBonusStatus(userId: string): Promise<{ claimed: boolean; streak: number; streakBonus: number }> {
  const periodKey = getPeriodKey()

  const existing = await prisma.userTaskLogs.findUnique({
    where: {
      userId_taskId_periodKey: {
        userId,
        taskId: DAILY_BONUS_TASK_ID,
        periodKey
      }
    }
  })

  if (existing) {
    return { claimed: true, streak: 0, streakBonus: 0 }
  }

  const yesterdayKey = getPeriodKey(new Date(Date.now() - 86_400_000))
  const yesterdayLog = await prisma.userTaskLogs.findUnique({
    where: {
      userId_taskId_periodKey: {
        userId,
        taskId: DAILY_BONUS_TASK_ID,
        periodKey: yesterdayKey
      }
    }
  })

  if (!yesterdayLog) {
    return { claimed: false, streak: 0, streakBonus: 0 }
  }

  const lastWeekKeys: string[] = []
  for (let i = 1; i <= 30; i++) {
    lastWeekKeys.push(getPeriodKey(new Date(Date.now() - i * 86_400_000)))
  }

  const logs = await prisma.userTaskLogs.findMany({
    where: {
      userId,
      taskId: DAILY_BONUS_TASK_ID,
      periodKey: { in: lastWeekKeys }
    },
    orderBy: { periodKey: 'desc' }
  })

  let streak = 1
  for (let i = 0; i < lastWeekKeys.length; i++) {
    const found = logs.some((l) => l.periodKey === lastWeekKeys[i])
    if (found) {
      streak++
    } else {
      break
    }
  }

  let streakBonus = 0
  for (const [threshold, bonus] of Object.entries(STREAK_BONUS_MAP)) {
    if (streak >= Number(threshold)) {
      streakBonus = Math.max(streakBonus, bonus)
    }
  }

  return { claimed: false, streak, streakBonus }
}
