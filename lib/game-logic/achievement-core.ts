import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/game-logic/event-bus'
import { BADGE_REGISTRY } from './badge-conditions'
import { buildBadgeContext, BadgeCheckContext } from './badge-context'

export type TriggerType = string
export type { BadgeCheckContext }

export type AwardStatus = 'awarded' | 'already_owned' | 'not_qualified' | 'badge_not_found' | 'error'

export interface AwardResult {
  status: AwardStatus
  badgeCode?: string
  badgeName?: string
}

/**
 * 原子化授予勋章
 * 1. 确保数据库唯一约束 (user_id, badge_id)
 * 2. 事务执行：插入记录 + 创建系统通知
 * 3. 事务外部捕获 P2002 (已拥有) 错误
 * 4. 事务提交后发射 BADGE_EARNED 事件
 */
export async function awardBadgeAtomic(userId: string, badgeCode: string): Promise<AwardResult> {
  const badge = await prisma.badges.findUnique({
    where: { code: badgeCode }
  })

  if (!badge) {
    console.error(`[awardBadgeAtomic] Badge not found: ${badgeCode}`)
    return { status: 'badge_not_found' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 插入授予记录 (由于唯一约束，重复插入会抛出 P2002)
      await tx.user_badges.create({
        data: {
          user_id: userId,
          badge_id: badge.id,
          earned_at: new Date()
        }
      })

      // 创建系统通知
      // NOTE: push_status 列尚未迁移到数据库，暂不设置
      await tx.notifications.create({
        data: {
          user_id: userId,
          title: '🏆 获得新勋章！',
          body: `恭喜！你已解锁【${badge.name}】勋章！`,
          type: 'badge',
          is_read: false
        }
      })
    })

    // 事务成功提交后，发射事件触发后续逻辑（如 UI Toast、社交分享）
    // 异步执行，不阻塞返回
    eventBus.emit({
      type: 'BADGE_EARNED',
      userId,
      badgeId: badge.id,
      badgeCode,
      badgeName: badge.name
    }).catch(err => console.error('[awardBadgeAtomic] Event emit failed:', err))

    return { status: 'awarded', badgeCode, badgeName: badge.name }

  } catch (error: any) {
    // 捕获唯一约束冲突，说明用户已拥有该勋章
    if (error.code === 'P2002') {
      return { status: 'already_owned', badgeCode }
    }

    console.error(`[awardBadgeAtomic] Failed to award ${badgeCode}:`, error)
    return { status: 'error' }
  }
}

/**
 * 勋章检查调度中心
 * 1. 构建全量上下文 (Context)
 * 2. 过滤当前触发事件相关的勋章
 * 3. 排除已拥有的勋章
 * 4. 验证并原子化授予新勋章
 */
export async function checkAndAwardBadges(
  userId: string,
  triggerType: string,
  eventData?: any
): Promise<AwardResult[]> {
  try {
    const ctx = await buildBadgeContext(userId, eventData)
    const results: AwardResult[] = []

    // 找出所有受此事件触发且用户尚未获得的勋章
    const relevantBadges = BADGE_REGISTRY.filter(condition => 
      condition.triggerTypes.includes(triggerType) && 
      !ctx.earnedBadgeCodes.has(condition.id)
    )

    for (const condition of relevantBadges) {
      if (condition.check(ctx)) {
        const result = await awardBadgeAtomic(userId, condition.id)
        results.push(result)
      }
    }

    return results

  } catch (error) {
    console.error(`[checkAndAwardBadges] Error for user ${userId} on ${triggerType}:`, error)
    return []
  }
}

