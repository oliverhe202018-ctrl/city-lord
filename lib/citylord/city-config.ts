/**
 * City Configuration System
 * Defines city themes, challenges, achievements, and localization
 */

// ============================================================
// Localization Types
// ============================================================

export type Language = "zh" | "en"

export interface LocalizedText {
  zh: string
  en: string
}

// ============================================================
// City Theme Configuration
// ============================================================

export interface CityTheme {
  id: string
  name: LocalizedText
  icon: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  gradientFrom: string
  gradientTo: string
  mapStyle: "cyberpunk" | "nature" | "classic" | "neon"
  landmark: string
  description: LocalizedText
}

export const CITY_THEMES: Record<string, CityTheme> = {
  beijing: {
    id: "beijing",
    name: { zh: "北京", en: "Beijing" },
    icon: "🏛️",
    primaryColor: "#dc2626", // Red - Imperial
    secondaryColor: "#fbbf24", // Gold
    accentColor: "#f97316",
    gradientFrom: "#dc2626",
    gradientTo: "#f97316",
    mapStyle: "classic",
    landmark: "故宫",
    description: {
      zh: "千年古都，现代都市",
      en: "Ancient capital, modern metropolis",
    },
  },
  shanghai: {
    id: "shanghai",
    name: { zh: "上海", en: "Shanghai" },
    icon: "🌆",
    primaryColor: "#3b82f6", // Blue - Modern
    secondaryColor: "#06b6d4", // Cyan
    accentColor: "#8b5cf6",
    gradientFrom: "#3b82f6",
    gradientTo: "#8b5cf6",
    mapStyle: "neon",
    landmark: "东方明珠",
    description: {
      zh: "魔都风华，璀璨不夜城",
      en: "The dazzling city that never sleeps",
    },
  },
  chengdu: {
    id: "chengdu",
    name: { zh: "成都", en: "Chengdu" },
    icon: "🐼",
    primaryColor: "#22c55e", // Green - Nature
    secondaryColor: "#84cc16", // Lime
    accentColor: "#14b8a6",
    gradientFrom: "#22c55e",
    gradientTo: "#14b8a6",
    mapStyle: "nature",
    landmark: "宽窄巷子",
    description: {
      zh: "天府之国，休闲之都",
      en: "Land of abundance, city of leisure",
    },
  },
  guangzhou: {
    id: "guangzhou",
    name: { zh: "广州", en: "Guangzhou" },
    icon: "🌺",
    primaryColor: "#f43f5e", // Rose - Vibrant
    secondaryColor: "#ec4899", // Pink
    accentColor: "#f97316",
    gradientFrom: "#f43f5e",
    gradientTo: "#f97316",
    mapStyle: "cyberpunk",
    landmark: "广州塔",
    description: {
      zh: "花城绽放，活力无限",
      en: "City of flowers, boundless vitality",
    },
  },
  shenzhen: {
    id: "shenzhen",
    name: { zh: "深圳", en: "Shenzhen" },
    icon: "🚀",
    primaryColor: "#6366f1", // Indigo - Tech
    secondaryColor: "#8b5cf6", // Violet
    accentColor: "#06b6d4",
    gradientFrom: "#6366f1",
    gradientTo: "#06b6d4",
    mapStyle: "cyberpunk",
    landmark: "平安金融中心",
    description: {
      zh: "创新之城，科技先锋",
      en: "City of innovation, tech pioneer",
    },
  },
  hangzhou: {
    id: "hangzhou",
    name: { zh: "杭州", en: "Hangzhou" },
    icon: "🏞️",
    primaryColor: "#0d9488", // Teal - Water
    secondaryColor: "#22c55e", // Green
    accentColor: "#0ea5e9",
    gradientFrom: "#0d9488",
    gradientTo: "#0ea5e9",
    mapStyle: "nature",
    landmark: "西湖",
    description: {
      zh: "人间天堂，数字之城",
      en: "Heaven on earth, digital city",
    },
  },
}

// ============================================================
// City Challenge Configuration
// ============================================================

export type ChallengeDifficulty = "easy" | "medium" | "hard" | "legendary"
export type ChallengeStatus = "locked" | "available" | "active" | "completed"

export interface CityChallenge {
  id: string
  cityId: string
  title: LocalizedText
  description: LocalizedText
  rules: LocalizedText[]
  difficulty: ChallengeDifficulty
  duration: number // in hours
  requirements: {
    minLevel?: number
    prerequisiteChallenge?: string
  }
  goals: {
    type: "distance" | "area" | "hexes" | "streak" | "speed"
    target: number
    unit: LocalizedText
  }[]
  rewards: {
    xp: number
    coins: number
    badge?: LocalizedText
    title?: LocalizedText
  }
  seasonOnly: boolean
  startDate?: string
  endDate?: string
}

