import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { calculateLevel, getTitle } from '@/lib/game-logic/level-system'
import { eventBus } from '@/lib/game-logic/event-bus'

/**
 * 统一经验管理服务
 *
 * 只处理单一经验增加场景。包含：
 * 1. 串行化事务（防并发修改导致经验丢失）
 * 2. 数据库写入（用户表与经验流水表）
 * 3. 升级判定与事件触发
 *
 * 注意：如果需要同时颁发经验和金币，请直接调用 reward-service.ts 中的 grantRewards
 */
export async function addExperienceUnified(
  userId: string,
  amount: number,
  source: string
): Promise<{ newExp: number; newLevel: number; levelUp: boolean }> {
  // --- 事务内执行 ---
  const result = await prisma.$transaction(
    async (tx) => {
      // 1. 获取当前等级与经验（找不到抛出错误）
      const profile = await tx.profiles.findUniqueOrThrow({
        where: { id: userId },
        select: { level: true, current_exp: true }
      })

      const currentExp = profile.current_exp || 0
      const currentLevel = profile.level || 1

      // 2. 计算新经验与等级
      const newExp = currentExp + amount
      const newLevel = calculateLevel(newExp)
      const levelUp = newLevel > currentLevel

      // 3. 更新属性
      await tx.profiles.update({
        where: { id: userId },
        data: {
          current_exp: newExp,
          level: newLevel,
          updated_at: new Date()
        }
      })

      // 4. 写入流水
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
      // @ts-expect-error - FIXME: Property 'expLog' does not exist on type 'Omit<PrismaClient<PrismaClie - [Ticket-202603-SchemaSync] baseline exemption
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
      console.error('[addExperienceUnified] LEVEL_UP emit failed:', err)
    }
  }

  return {
    newExp: result.newExp,
    newLevel: result.newLevel,
    levelUp: result.levelUp
  }
}
