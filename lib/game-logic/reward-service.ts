import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { calculateLevel, getTitle } from '@/lib/game-logic/level-system'
import { eventBus } from '@/lib/game-logic/event-bus'

/**
 * 统一奖励发放服务 (金币 & 经验)
 *
 * 此处使用单一 Serializable 事务，将金币、经验、等级、流水一并写入，
 * 不嵌套调用 addExperienceUnified，避免死锁或一致性问题。
 */
export async function grantRewards(
  userId: string,
  rewards: { exp?: number; coins?: number },
  source: string,
  referenceId?: string
): Promise<{ newExp: number; newLevel: number; newCoins: number; levelUp: boolean }> {
  const incExp = rewards.exp || 0
  const incCoins = rewards.coins || 0

  if (incExp === 0 && incCoins === 0) {
    // 没获得任何奖励的短路处理
    const current = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { current_exp: true, level: true, coins: true }
    })
    return {
      newExp: current?.current_exp || 0,
      newLevel: current?.level || 1,
      newCoins: current?.coins || 0,
      levelUp: false
    }
  }

  // --- 事务内执行 ---
  const result = await prisma.$transaction(
    async (tx) => {
      // 1. 获取当前状态
      const profile = await tx.profiles.findUniqueOrThrow({
        where: { id: userId },
        select: { current_exp: true, level: true, coins: true }
      })

      const currentExp = profile.current_exp || 0
      const currentLevel = profile.level || 1
      const currentCoins = profile.coins || 0

      // 2. 计算新状态，金币加上限制保证不跌落负数
      const newCoins = Math.max(0, currentCoins + incCoins)
      const newExp = currentExp + incExp
      const newLevel = calculateLevel(newExp)
      const levelUp = newLevel > currentLevel

      // 3. 更新 profile
      await tx.profiles.update({
        where: { id: userId },
        data: {
          current_exp: newExp,
          level: newLevel,
          coins: newCoins,
          updated_at: new Date()
        }
      })

      // 4. 写流水
      await tx.rewardLog.create({
        data: {
          userId,
          exp: incExp > 0 ? incExp : null,
          coins: incCoins > 0 ? incCoins : null,
          source,
          referenceId: referenceId || null
        }
      })

      return {
        oldLevel: currentLevel,
        newLevel,
        newExp,
        newCoins,
        levelUp
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

  // --- 事务外执行 ---
  if (result.levelUp) {
    try {
      // 事务已提交，升级已生效。emit 失败仅影响通知，不影响数据
      await eventBus.emit({
        type: 'LEVEL_UP',
        userId: userId,
        oldLevel: result.oldLevel,
        newLevel: result.newLevel,
        newTitle: getTitle(result.newLevel)
      })
    } catch (err) {
      console.error('[grantRewards] LEVEL_UP emit failed:', err)
    }
  }

  return {
    newExp: result.newExp,
    newLevel: result.newLevel,
    newCoins: result.newCoins,
    levelUp: result.levelUp
  }
}