export const CITY_CHALLENGES: CityChallenge[] = [
  // Beijing Challenges
  {
    id: "bj-imperial-run",
    cityId: "beijing",
    title: { zh: "皇城跑者", en: "Imperial Runner" },
    description: {
      zh: "穿越历史的长廊，征服二环内的领地",
      en: "Run through history, conquer territories within the 2nd Ring",
    },
    rules: [
      { zh: "必须在二环内完成", en: "Must be completed within 2nd Ring Road" },
      { zh: "连续7天参与", en: "Participate for 7 consecutive days" },
    ],
    difficulty: "medium",
    duration: 168,
    requirements: { minLevel: 5 },
    goals: [
      { type: "area", target: 10000, unit: { zh: "平方米", en: "m²" } },
      { type: "streak", target: 7, unit: { zh: "天", en: "days" } },
    ],
    rewards: { xp: 500, coins: 200, badge: { zh: "皇城卫士", en: "Imperial Guardian" } },
    seasonOnly: false,
  },
  {
    id: "bj-olympic-spirit",
    cityId: "beijing",
    title: { zh: "奥运精神", en: "Olympic Spirit" },
    description: {
      zh: "在奥林匹克公园区域完成马拉松距离",
      en: "Complete marathon distance in Olympic Park area",
    },
    rules: [
      { zh: "限奥林匹克公园区域", en: "Limited to Olympic Park area" },
      { zh: "单次跑步不少于5公里", en: "Single run must be at least 5km" },
    ],
    difficulty: "hard",
    duration: 336,
    requirements: { minLevel: 10 },
    goals: [{ type: "distance", target: 42.195, unit: { zh: "公里", en: "km" } }],
    rewards: {
      xp: 1000,
      coins: 500,
      title: { zh: "奥运之光", en: "Olympic Light" },
    },
    seasonOnly: true,
  },
  // Shanghai Challenges
  {
    id: "sh-bund-master",
    cityId: "shanghai",
    title: { zh: "外滩霸主", en: "Bund Master" },
    description: {
      zh: "征服外滩沿线的所有领地",
      en: "Conquer all territories along the Bund",
    },
    rules: [
      { zh: "沿外滩线路跑步", en: "Run along the Bund route" },
      { zh: "至少占领20个六边形", en: "Capture at least 20 hexagons" },
    ],
    difficulty: "medium",
    duration: 72,
    requirements: { minLevel: 3 },
    goals: [{ type: "hexes", target: 20, unit: { zh: "个领地", en: "territories" } }],
    rewards: { xp: 300, coins: 150, badge: { zh: "外滩之王", en: "King of Bund" } },
    seasonOnly: false,
  },
  {
    id: "sh-speed-demon",
    cityId: "shanghai",
    title: { zh: "魔都飞人", en: "Shanghai Speed Demon" },
    description: {
      zh: "以惊人的配速征服这座城市",
      en: "Conquer the city with amazing pace",
    },
    rules: [
      { zh: "平均配速需低于5分钟/公里", en: "Average pace must be under 5min/km" },
      { zh: "单次跑步至少3公里", en: "Single run at least 3km" },
    ],
    difficulty: "hard",
    duration: 168,
    requirements: { minLevel: 8 },
    goals: [
      { type: "speed", target: 300, unit: { zh: "秒/公里", en: "sec/km" } },
      { type: "distance", target: 30, unit: { zh: "公里", en: "km" } },
    ],
    rewards: { xp: 800, coins: 400, title: { zh: "极速闪电", en: "Lightning Fast" } },
    seasonOnly: false,
  },
  // Chengdu Challenges
  {
    id: "cd-panda-explorer",
    cityId: "chengdu",
    title: { zh: "熊猫探险家", en: "Panda Explorer" },
    description: {
      zh: "探索成都的绿道系统，像熊猫一样悠闲又坚定",
      en: "Explore Chengdu's greenway system, leisurely yet determined like a panda",
    },
    rules: [
      { zh: "需在绿道区域完成", en: "Must be completed in greenway areas" },
      { zh: "每次跑步至少2公里", en: "Each run at least 2km" },
    ],
    difficulty: "easy",
    duration: 168,
    requirements: { minLevel: 1 },
    goals: [{ type: "distance", target: 20, unit: { zh: "公里", en: "km" } }],
    rewards: { xp: 200, coins: 100, badge: { zh: "熊猫守护者", en: "Panda Guardian" } },
    seasonOnly: false,
  },
  // Guangzhou Challenges
  {
    id: "gz-flower-city",
    cityId: "guangzhou",
    title: { zh: "花城绽放", en: "Flower City Bloom" },
    description: {
      zh: "在花城广场周边展示你的跑步实力",
      en: "Show your running prowess around Flower City Square",
    },
    rules: [
      { zh: "花城广场3公里范围内", en: "Within 3km of Flower City Square" },
      { zh: "连续5天完成挑战", en: "Complete challenge for 5 consecutive days" },
    ],
    difficulty: "medium",
    duration: 120,
    requirements: { minLevel: 4 },
    goals: [
      { type: "area", target: 15000, unit: { zh: "平方米", en: "m²" } },
      { type: "streak", target: 5, unit: { zh: "天", en: "days" } },
    ],
    rewards: { xp: 400, coins: 200, badge: { zh: "花城使者", en: "Flower City Ambassador" } },
    seasonOnly: false,
  },
]

