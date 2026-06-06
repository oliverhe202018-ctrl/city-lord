/**
 * 功能解锁门控静态配置表
 *
 * 定义哪些功能需要多少级解锁，以及解锁后的行为。
 * 这是后端门控逻辑的数据源，数据库 feature_gates 表的镜像。
 *
 * 设计原则：
 * - 功能标识符使用英文小写+下划线（如 "night_mode"）
 * - 解锁等级从 1 开始递增
 * - 所有字段必须有默认值
 */

export type UnlockRule = {
  /** 功能唯一标识符 */
  featureKey: string
  /** 解锁所需最低等级 */
  minLevel: number
  /** 功能描述 */
  description: string
  /** 是否启用 */
  isActive: boolean
  /** 排序权重（数值越小越靠前） */
  sortOrder: number
  /** 解锁后获得的经验奖励（可选） */
  unlockXpReward?: number
  /** 解锁后获得的金币奖励（可选） */
  unlockCoinReward?: number
}

/**
 * 功能门控静态配置表
 * 与数据库 feature_gates 表保持一致
 */
export const FEATURE_GATES: UnlockRule[] = [
  {
    featureKey: 'map_zoom',
    minLevel: 1,
    description: '地图缩放 - 允许自由缩放查看领地细节',
    isActive: true,
    sortOrder: 1
  },
  {
    featureKey: 'night_mode',
    minLevel: 3,
    description: '夜间模式 - 解锁夜间领地查看功能',
    isActive: true,
    sortOrder: 2,
    unlockXpReward: 50
  },
  {
    featureKey: 'weekly_report',
    minLevel: 5,
    description: '周度报告 - 查看每周领地统计报告',
    isActive: true,
    sortOrder: 3,
    unlockXpReward: 100
  },
  {
    featureKey: 'club_join',
    minLevel: 7,
    description: '加入社团 - 解锁社团加入与创建功能',
    isActive: true,
    sortOrder: 4,
    unlockXpReward: 200
  },
  {
    featureKey: 'challenge_create',
    minLevel: 10,
    description: '创建挑战 - 解锁创建挑战任务功能',
    isActive: true,
    sortOrder: 5,
    unlockXpReward: 300
  },
  {
    featureKey: 'buff_store',
    minLevel: 15,
    description: '增益商店 - 解锁增益效果商店',
    isActive: true,
    sortOrder: 6,
    unlockXpReward: 500
  },
  {
    featureKey: 'night_run',
    minLevel: 10,
    description: '夜间跑步 - 解锁夜间跑步经验加倍',
    isActive: true,
    sortOrder: 7,
    unlockXpReward: 250
  },
  {
    featureKey: 'random_event',
    minLevel: 8,
    description: '随机事件 - 解锁地图上随机事件触发',
    isActive: true,
    sortOrder: 8,
    unlockXpReward: 150
  },
  {
    featureKey: 'mission_daily',
    minLevel: 2,
    description: '每日任务 - 解锁每日任务系统',
    isActive: true,
    sortOrder: 9,
    unlockXpReward: 80
  },
  {
    featureKey: 'mission_weekly',
    minLevel: 12,
    description: '每周任务 - 解锁每周任务系统',
    isActive: true,
    sortOrder: 10,
    unlockXpReward: 400
  },
  {
    featureKey: 'achievement_show',
    minLevel: 6,
    description: '成就展示 - 解锁成就系统展示',
    isActive: true,
    sortOrder: 11,
    unlockXpReward: 120
  },
  {
    featureKey: 'leaderboard',
    minLevel: 4,
    description: '排行榜 - 解锁全服排行榜查看',
    isActive: true,
    sortOrder: 12,
    unlockXpReward: 150
  },
  {
    featureKey: 'stamina_max_up',
    minLevel: 20,
    description: '耐力上限提升 - 解锁耐力上限升级',
    isActive: true,
    sortOrder: 13,
    unlockXpReward: 600
  },
  {
    featureKey: 'faction_change',
    minLevel: 18,
    description: '阵营切换 - 解锁阵营自由切换',
    isActive: true,
    sortOrder: 14,
    unlockXpReward: 500
  },
  {
    featureKey: 'territory_attack',
    minLevel: 25,
    description: '领地攻击 - 解锁攻击其他用户领地',
    isActive: true,
    sortOrder: 15,
    unlockXpReward: 800
  },
  {
    featureKey: 'map_3d',
    minLevel: 30,
    description: '3D 地图 - 解锁 3D 地图视图',
    isActive: true,
    sortOrder: 16,
    unlockXpReward: 1000
  },
  {
    featureKey: 'club_war',
    minLevel: 25,
    description: '社团战争 - 解锁社团战争功能',
    isActive: true,
    sortOrder: 17,
    unlockXpReward: 1200
  },
  {
    featureKey: 'special_event',
    minLevel: 35,
    description: '特殊事件 - 解锁稀有特殊事件触发',
    isActive: true,
    sortOrder: 18,
    unlockXpReward: 1500
  },
  {
    featureKey: 'city_lord_mode',
    minLevel: 50,
    description: '城市领主模式 - 解锁城市领主专属功能',
    isActive: true,
    sortOrder: 19,
    unlockXpReward: 2000
  },
  {
    featureKey: 'max_zoom',
    minLevel: 40,
    description: '最大缩放 - 解锁地图最大缩放级别',
    isActive: true,
    sortOrder: 20,
    unlockXpReward: 1800
  }
]

/**
 * 获取所有已解锁的功能标识符列表
 */
export function getUnlockedFeatures(userLevel: number): string[] {
  return FEATURE_GATES
    .filter(gate => gate.isActive && userLevel >= gate.minLevel)
    .map(gate => gate.featureKey)
}

/**
 * 获取所有未解锁的功能（用于前端展示待解锁功能）
 */
export function getLockedFeatures(userLevel: number): UnlockRule[] {
  return FEATURE_GATES
    .filter(gate => gate.isActive && userLevel < gate.minLevel)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * 获取指定功能门控的详细信息
 */
export function getGateByFeatureKey(featureKey: string): UnlockRule | undefined {
  return FEATURE_GATES.find(gate => gate.featureKey === featureKey)
}
