export interface AchievementDefinition {
  id: string
  title: string
  description: string
  icon: React.ElementType
  image?: string // Path to badge image in public folder
  category: AchievementCategory
  rarity: AchievementRarity
  maxProgress: number
  rewards: {
    xp?: number
    coins?: number
    title?: string
    badge?: string
  }
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // --- 速度 (Speed) ---
  {
    id: "wind-chaser",
    title: "追风者",
    description: "最高瞬时速度超过 15km/h",
    icon: Wind,
    image: "/badges/badge_wind_chaser_gold.png",
    category: "speed",
    rarity: "epic",
    maxProgress: 1,
    rewards: { xp: 1000, coins: 500 },
  },
  {
    id: "flash",
    title: "闪电侠",
    description: "5公里配速快于 4分00秒",
    icon: Zap,
    image: "/badges/badge_flash.png",
    category: "speed",
    rarity: "legendary",
    maxProgress: 1,
    rewards: { xp: 2000, coins: 1000 },
  },

  // --- 特殊 (Special) ---
  {
    id: "social-star",
    title: "社交达人",
    description: "成功邀请 5 位好友",
    icon: Users,
    image: "/badges/badge_starting_line.png", // Reused as per user data? Or generic. User said "badge_starting_line.png" for social star? That seems odd (starting line usually means run). But I follow the table.
    category: "special",
    rarity: "rare",
    maxProgress: 5,
    rewards: { xp: 500, coins: 250 },
  },
  {
    id: "mysterious",
    title: "神秘人",
    description: "达成隐藏成就",
    icon: Sparkles,
    image: "/badges/mystery-lock.png",
    category: "special",
    rarity: "legendary",
    maxProgress: 1,
    rewards: { xp: 5000, coins: 2000, title: "神秘人" },
  },

  // --- 征服 (Conquest) ---
  {
    id: "landlord",
    title: "大地主",
    description: "同时持有 10 个地块",
    icon: Building,
    image: "/badges/badge_landlord.png",
    category: "conquest",
    rarity: "epic",
    maxProgress: 10,
    rewards: { xp: 800, coins: 400, title: "大地主" },
  },
  {
    id: "first-territory",
    title: "领地先锋",
    description: "成功占领你的第 1 个地块",
    icon: Flag,
    image: "/badges/badge_first_territory.png",
    category: "conquest",
    rarity: "common",
    maxProgress: 1,
    rewards: { xp: 100, coins: 50 },
  },
  {
    id: "territory-raider",
    title: "领地掠夺者",
    description: "累计占领达到 50 个地块",
    icon: Swords,
    image: "/badges/badge_territory_raider.png",
    category: "conquest",
    rarity: "rare",
    maxProgress: 50,
    rewards: { xp: 500, coins: 250 },
  },

  // --- 探索 (Exploration) ---
  {
    id: "city-walker",
    title: "城市漫步者",
    description: "累计行走里程达到 10 公里",
    icon: Footprints,
    image: "/badges/badge_city_walker.png",
    category: "exploration",
    rarity: "common",
    maxProgress: 10,
    rewards: { xp: 200, coins: 100 },
  },
  {
    id: "night-walker",
    title: "夜行者",
    description: "在夜间 (21:00后) 完成一次跑步",
    icon: Moon,
    image: "/badges/badge_night_walker.png",
    category: "exploration",
    rarity: "rare",
    maxProgress: 1,
    rewards: { xp: 300, coins: 150 },
  },
  {
    id: "early-bird",
    title: "早起的鸟儿",
    description: "在清晨 (5:00-7:00) 完成一次跑步",
    icon: Sunrise,
    image: "/badges/badge_early_bird.png",
    category: "exploration",
    rarity: "rare",
    maxProgress: 1,
    rewards: { xp: 300, coins: 150 },
  },
  {
    id: "city-explorer",
    title: "城市探索者",
    description: "累计探索 3 个不同的区域",
    icon: MapPin,
    image: "/badges/badge_city_explorer.png",
    category: "exploration",
    rarity: "epic",
    maxProgress: 3,
    rewards: { xp: 600, coins: 300 },
  },

  // --- 耐力 (Endurance) ---
  {
    id: "shoe-killer",
    title: "跑鞋终结者",
    description: "累计运动距离超过 500 公里",
    icon: Trophy,
    image: "/badges/badge_shoe_killer.png",
    category: "endurance",
    rarity: "legendary",
    maxProgress: 500,
    rewards: { xp: 2000, coins: 1000 },
  },
  {
    id: "100km-club",
    title: "百公里俱乐部",
    description: "累计运动距离超过 100 公里",
    icon: Medal,
    image: "/badges/badge_100km.png",
    category: "endurance",
    rarity: "epic",
    maxProgress: 100,
    rewards: { xp: 1000, coins: 500 },
  },
  {
    id: "marathon-god",
    title: "马拉松之神",
    description: "单次跑步距离超过 42 公里",
    icon: Crown,
    image: "/badges/badge_marathon_god.png",
    category: "endurance",
    rarity: "legendary",
    maxProgress: 42,
    rewards: { xp: 3000, coins: 1500, title: "马拉松之神" },
  },
]

import {
  Footprints,
  Medal,
  Hexagon,
  Crown,
  Swords,
  Users,
  Flame,
  MapPin,
  Target,
  Star,
  Flag,
  Award,
  Eye,
  Map as MapIcon,
  Building,
  Compass,
  Zap,
  Wind,
  Navigation,
  Trophy,
  Axe,
  Skull,
  Sunrise,
  Moon,
  CloudLightning,
  Sparkles,
} from "lucide-react"

export type AchievementCategory = "all" | "speed" | "special" | "conquest" | "exploration" | "endurance"
export type AchievementRarity = "common" | "rare" | "epic" | "legendary"
