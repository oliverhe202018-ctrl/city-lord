import { BadgeCheckContext } from './badge-context'
import { isNightTime, isEarlyBirdTime, isEveningTime } from '@/lib/constants/time'
import { BADGE_TARGETS } from '@/lib/constants/badges'

function getHourUTC8(dateValue: Date | string | number): number {
  const d = new Date(dateValue)
  return d.getUTCHours() + 8
}

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
    check: (ctx) => ctx.completedMissionCount >= BADGE_TARGETS.firstMission,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.completedMissionCount, BADGE_TARGETS.firstMission),
      target: BADGE_TARGETS.firstMission
    })
  },
  {
    id: 'mission-master',
    triggerTypes: ['MISSION_COMPLETED'],
    check: (ctx) => ctx.completedMissionCount >= BADGE_TARGETS.missionMaster,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.completedMissionCount, BADGE_TARGETS.missionMaster),
      target: BADGE_TARGETS.missionMaster
    })
  },
  {
    id: 'level-10',
    triggerTypes: ['LEVEL_UP'],
    check: (ctx) => ctx.stats.level >= BADGE_TARGETS.level10,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.level, BADGE_TARGETS.level10),
      target: BADGE_TARGETS.level10
    })
  },
  {
    id: 'level-50',
    triggerTypes: ['LEVEL_UP'],
    check: (ctx) => ctx.stats.level >= BADGE_TARGETS.level50,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.level, BADGE_TARGETS.level50),
      target: BADGE_TARGETS.level50
    })
  },

  // --- Migrate Existing Code Conditions from achievement-core.ts ---
  {
    id: 'landlord',
    triggerTypes: ['TERRITORY_CAPTURED'], // Old trigger 'TERRITORY_CAPTURE'
    // landlord: 同时持有（active count），需要保住地盘
    check: (ctx) => ctx.activeTileCount >= BADGE_TARGETS.landlord,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.activeTileCount, BADGE_TARGETS.landlord),
      target: BADGE_TARGETS.landlord
    })
  },
  {
    id: 'territory-raider',
    triggerTypes: ['TERRITORY_CAPTURED'],
    // territory-raider: 历史累计占领（total count），一次性里程碑
    check: (ctx) => ctx.stats.totalTiles >= BADGE_TARGETS.territoryRaider,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.totalTiles, BADGE_TARGETS.territoryRaider),
      target: BADGE_TARGETS.territoryRaider
    })
  },
  {
    id: 'first-territory',
    triggerTypes: ['TERRITORY_CAPTURED'],
    // first-territory: 历史累计占领（total count），一次性里程碑
    check: (ctx) => ctx.stats.totalTiles >= BADGE_TARGETS.firstTerritory,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.totalTiles, BADGE_TARGETS.firstTerritory),
      target: BADGE_TARGETS.firstTerritory
    })
  },
  {
    id: 'shoe-killer',
    triggerTypes: ['RUN_FINISHED'],
    check: (ctx) => ctx.stats.totalDistance >= BADGE_TARGETS.shoeKiller,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.stats.totalDistance, BADGE_TARGETS.shoeKiller),
      target: BADGE_TARGETS.shoeKiller
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
      const hour = getHourUTC8(ctx.eventData.endTime) % 24
      return hour >= 5 && hour < 8
    },
    progressCheck: (ctx) => {
      if (!ctx.eventData?.endTime) return { current: 0, target: 1 }
      const hour = getHourUTC8(ctx.eventData.endTime) % 24
      return { current: (hour >= 5 && hour < 8) ? 1 : 0, target: 1 }
    }
  },
  {
    id: 'night-owl',
    triggerTypes: ['RUN_FINISHED'],
    check: (ctx) => {
      if (!ctx.eventData?.endTime) return false
      const hour = getHourUTC8(ctx.eventData.endTime) % 24
      return isEveningTime(hour)
    },
    progressCheck: (ctx) => {
      if (!ctx.eventData?.endTime) return { current: 0, target: 1 }
      const hour = getHourUTC8(ctx.eventData.endTime) % 24
      return { current: isEveningTime(hour) ? 1 : 0, target: 1 }
    }
  },
  {
    id: 'city-explorer',
    triggerTypes: ['TERRITORY_CAPTURED'],
    check: (ctx) => ctx.distinctDistrictsCount >= 3,
    progressCheck: (ctx) => ({
      current: Math.min(ctx.distinctDistrictsCount, 3),
      target: 3
    })
  },
  {
    id: 'night-walker',
    triggerTypes: ['RUN_FINISHED'],
    check: (ctx) => {
      if (!ctx.eventData?.endTime) return false
      const hour = getHourUTC8(ctx.eventData.endTime) % 24
      return isNightTime(hour)
    },
    progressCheck: (ctx) => {
      if (!ctx.eventData?.endTime) return { current: 0, target: 1 }
      const hour = getHourUTC8(ctx.eventData.endTime) % 24
      return { current: isNightTime(hour) ? 1 : 0, target: 1 }
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
