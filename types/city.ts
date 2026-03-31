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
  /** 省份 */
  province?: string
  /** 行政级别 */
  level?: 'province' | 'city' | 'district' | 'county'
  /** 父级城市代码 */
  parentAdcode?: string
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
  /** 领地列表 (可选，通常在详情接口返回) */
  territories?: Territory[]
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
 * 领地信息接口
 */
export interface Territory {
  id: string // UUID or slug territory identifier
  cityId: string
  ownerId: string | null
  /** @deprecated 仅供旧页面兼容，新地图渲染不得再以 ownerType 作为主输入 */
  ownerType: 'me' | 'enemy' | 'neutral' // Computed on client or returned by API
  capturedAt?: string | null
  health?: number // 0-1000  (deprecated, use current_hp)
  maxHealth?: number // 1000 (deprecated, use max_hp)
  current_hp?: number;
  max_hp?: number;
  score_weight?: number;
  territory_type?: string;
  geojson_json?: any; // The polygon data from PostGIS
  lastMaintainedAt?: string
  isHotZone?: boolean // 7天内 owner_change_count >= 2
  ownerChangeCount?: number
  // Optional display properties
  path?: [number, number][] // Polygon coordinates for map rendering
  color?: string
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
  type: 'milestone' | 'collection' | 'dominance' | 'social' | 'special' | 'speed' | 'conquest' | 'exploration' | 'endurance'
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

// ============================================================================
// 地图领地显示重构 Phase 1 新增类型定义
// ============================================================================

/**
 * 客观实体（后端返回的扩充数据）
 */
export interface ExtTerritory extends Territory {
  ownerClubId?: string | null;
  ownerFaction?: string | null;
  ownerClub?: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
}

/**
 * 地图展示主语（用来决定当前渲染的主题焦点）
 * individual: 个人争霸（我 vs 散人）
 * club: 俱乐部争霸
 * faction: 阵营战
 */
export type TerritorySubject = 'individual' | 'club' | 'faction';

/**
 * 极简关系（第一阶段不引入 ally）
 */
export type TerritoryRelation = 'self' | 'enemy' | 'neutral';

/**
 * 最终供给表现层消费的渲染包装属性
 */
export interface TerritoryRenderStyle {
  relation: TerritoryRelation;
  subject: TerritorySubject;
  baseColor: string;     // rgba() 基础阵营/个人底色
  topColor: string;      // RGB 六角形顶色（已融入 health 混色的最终结果）
  sideColor: string;     // RGB 侧面颜色（已融入 health 混色的最终结果）
  fillColor2D: string;   // 供给 2D (TerritoryLayer) 专用的填充色
  strokeColor2D: string; // 供给 2D 的描边色
  heightScale: number;   // 基于真实 (health / maxHealth) 计算的高低比例
  isDamaged: boolean;    // 是否处于受损状态 (供外部快捷调用)
  isCritical: boolean;   // 是否处于极危状态 (供外部快捷调用)
}

/**
 * 视图上下文，用于决定一整个画面的主题与当前观测者身份
 */
export interface ViewContext {
  userId?: string | null;
  clubId?: string | null;
  faction?: string | null;
  subject: TerritorySubject;
}
