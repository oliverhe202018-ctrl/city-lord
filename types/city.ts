/**
 * 城市相关类型定义
 * 用于多城市系统的基础数据结构
 */

/**
 * 城市接口
 */
export interface City {
  /** 唯一标识符 */
  id: string
  /** 行政区划代码 */
  adcode: string
  /** 城市名称 */
  name: string
  /** 拼音 */
  pinyin: string
  /** 缩写 */
  abbr: string
  /** 城市中心坐标（经度，纬度） */
  coordinates: {
    lat: number
    lng: number
  }
  /** 城市边界范围 */
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }
  /** 主题色配置 */
  theme: {
    primary: string
    secondary: string
    accent: string
    glow: string
  }
  /** 主题色配置 */
  themeColors: {
    primary: string;
    secondary: string;
  };
  /** 赛季状态 */
  seasonStatus: {
    currentSeason: number
    startDate: string
    endDate: string
    isActive: boolean
  }
  /** 城市统计数据 */
  stats: {
    /** 总占领面积（单位：平方公里） */
    totalArea: number
    /** 参与玩家数量 */
    totalPlayers: number
    /** 活跃玩家数量 */
    activePlayers: number
    /** 六边形总数量 */
    totalTiles: number
    /** 已占领数量 */
    capturedTiles: number
  }
  /** 城市图标/缩略图 */
  icon?: string
  /** 城市描述 */
  description?: string
  /** 下属区县 */
  districts?: District[]
}

/**
 * 区县接口
 */
export interface District {
  /** 唯一标识符 */
  id: string
  /** 行政区划代码 */
  adcode: string
  /** 区县名称 */
  name: string
  /** 中心坐标 */
  center: string | number[]
}

/**
 * 挑战任务接口
 */
export interface Challenge {
  /** 任务唯一标识符 */
  id: string
  /** 城市ID */
  cityId: string
  /** 任务名称 */
  name: string
  /** 任务描述 */
  description: string
  /** 任务类型 */
  type: 'conquest' | 'defense' | 'exploration' | 'social' | 'daily'
  /** 任务目标 */
  objective: {
    type: 'tiles' | 'area' | 'time' | 'friends' | 'logins'
    target: number
    current?: number
  }
  /** 奖励配置 */
  rewards: {
    experience: number
    points: number
    items?: string[]
  }
  /** 任务状态 */
  status: 'available' | 'in_progress' | 'completed' | 'expired'
  /** 开始时间 */
  startDate: string
  /** 结束时间 */
  endDate: string
  /** 优先级（数字越大优先级越高） */
  priority: number
  /** 是否为限时任务 */
  isTimeLimited: boolean
  /** 是否为主线任务 */
  isMainQuest: boolean
}

/**
 * 成就接口
 */
export interface Achievement {
  /** 成就唯一标识符 */
  id: string
  /** 成就所属城市ID（空表示全局成就） */
  cityId?: string
  /** 成就名称 */
  name: string
  /** 成就描述 */
  description: string
  /** 成就类型 */
  type: 'milestone' | 'collection' | 'dominance' | 'social' | 'special'
  /** 成就等级/星级 */
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  /** 完成条件 */
  conditions: {
    type: 'tiles_captured' | 'area_controlled' | 'cities_visited' | 'friends_count' | 'consecutive_days'
    threshold: number
  }
  /** 奖励配置 */
  rewards: {
    title?: string
    badge: string
    experience: number
    points: number
  }
  /** 完成状态 */
  isCompleted: boolean
  /** 完成时间 */
  completedAt?: string
  /** 进度（可选） */
  progress?: {
    current: number
    max: number
  }
  /** 成就图标 */
  icon?: string
}

/**
 * 用户城市进度接口
 */
export interface UserCityProgress {
  /** 用户ID */
  userId: string
  /** 城市ID */
  cityId: string
  /** 用户等级 */
  level: number
  /** 经验值 */
  experience: number
  /** 当前经验进度 */
  experienceProgress: {
    current: number
    max: number
  }
  /** 该城市占领的六边形数量 */
  tilesCaptured: number
  /** 该城市占领的总面积 */
  areaControlled: number
  /** 排行榜排名 */
  ranking: number
  /** 城市声望点数 */
  reputation: number
  /** 已完成的挑战ID列表 */
  completedChallenges: string[]
  /** 已解锁的成就ID列表 */
  unlockedAchievements: string[]
  /** 最后活跃时间 */
  lastActiveAt: string
  /** 加入该城市时间 */
  joinedAt: string
}

/**
 * 城市切换历史接口
 */
export interface CitySwitchHistory {
  /** 原城市ID */
  fromCityId: string
  /** 目标城市ID */
  toCityId: string
  /** 切换时间 */
  timestamp: string
  /** 切换原因 */
  reason?: 'user_selection' | 'challenge' | 'invitation' | 'season_change'
}

/**
 * 城市排行榜条目接口
 */
export interface CityLeaderboardEntry {
  /** 排名 */
  rank: number
  /** 用户ID */
  userId: string
  /** 用户昵称 */
  username: string
  /** 头像URL */
  avatar?: string
  /** 占领面积 */
  area: number
  /** 占领六边形数量 */
  tiles: number
  /** 等级 */
  level: number
  /** 与上一排名的差距（可选） */
  delta?: number
}
