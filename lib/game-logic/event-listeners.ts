/**
 * Event Listeners — 注册所有跨系统联动关系
 *
 * 本文件在应用启动时被调用一次（通过 registerAllListeners()），
 * 将各个系统的 handler 绑定到 EventBus 上。
 *
 * 当前阶段（Phase 1）的 handler 内部为空或桩函数，
 * 后续阶段逐步替换为真实实现。
 */

import {
  eventBus,
  type RunFinishedPayload,
  type MissionCompletedPayload,
  type MissionClaimedPayload,
  type LevelUpPayload,
  type TerritoryCapturedPayload,
  type ActivityCompletedPayload,
  type BadgeEarnedPayload,
} from '@/lib/game-logic/event-bus'
import { TaskService } from '@/lib/services/task'
import { checkAndAwardBadges } from '@/lib/game-logic/achievement-core'

// ═══════════════════════════════════════════════════════════════
// RUN_FINISHED 事件监听
// ═══════════════════════════════════════════════════════════════

/**
 * 跑步完成 → 更新任务进度
 */
async function onRunFinished_UpdateTasks(payload: RunFinishedPayload): Promise<void> {
  console.log(`[EventListener] RUN_FINISHED → UpdateTasks for user ${payload.userId}, run ${payload.runId}`)
  
  try {
    await TaskService.processEvent(payload.userId, {
      type: 'RUN_FINISHED',
      userId: payload.userId,
      timestamp: payload.endTime,
      data: {
        distance: payload.distance,
        duration: payload.duration,
        pace: payload.pace
      }
    }, payload.runId)
  } catch (err) {
    console.error('[EventListener] TaskService.processEvent failed for RUN_FINISHED:', err)
  }
}

/**
 * 跑步完成 → 检查勋章
 */
async function onRunFinished_CheckBadges(payload: RunFinishedPayload): Promise<void> {
  console.log(`[EventListener] RUN_FINISHED → CheckBadges for user ${payload.userId}`)
  await checkAndAwardBadges(payload.userId, 'RUN_FINISHED', {
    distance: payload.distance,
    duration: payload.duration,
    pace: payload.pace,
    endTime: payload.endTime
  })
}

// ═══════════════════════════════════════════════════════════════
// MISSION_COMPLETED 事件监听
// ═══════════════════════════════════════════════════════════════

/**
 * 任务完成 → 检查勋章
 */
async function onMissionCompleted_CheckBadges(payload: MissionCompletedPayload): Promise<void> {
  console.log(`[EventListener] MISSION_COMPLETED → CheckBadges for user ${payload.userId}, mission ${payload.missionCode}`)
  await checkAndAwardBadges(payload.userId, 'MISSION_COMPLETED', {
    missionCode: payload.missionCode
  })
}

// ═══════════════════════════════════════════════════════════════
// MISSION_CLAIMED 事件监听
// ═══════════════════════════════════════════════════════════════

/**
 * 任务领取奖励 → 统一发奖
 */
async function onMissionClaimed_GrantRewards(payload: MissionClaimedPayload): Promise<void> {
  console.log(`[EventListener] MISSION_CLAIMED → GrantRewards for user ${payload.userId}, exp=${payload.rewards.exp}, coins=${payload.rewards.coins}`)
  // TODO: Phase 2 — 调用 grantRewards(payload.userId, payload.rewards, `mission_reward:${payload.missionCode}`)
}

// ═══════════════════════════════════════════════════════════════
// LEVEL_UP 事件监听
// ═══════════════════════════════════════════════════════════════

/**
 * 升级 → 检查勋章
 */
async function onLevelUp_CheckBadges(payload: LevelUpPayload): Promise<void> {
  console.log(`[EventListener] LEVEL_UP → CheckBadges for user ${payload.userId}, lv ${payload.oldLevel} → ${payload.newLevel}`)
  await checkAndAwardBadges(payload.userId, 'LEVEL_UP', {
    newLevel: payload.newLevel
  })
}

/**
 * 升级 → 发送通知
 */
async function onLevelUp_SendNotification(payload: LevelUpPayload): Promise<void> {
  console.log(`[EventListener] LEVEL_UP → SendNotification for user ${payload.userId}: "${payload.newTitle}" (Lv.${payload.newLevel})`)
  // TODO: Phase 2 — 调用 prisma.notifications.create({ ... })
}

