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
} from "lucide-react"

export type AchievementCategory = "all" | "running" | "territory" | "social" | "special"
export type AchievementRarity = "common" | "rare" | "epic" | "legendary"

export interface AchievementDefinition {
  id: string
  title: string
  description: string
  icon: React.ElementType
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
  {
    id: "1",
    title: "初出茅庐",
    description: "完成你的第一次跑步",
    icon: Footprints,
    category: "running",
    rarity: "common",
    maxProgress: 1,
    rewards: { xp: 50, coins: 20 },
  },
  {
    id: "2",
    title: "马拉松英雄",
    description: "累计跑步距离达到42.195公里",
    icon: Medal,
    category: "running",
    rarity: "epic",
    maxProgress: 42,
    rewards: { xp: 500, coins: 200, badge: "马拉松徽章" },
  },
  {
    id: "3",
    title: "领地先锋",
    description: "占领超过 2,600 m² 的领地",
    icon: Hexagon,
    category: "territory",
    rarity: "common",
    maxProgress: 2600,
    rewards: { xp: 100, coins: 50 },
  },
  {
    id: "4",
    title: "城市霸主",
    description: "同时拥有超过 130,000 m² (0.13 km²) 的领地",
    icon: Crown,
    category: "territory",
    rarity: "legendary",
    maxProgress: 130000,
    rewards: { xp: 2000, coins: 1000, title: "城市霸主", badge: "王冠徽章" },
  },
  {
    id: "5",
    title: "战斗大师",
    description: "赢得100场领地争夺战",
    icon: Swords,
    category: "territory",
    rarity: "rare",
    maxProgress: 100,
    rewards: { xp: 300, coins: 150 },
  },
  {
    id: "6",
    title: "社交达人",
    description: "添加20个好友",
    icon: Users,
    category: "social",
    rarity: "rare",
    maxProgress: 20,
    rewards: { xp: 200, coins: 100 },
  },
  {
    id: "7",
    title: "连续7天",
    description: "连续7天完成跑步",
    icon: Flame,
    category: "running",
    rarity: "rare",
    maxProgress: 7,
    rewards: { xp: 250, badge: "火焰徽章" },
  },
  {
    id: "8",
    title: "探险家",
    description: "探索50%的地图迷雾",
    icon: MapPin,
    category: "territory",
    rarity: "epic",
    maxProgress: 50,
    rewards: { xp: 400, coins: 200, title: "探险家" },
  },
  {
    id: "9",
    title: "挑战之王",
    description: "完成50次好友挑战",
    icon: Target,
    category: "social",
    rarity: "epic",
    maxProgress: 50,
    rewards: { xp: 500, coins: 250, badge: "挑战者徽章" },
  },
  {
    id: "10",
    title: "创世先驱",
    description: "成为前1000名注册用户",
    icon: Star,
    category: "special",
    rarity: "legendary",
    maxProgress: 1,
    rewards: { xp: 1000, coins: 500, title: "创世先驱", badge: "创世徽章" },
  },
]