// ============================================================
// City Achievement Configuration
// ============================================================

export type AchievementRarity = "common" | "rare" | "epic" | "legendary"

export interface CityAchievement {
  id: string
  cityId: string
  title: LocalizedText
  description: LocalizedText
  icon: string
  rarity: AchievementRarity
  requirements: {
    type: "distance" | "area" | "challenges" | "streak" | "rank"
    target: number
  }
  rewards: {
    xp: number
    coins: number
    title?: LocalizedText
    avatarFrame?: string
  }
}

export const CITY_ACHIEVEMENTS: CityAchievement[] = [
  // Beijing
  {
    id: "bj-first-step",
    cityId: "beijing",
    title: { zh: "北京初探", en: "Beijing First Steps" },
    description: { zh: "在北京完成首次跑步", en: "Complete your first run in Beijing" },
    icon: "🏛️",
    rarity: "common",
    requirements: { type: "distance", target: 1 },
    rewards: { xp: 50, coins: 25 },
  },
  {
    id: "bj-city-lord",
    cityId: "beijing",
    title: { zh: "北京城主", en: "Beijing City Lord" },
    description: {
      zh: "在北京占领超过100,000平方米领地",
      en: "Capture over 100,000m² territory in Beijing",
    },
    icon: "👑",
    rarity: "legendary",
    requirements: { type: "area", target: 100000 },
    rewards: {
      xp: 2000,
      coins: 1000,
      title: { zh: "北京城主", en: "Lord of Beijing" },
      avatarFrame: "imperial-gold",
    },
  },
  // Shanghai
  {
    id: "sh-first-step",
    cityId: "shanghai",
    title: { zh: "魔都初探", en: "Shanghai First Steps" },
    description: { zh: "在上海完成首次跑步", en: "Complete your first run in Shanghai" },
    icon: "🌆",
    rarity: "common",
    requirements: { type: "distance", target: 1 },
    rewards: { xp: 50, coins: 25 },
  },
  {
    id: "sh-neon-runner",
    cityId: "shanghai",
    title: { zh: "霓虹跑者", en: "Neon Runner" },
    description: {
      zh: "在上海完成50公里夜跑",
      en: "Complete 50km night runs in Shanghai",
    },
    icon: "🌃",
    rarity: "epic",
    requirements: { type: "distance", target: 50 },
    rewards: {
      xp: 800,
      coins: 400,
      title: { zh: "霓虹闪电", en: "Neon Lightning" },
    },
  },
  // Chengdu
  {
    id: "cd-first-step",
    cityId: "chengdu",
    title: { zh: "蓉城初探", en: "Chengdu First Steps" },
    description: { zh: "在成都完成首次跑步", en: "Complete your first run in Chengdu" },
    icon: "🐼",
    rarity: "common",
    requirements: { type: "distance", target: 1 },
    rewards: { xp: 50, coins: 25 },
  },
  {
    id: "cd-greenway-master",
    cityId: "chengdu",
    title: { zh: "绿道大师", en: "Greenway Master" },
    description: {
      zh: "在成都绿道系统跑步超过100公里",
      en: "Run over 100km on Chengdu greenway system",
    },
    icon: "🌿",
    rarity: "epic",
    requirements: { type: "distance", target: 100 },
    rewards: {
      xp: 1000,
      coins: 500,
      title: { zh: "绿道行者", en: "Greenway Walker" },
    },
  },
  // Guangzhou
  {
    id: "gz-first-step",
    cityId: "guangzhou",
    title: { zh: "花城初探", en: "Guangzhou First Steps" },
    description: { zh: "在广州完成首次跑步", en: "Complete your first run in Guangzhou" },
    icon: "🌺",
    rarity: "common",
    requirements: { type: "distance", target: 1 },
    rewards: { xp: 50, coins: 25 },
  },
  {
    id: "gz-canton-champion",
    cityId: "guangzhou",
    title: { zh: "羊城冠军", en: "Canton Champion" },
    description: {
      zh: "在广州排行榜进入前10名",
      en: "Reach top 10 on Guangzhou leaderboard",
    },
    icon: "🏆",
    rarity: "legendary",
    requirements: { type: "rank", target: 10 },
    rewards: {
      xp: 1500,
      coins: 750,
      title: { zh: "羊城之王", en: "King of Canton" },
      avatarFrame: "flower-crown",
    },
  },
]