// ═══════════════════════════════════════════════════════════════
// TERRITORY_CAPTURED 事件监听
// ═══════════════════════════════════════════════════════════════

/**
 * 领地占领 → 更新任务进度
 */
async function onTerritoryCaptured_UpdateTasks(payload: TerritoryCapturedPayload): Promise<void> {
  console.log(`[EventListener] TERRITORY_CAPTURED → UpdateTasks for user ${payload.userId}, hex ${payload.hexId}`)
  
  try {
    await TaskService.processEvent(payload.userId, {
      type: 'GRID_CAPTURED',
      userId: payload.userId,
      timestamp: new Date(),
      data: {
        gridId: payload.hexId,
        isNew: payload.isNew
      }
    }, `tc_${payload.territoryId}_${Date.now()}`)
  } catch (err) {
    console.error('[EventListener] TaskService.processEvent failed for TERRITORY_CAPTURED:', err)
  }
}

/**
 * 领地占领 → 检查勋章
 */
async function onTerritoryCaptured_CheckBadges(payload: TerritoryCapturedPayload): Promise<void> {
  console.log(`[EventListener] TERRITORY_CAPTURED → CheckBadges for user ${payload.userId}`)
  await checkAndAwardBadges(payload.userId, 'TERRITORY_CAPTURED')
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY_COMPLETED 事件监听
// ═══════════════════════════════════════════════════════════════

/**
 * 活动完成 → 检查勋章
 */
async function onActivityCompleted_CheckBadges(payload: ActivityCompletedPayload): Promise<void> {
  console.log(`[EventListener] ACTIVITY_COMPLETED → CheckBadges for user ${payload.userId}, activity ${payload.activityId}`)
  await checkAndAwardBadges(payload.userId, 'ACTIVITY_COMPLETED', {
    isTopThree: payload.isTopThree
  })
}

// ═══════════════════════════════════════════════════════════════
// BADGE_EARNED 事件监听（纯日志/通知用途）
// ═══════════════════════════════════════════════════════════════

/**
 * 勋章获得 → 事件记录（可扩展为推送通知等）
 */
async function onBadgeEarned_Log(payload: BadgeEarnedPayload): Promise<void> {
  console.log(`[EventListener] BADGE_EARNED → user ${payload.userId} earned "${payload.badgeName}" (${payload.badgeCode})`)
}

// ═══════════════════════════════════════════════════════════════
// 注册入口
// ═══════════════════════════════════════════════════════════════

let _registered = false

/**
 * 注册所有跨系统事件监听器。
 * 使用 _registered 标志位确保多次调用时不重复注册。
 */
export function registerAllListeners(): void {
  if (_registered) return
  _registered = true

  // --- RUN_FINISHED ---
  eventBus.on('RUN_FINISHED', 'onRunFinished_UpdateTasks', onRunFinished_UpdateTasks)
  eventBus.on('RUN_FINISHED', 'onRunFinished_CheckBadges', onRunFinished_CheckBadges)

  // --- MISSION_COMPLETED ---
  eventBus.on('MISSION_COMPLETED', 'onMissionCompleted_CheckBadges', onMissionCompleted_CheckBadges)

  // --- MISSION_CLAIMED ---
  eventBus.on('MISSION_CLAIMED', 'onMissionClaimed_GrantRewards', onMissionClaimed_GrantRewards)

  // --- LEVEL_UP ---
  eventBus.on('LEVEL_UP', 'onLevelUp_CheckBadges', onLevelUp_CheckBadges)
  eventBus.on('LEVEL_UP', 'onLevelUp_SendNotification', onLevelUp_SendNotification)

  // --- TERRITORY_CAPTURED ---
  eventBus.on('TERRITORY_CAPTURED', 'onTerritoryCaptured_UpdateTasks', onTerritoryCaptured_UpdateTasks)
  eventBus.on('TERRITORY_CAPTURED', 'onTerritoryCaptured_CheckBadges', onTerritoryCaptured_CheckBadges)

  // --- ACTIVITY_COMPLETED ---
  eventBus.on('ACTIVITY_COMPLETED', 'onActivityCompleted_CheckBadges', onActivityCompleted_CheckBadges)

  // --- BADGE_EARNED ---
  eventBus.on('BADGE_EARNED', 'onBadgeEarned_Log', onBadgeEarned_Log)

  console.log('[EventBus] All listeners registered.')
}
