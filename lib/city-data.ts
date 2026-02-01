import type { City } from "@/types/city";
import { baseCities } from "@/data/cities";
import { hydrateCity } from "@/lib/city-utils";

// Custom overrides for the original demo cities to keep them looking special
// These are static configurations (themes, descriptions)
const cityOverrides: Record<string, Partial<City>> = {
  beijing: {
    description: "千年古都，现代都市",
    icon: "🏛️",
    theme: { primary: "#dc2626", secondary: "#fbbf24", accent: "#f97316", glow: "#dc2626" },
    themeColors: { primary: "#dc2626", secondary: "#fbbf24" },
  },
  shanghai: {
    description: "魔都风华，璀璨不夜城",
    icon: "🌆",
    theme: { primary: "#3b82f6", secondary: "#06b6d4", accent: "#8b5cf6", glow: "#3b82f6" },
    themeColors: { primary: "#3b82f6", secondary: "#06b6d4" },
  },
  chengdu: {
    description: "天府之国，休闲之都",
    icon: "🐼",
    theme: { primary: "#22c55e", secondary: "#84cc16", accent: "#14b8a6", glow: "#22c55e" },
    themeColors: { primary: "#22c55e", secondary: "#84cc16" },
  },
  guangzhou: {
    description: "花城绽放，活力无限",
    icon: "🌺",
    theme: { primary: "#f43f5e", secondary: "#ec4899", accent: "#f97316", glow: "#f43f5e" },
    themeColors: { primary: "#f43f5e", secondary: "#ec4899" },
  },
  shenzhen: {
    description: "创新之城，科技先锋",
    icon: "🚀",
    theme: { primary: "#6366f1", secondary: "#8b5cf6", accent: "#06b6d4", glow: "#6366f1" },
    themeColors: { primary: "#6366f1", secondary: "#8b5cf6" },
  },
  hangzhou: {
    description: "人间天堂，数字之城",
    icon: "🏞️",
    theme: { primary: "#0d9488", secondary: "#22c55e", accent: "#0ea5e9", glow: "#0d9488" },
    themeColors: { primary: "#0d9488", secondary: "#22c55e" },
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