// ============================================================
// City Season Configuration
// ============================================================

export interface CitySeason {
  id: string
  cityId: string
  name: LocalizedText
  startDate: string
  endDate: string
  theme: LocalizedText
  bonusMultiplier: number
  specialEvents: {
    name: LocalizedText
    startDate: string
    endDate: string
    bonus: string
  }[]
}

export const CURRENT_SEASONS: CitySeason[] = [
  {
    id: "bj-s4",
    cityId: "beijing",
    name: { zh: "北京 第四赛季", en: "Beijing Season 4" },
    startDate: "2025-01-01",
    endDate: "2025-03-31",
    theme: { zh: "新春争霸", en: "Spring Festival Championship" },
    bonusMultiplier: 1.5,
    specialEvents: [
      {
        name: { zh: "双倍经验周", en: "Double XP Week" },
        startDate: "2025-01-25",
        endDate: "2025-02-02",
        bonus: "2x XP",
      },
    ],
  },
  {
    id: "sh-s4",
    cityId: "shanghai",
    name: { zh: "上海 第四赛季", en: "Shanghai Season 4" },
    startDate: "2025-01-01",
    endDate: "2025-03-31",
    theme: { zh: "霓虹争霸", en: "Neon Championship" },
    bonusMultiplier: 1.5,
    specialEvents: [
      {
        name: { zh: "城市领主争夺战", en: "City Lord Battle" },
        startDate: "2025-02-01",
        endDate: "2025-02-07",
        bonus: "3x Territory Points",
      },
    ],
  },
]

// ============================================================
// Utility Functions
// ============================================================

export function getCityTheme(cityId: string): CityTheme | undefined {
  return CITY_THEMES[cityId]
}

export function getCityChallenges(cityId: string): CityChallenge[] {
  return CITY_CHALLENGES.filter((c) => c.cityId === cityId)
}

export function getCityAchievements(cityId: string): CityAchievement[] {
  return CITY_ACHIEVEMENTS.filter((a) => a.cityId === cityId)
}

export function getCurrentSeason(cityId: string): CitySeason | undefined {
  const now = new Date()
  return CURRENT_SEASONS.find(
    (s) => s.cityId === cityId && new Date(s.startDate) <= now && new Date(s.endDate) >= now
  )
}

export function getLocalizedText(text: LocalizedText, lang: Language): string {
  return text[lang] || text.zh
}

export function getDifficultyColor(difficulty: ChallengeDifficulty): string {
  const colors: Record<ChallengeDifficulty, string> = {
    easy: "text-green-400",
    medium: "text-yellow-400",
    hard: "text-orange-400",
    legendary: "text-purple-400",
  }
  return colors[difficulty]
}

export function getDifficultyBgColor(difficulty: ChallengeDifficulty): string {
  const colors: Record<ChallengeDifficulty, string> = {
    easy: "bg-green-400/20",
    medium: "bg-yellow-400/20",
    hard: "bg-orange-400/20",
    legendary: "bg-purple-400/20",
  }
  return colors[difficulty]
}

export function getRarityColor(rarity: AchievementRarity): string {
  const colors: Record<AchievementRarity, string> = {
    common: "text-gray-400",
    rare: "text-blue-400",
    epic: "text-purple-400",
    legendary: "text-yellow-400",
  }
  return colors[rarity]
}

export function getRarityBgColor(rarity: AchievementRarity): string {
  const colors: Record<AchievementRarity, string> = {
    common: "bg-gray-400/20",
    rare: "bg-blue-400/20",
    epic: "bg-purple-400/20",
    legendary: "bg-yellow-400/20",
  }
  return colors[rarity]
}
