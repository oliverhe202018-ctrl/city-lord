import { BadgeCheckContext } from './badge-context'

export interface BadgeCondition {
  id: string; // 对应数据库中 badges 表的 code 字段 (如 'first-mission')
  triggerTypes: string[]; // 触发该勋章检查的事件类型列表
  check: (context: BadgeCheckContext) => boolean; // 是否达成条件
  progressCheck: (context: BadgeCheckContext) => { current: number; target: number }; // 前端进度计算
}

export const BADGE_REGISTRY: BadgeCondition[] = [
  {
    id: 'first-mission',
    triggerTypes: ['MISSION_COMPLETED'],
    check: (ctx) => ctx.completedMissionCount >= 1,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.completedMissionCount, 1),
      target: 1
    })
  },
  {
    id: 'mission-master',
    triggerTypes: ['MISSION_COMPLETED'],
    check: (ctx) => {
      // TODO: Phase 5 - N 值建议后续从数据库配置项读取，此处暂以硬编码 10 为示例平滑过渡
      const targetN = 10;
      return ctx.completedMissionCount >= targetN;
    },
    progressCheck: (ctx) => {
      // TODO: Phase 5 - 读取配置项替换硬编码 10
      const targetN = 10;
      return {
        current: Math.min(ctx.completedMissionCount, targetN),
        target: targetN
      };
    }
  },
  {
    id: 'level-10',
    triggerTypes: ['LEVEL_UP'],
    check: (ctx) => ctx.stats.level >= 10,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.level, 10),
      target: 10
    })
  },
  {
    id: 'level-50',
    triggerTypes: ['LEVEL_UP'],
    check: (ctx) => ctx.stats.level >= 50,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.level, 50),
      target: 50
    })
  },

  // --- Migrate Existing Code Conditions from achievement-core.ts ---
  {
    id: 'landlord',
    triggerTypes: ['TERRITORY_CAPTURED'], // Old trigger 'TERRITORY_CAPTURE'
    // landlord: 同时持有（active count），需要保住地盘
    check: (ctx) => ctx.activeTileCount >= 10,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.activeTileCount, 10),
      target: 10
    })
  },
  {
    id: 'territory-raider',
    triggerTypes: ['TERRITORY_CAPTURED'],
    // territory-raider: 历史累计占领（total count），一次性里程碑
    check: (ctx) => ctx.stats.totalTiles >= 50,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.totalTiles, 50),
      target: 50
    })
  },
  {
    id: 'first-territory',
    triggerTypes: ['TERRITORY_CAPTURED'],
    // first-territory: 历史累计占领（total count），一次性里程碑
    check: (ctx) => ctx.stats.totalTiles >= 1,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.totalTiles, 1),
      target: 1
    })
  },
  {
    id: 'shoe-killer',
    triggerTypes: ['RUN_FINISHED'],
    check: (ctx) => ctx.stats.totalDistance >= 500,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.totalDistance, 500),
      target: 500
    })
  },
  {
    id: '100km-club',
    triggerTypes: ['RUN_FINISHED'],
    check: (ctx) => ctx.stats.totalDistance >= 100,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.totalDistance, 100),
      target: 100
    })
  },
  {
    id: 'city-walker',
    triggerTypes: ['RUN_FINISHED'],
    check: (ctx) => ctx.stats.totalDistance >= 50,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.totalDistance, 50),
      target: 50
    })
  },
  {
    id: 'flash',
    triggerTypes: ['RUN_FINISHED'],
    check: (ctx) => {
      const distKm = (ctx.eventData?.distance || 0) / 1000
      return distKm >= 1 && !!ctx.eventData?.pace && ctx.eventData.pace < 4.0
    },
    progressCheck: (ctx) => {
      const distKm = (ctx.eventData?.distance || 0) / 1000
      const isAchieved = distKm >= 1 && !!ctx.eventData?.pace && ctx.eventData.pace < 4.0
      return {
        current: isAchieved ? 1 : 0,
        target: 1
      }
    }
  },
  {
    id: 'marathon-god',
    triggerTypes: ['RUN_FINISHED'],
    check: (ctx) => {
      const distKm = (ctx.eventData?.distance || 0) / 1000
      return distKm >= 42
    },
    progressCheck: (ctx) => {
      const distKm = (ctx.eventData?.distance || 0) / 1000
      return {
        current: distKm >= 42 ? 1 : 0,
        target: 1
      }
    }
  },
  {
    id: 'early-bird',
    triggerTypes: ['RUN_FINISHED'],
    check: (ctx) => {
      if (!ctx.eventData?.endTime) return false
      const hour = new Date(ctx.eventData.endTime).getHours()
      return hour >= 5 && hour < 7
    },
    progressCheck: (ctx) => {
      if (!ctx.eventData?.endTime) return { current: 0, target: 1 }
      const hour = new Date(ctx.eventData.endTime).getHours()
      return { current: (hour >= 5 && hour < 7) ? 1 : 0, target: 1 }
    }
  },
  {
    id: 'night-walker',
    triggerTypes: ['RUN_FINISHED'],
    check: (ctx) => {
      if (!ctx.eventData?.endTime) return false
      const hour = new Date(ctx.eventData.endTime).getHours()
      return hour >= 22 || hour < 2
    },
    progressCheck: (ctx) => {
      if (!ctx.eventData?.endTime) return { current: 0, target: 1 }
      const hour = new Date(ctx.eventData.endTime).getHours()
      return { current: (hour >= 22 || hour < 2) ? 1 : 0, target: 1 }
    }
  },
  {
    id: 'continuous-checkin',
    triggerTypes: ['RUN_FINISHED'],
    check: (ctx) => ctx.uniqueDaysRunInLast7Days >= 7,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.uniqueDaysRunInLast7Days, 7),
      target: 7
    })
  },
  {
    id: 'first-activity',
    triggerTypes: ['ACTIVITY_COMPLETED'],
    check: (ctx) => ctx.completedActivityCount >= 1,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.completedActivityCount, 1),
      target: 1
    })
  },
  {
    id: 'activity-enthusiast',
    triggerTypes: ['ACTIVITY_COMPLETED'],
    check: (ctx) => ctx.completedActivityCount >= 5,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.completedActivityCount, 5),
      target: 5
    })
  },
  {
    id: 'activity-top3',
    triggerTypes: ['ACTIVITY_COMPLETED'],
    check: (ctx) => !!ctx.eventData?.isTopThree,
    progressCheck: (ctx) => ({
      current: (ctx.earnedBadgeCodes.has('activity-top3') || !!ctx.eventData?.isTopThree) ? 1 : 0,
      target: 1
    })
  }
]
