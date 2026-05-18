/**
 * Badge Target Constants
 *
 * All badge target values defined here for centralized management.
 * These values can later be moved to database config table if needed.
 */

export const BADGE_TARGETS = {
  firstMission: 1,
  missionMaster: 10, // 完成 10 个任务
  firstTerritory: 1,
  landlord: 10, // 拥有 10 个领地
  territoryRaider: 50, // 历史攻占 50 个领地
  level10: 10,
  level50: 50,
  earlyBird: 1,
  nightWalker: 1,
  shoeKiller: 500, // 总跑步距离 500 公里
  clubFounder: 1,
  clubRecruiter: 5, // 招募 5 名成员
  cityExplorer: 3, // 探索 3 个区域
  continuousCheckin: 7, // 连续 7 天跑步
  speedDemon: 4, // 4 分钟配速
  marathonGod: 42, // 马拉松 42 公里
} as const;
