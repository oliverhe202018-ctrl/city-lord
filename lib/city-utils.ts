import { BaseCity } from "@/data/cities";
import { City } from "@/types/city";

/**
 * 搜索城市
 * 支持中文、拼音、首字母匹配，自动忽略行政区划后缀
 */
export function searchCities(query: string, cities: BaseCity[]): BaseCity[] {
  if (!query) return cities;

  const normalizedQuery = query.toLowerCase().trim();
  // 移除常见的行政区划后缀
  const cleanQuery = normalizedQuery.replace(/(市|区|县|自治州)$/, "");

  return cities.filter((city) => {
    const name = city.name.toLowerCase();
    const pinyin = city.pinyin.toLowerCase();
    const abbr = city.abbr.toLowerCase();

    // 1. 中文包含匹配 (e.g. "长沙" match "长沙市")
    if (name.includes(cleanQuery)) return true;

    // 2. 拼音包含匹配 (e.g. "changsha" match "changsha")
    if (pinyin.includes(normalizedQuery)) return true;

    // 3. 首字母匹配 (e.g. "cs" match "changsha")
    // 优先匹配首字母开头的，但也允许包含
    if (abbr.includes(normalizedQuery)) return true;

    return false;
  });
}

/**
 * 将基础城市数据转换为完整的 City 对象
 */
export function hydrateCity(base: BaseCity): City {
  // 生成确定性的伪随机数，基于 adcode
  const seed = parseInt(base.adcode) || 0;
  const random = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  // 随机生成一些统计数据
  const totalArea = Math.floor(2000 + random(1) * 15000);
  const totalPlayers = Math.floor(1000 + random(2) * 50000);
  const activePlayers = Math.floor(totalPlayers * (0.3 + random(3) * 0.4));
  const totalTiles = Math.floor(totalArea / 2);
  const capturedTiles = Math.floor(totalTiles * (0.1 + random(4) * 0.5));

  // 随机选择主题色
  const themes = [
    { primary: "#dc2626", secondary: "#fbbf24", accent: "#f97316", glow: "#dc2626" }, // Red
    { primary: "#3b82f6", secondary: "#06b6d4", accent: "#8b5cf6", glow: "#3b82f6" }, // Blue
    { primary: "#22c55e", secondary: "#84cc16", accent: "#14b8a6", glow: "#22c55e" }, // Green
    { primary: "#f43f5e", secondary: "#ec4899", accent: "#f97316", glow: "#f43f5e" }, // Pink
    { primary: "#6366f1", secondary: "#8b5cf6", accent: "#06b6d4", glow: "#6366f1" }, // Indigo
    { primary: "#0d9488", secondary: "#22c55e", accent: "#0ea5e9", glow: "#0d9488" }, // Teal
    { primary: "#eab308", secondary: "#f97316", accent: "#ef4444", glow: "#eab308" }, // Yellow
    { primary: "#a855f7", secondary: "#ec4899", accent: "#6366f1", glow: "#a855f7" }, // Purple
  ];
  const themeIndex = Math.floor(random(5) * themes.length);
  const theme = themes[themeIndex];

  // 随机图标
  const icons = ["🏛️", "🌆", "🐼", "🌺", "🚀", "🏞️", "🌉", "🏰", "🏙️", "🌴", "🍜", "⛰️"];
  const iconIndex = Math.floor(random(6) * icons.length);

  return {
    id: base.pinyin, // 使用拼音作为 ID
    adcode: base.adcode, // 添加行政区划代码
    name: base.name,
    pinyin: base.pinyin,
    abbr: base.abbr,
    coordinates: {
      lng: base.center[0],
      lat: base.center[1],
    },
    bounds: {
      // 简单估算边界，大概 +/- 0.5 度
      north: base.center[1] + 0.5,
      south: base.center[1] - 0.5,
      east: base.center[0] + 0.5,
      west: base.center[0] - 0.5,
    },
    theme: theme,
    themeColors: {
      primary: theme.primary,
      secondary: theme.secondary,
    },
    seasonStatus: {
      currentSeason: 1,
      startDate: "2025-01-01",
      endDate: "2025-03-31",
      isActive: true,
    },
    stats: {
      totalArea,
      totalPlayers,
      activePlayers,
      totalTiles,
      capturedTiles,
    },
    icon: icons[iconIndex],
    description: `${base.name}，精彩无限。`,
    districts: base.districts?.map(d => ({
      id: d.pinyin,
      adcode: d.adcode,
      name: d.name,
      center: d.center
    }))
  };
}
