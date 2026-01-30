import type { City, UserCityProgress, CitySwitchHistory, Challenge, Achievement } from "@/types/city";
import { baseCities } from "@/data/cities";
import { hydrateCity } from "@/lib/city-utils";

// Custom overrides for the original demo cities to keep them looking special
const cityOverrides: Record<string, Partial<City>> = {
  beijing: {
    description: "千年古都，现代都市",
    icon: "🏛️",
    theme: { primary: "#dc2626", secondary: "#fbbf24", accent: "#f97316", glow: "#dc2626" },
    themeColors: { primary: "#dc2626", secondary: "#fbbf24" },
    stats: { totalArea: 16410, totalPlayers: 12500, activePlayers: 8500, totalTiles: 5000, capturedTiles: 3200 },
  },
  shanghai: {
    description: "魔都风华，璀璨不夜城",
    icon: "🌆",
    theme: { primary: "#3b82f6", secondary: "#06b6d4", accent: "#8b5cf6", glow: "#3b82f6" },
    themeColors: { primary: "#3b82f6", secondary: "#06b6d4" },
    stats: { totalArea: 6340, totalPlayers: 9800, activePlayers: 6700, totalTiles: 3800, capturedTiles: 2400 },
  },
  chengdu: {
    description: "天府之国，休闲之都",
    icon: "🐼",
    theme: { primary: "#22c55e", secondary: "#84cc16", accent: "#14b8a6", glow: "#22c55e" },
    themeColors: { primary: "#22c55e", secondary: "#84cc16" },
    stats: { totalArea: 14335, totalPlayers: 8200, activePlayers: 5100, totalTiles: 4200, capturedTiles: 2100 },
  },
  guangzhou: {
    description: "花城绽放，活力无限",
    icon: "🌺",
    theme: { primary: "#f43f5e", secondary: "#ec4899", accent: "#f97316", glow: "#f43f5e" },
    themeColors: { primary: "#f43f5e", secondary: "#ec4899" },
    stats: { totalArea: 7434, totalPlayers: 9100, activePlayers: 6200, totalTiles: 3900, capturedTiles: 2800 },
  },
  shenzhen: {
    description: "创新之城，科技先锋",
    icon: "🚀",
    theme: { primary: "#6366f1", secondary: "#8b5cf6", accent: "#06b6d4", glow: "#6366f1" },
    themeColors: { primary: "#6366f1", secondary: "#8b5cf6" },
    stats: { totalArea: 1997, totalPlayers: 10500, activePlayers: 7800, totalTiles: 3500, capturedTiles: 2600 },
  },
  hangzhou: {
    description: "人间天堂，数字之城",
    icon: "🏞️",
    theme: { primary: "#0d9488", secondary: "#22c55e", accent: "#0ea5e9", glow: "#0d9488" },
    themeColors: { primary: "#0d9488", secondary: "#22c55e" },
    stats: { totalArea: 16850, totalPlayers: 7600, activePlayers: 4800, totalTiles: 4100, capturedTiles: 2300 },
  },
};

// Generate the full list of cities
export const cities: City[] = baseCities.map((base) => {
  const city = hydrateCity(base);
  const override = cityOverrides[city.id];
  if (override) {
    return { ...city, ...override };
  }
  return city;
});

export const userCityProgress: UserCityProgress[] = cities.map((city) => ({
  userId: "user-1",
  cityId: city.id,
  level: 1,
  experience: 0,
  experienceProgress: { current: 0, max: 100 },
  tilesCaptured: 0,
  areaControlled: 0,
  ranking: 0,
  reputation: 0,
  completedChallenges: [],
  unlockedAchievements: [],
  lastActiveAt: new Date().toISOString(),
  joinedAt: new Date().toISOString(),
}));

export const citySwitchHistory: CitySwitchHistory[] = [
  { fromCityId: "beijing", toCityId: "beijing", timestamp: new Date("2023-10-01T10:00:00Z").toISOString(), reason: "user_selection" },
  { fromCityId: "beijing", toCityId: "shanghai", timestamp: new Date("2023-10-15T14:30:00Z").toISOString(), reason: "user_selection" },
];

export const getAllCities = (): City[] => {
  return cities;
};

export const getCityById = (id: string): City | undefined => {
  return cities.find((city) => city.id === id);
};

export const getCityByAdcode = (adcode: string): City | undefined => {
  for (const city of cities) {
    if (city.adcode === adcode) {
      return city;
    }
    if (city.districts) {
      for (const district of city.districts) {
        if (district.adcode === adcode) {
          return city; // 返回父级城市
        }
      }
    }
  }
  return undefined;
};

// Territories Data
export type OwnerType = "me" | "enemy" | "neutral";

export interface Territory {
  id: string;
  ownerType: OwnerType;
  path: [number, number][];
  name: string;
  area: number;
  lastCaptured: string;
}

export const territories: Territory[] = [
  {
    id: "t1",
    ownerType: "me",
    name: "中央公园",
    area: 1200,
    lastCaptured: "2025年1月25日",
    path: [
      [116.4, 39.92],
      [116.41, 39.92],
      [116.41, 39.91],
      [116.4, 39.91],
    ],
  },
  {
    id: "t2",
    ownerType: "enemy",
    name: "金融街",
    area: 800,
    lastCaptured: "2025年1月24日",
    path: [
      [116.38, 39.91],
      [116.39, 39.91],
      [116.39, 39.9],
      [116.38, 39.9],
    ],
  },
  {
    id: "t3",
    ownerType: "neutral",
    name: "艺术区",
    area: 1500,
    lastCaptured: "N/A",
    path: [
      [116.42, 39.93],
      [116.43, 39.93],
      [116.43, 39.92],
      [116.42, 39.92],
    ],
  },
];

// Challenges Data
export const challenges: Challenge[] = [
  {
    id: "c1",
    cityId: "beijing",
    name: "故宫探秘",
    description: "探索故宫周边的历史遗迹",
    type: "exploration",
    objective: { type: "tiles", target: 10, current: 0 },
    rewards: { experience: 500, points: 100 },
    status: "available",
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    priority: 1,
    isTimeLimited: true,
    isMainQuest: true,
  },
  {
    id: "c2",
    cityId: "shanghai",
    name: "外滩漫步",
    description: "在外滩附近完成一次5公里的行走",
    type: "social",
    objective: { type: "time", target: 5000, current: 0 },
    rewards: { experience: 300, points: 50 },
    status: "available",
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    priority: 2,
    isTimeLimited: false,
    isMainQuest: false,
  },
];

// Achievements Data
export const achievements: Achievement[] = [
  {
    id: "a1",
    name: "初出茅庐",
    description: "第一次占领领地",
    type: "milestone",
    tier: "bronze",
    conditions: { type: "tiles_captured", threshold: 1 },
    rewards: { badge: "🏅", experience: 100, points: 10 },
    isCompleted: true,
    completedAt: "2025-01-01",
  },
  {
    id: "a2",
    cityId: "beijing",
    name: "京城霸主",
    description: "在北京占领100个领地",
    type: "dominance",
    tier: "gold",
    conditions: { type: "tiles_captured", threshold: 100 },
    rewards: { badge: "👑", experience: 1000, points: 500 },
    isCompleted: false,
    progress: { current: 32, max: 100 },
  },
];

export const getChallengesByCityId = (cityId: string): Challenge[] => {
  return challenges.filter((c) => c.cityId === cityId);
};

export const getAchievementsByCityId = (cityId: string): Achievement[] => {
  return achievements.filter((a) => !a.cityId || a.cityId === cityId);
};
