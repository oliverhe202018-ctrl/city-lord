import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { calculateLevel, getTitle } from '@/lib/game-logic/level-system'
import { eventBus } from '@/lib/game-logic/event-bus'

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
      // 1. 鑾峰彇褰撳墠绛夌骇涓庣粡楠岋紙鎵句笉鍒版姏鍑洪敊璇級
      const profile = await tx.profiles.findUniqueOrThrow({
        where: { id: userId },
        select: { level: true, current_exp: true }
      })

      const currentExp = profile.current_exp || 0
      const currentLevel = profile.level || 1

      // 2. 璁＄畻鏂扮粡楠屼笌绛夌骇
      const newExp = currentExp + amount
      const newLevel = calculateLevel(newExp)
      const levelUp = newLevel > currentLevel

      // 3. 鏇存柊灞炴€?
      await tx.profiles.update({
        where: { id: userId },
        data: {
          current_exp: newExp,
          level: newLevel,
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
