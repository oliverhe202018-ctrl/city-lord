import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { calculateLevel, getTitle } from '@/lib/game-logic/level-system'
import { eventBus } from '@/lib/game-logic/event-bus'

/**
 * 缁熶竴濂栧姳鍙戞斁鏈嶅姟 (閲戝竵 & 缁忛獙)
 *
 * 姝ゅ浣跨敤鍗曚竴 Serializable 浜嬪姟锛屽皢閲戝竵銆佺粡楠屻€佺瓑绾с€佹祦姘翠竴骞跺啓鍏ワ紝
 * 涓嶅祵濂楄皟鐢?addExperienceUnified锛岄伩鍏嶆閿佹垨涓€鑷存€ч棶棰樸€?
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
    // 娌¤幏寰椾换浣曞鍔辩殑鐭矾澶勭悊
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

  // --- 浜嬪姟鍐呮墽琛?---
  const result = await prisma.$transaction(
    async (tx) => {
      // 1. 鑾峰彇褰撳墠鐘舵€?
      const profile = await tx.profiles.findUniqueOrThrow({
        where: { id: userId },
        select: { current_exp: true, level: true, coins: true }
      })

      const currentExp = profile.current_exp || 0
      const currentLevel = profile.level || 1
      const currentCoins = profile.coins || 0

      // 2. 璁＄畻鏂扮姸鎬侊紝閲戝竵鍔犱笂闄愬埗淇濊瘉涓嶈穼钀借礋鏁?
      const newCoins = Math.max(0, currentCoins + incCoins)
      const newExp = currentExp + incExp
      const newLevel = calculateLevel(newExp)
      const levelUp = newLevel > currentLevel

      // 3. 鏇存柊 profile
      await tx.profiles.update({
        where: { id: userId },
        data: {
          current_exp: newExp,
          level: newLevel,
          coins: newCoins,
          updated_at: new Date()
        }
      })

      // 4. 鍐欐祦姘?

      
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
