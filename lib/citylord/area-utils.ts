/**
 * CityLord 领地面积计算工具
 * 
 * 六边形格子作为视觉蒙版，每个标准六边形对应真实地理面积
 * 标准六边形半径: 10米
 * 单格面积: 约 260 平方米 (精确值: 3√3/2 × r² ≈ 259.8 m²)
 */

// 六边形参数
export const HEX_RADIUS_METERS = 10 // 六边形半径（米）
export const HEX_AREA_SQ_METERS = 260 // 每个六边形的面积（平方米）

// 换算阈值
export const SQ_METERS_TO_KM_THRESHOLD = 10000 // 大于此值时转换为平方公里

/**
 * 将格子数量转换为面积（平方米）
 */
export function hexCountToArea(hexCount: number): number {
  return hexCount * HEX_AREA_SQ_METERS
}

/**
 * 将面积（平方米）转换为格子数量
 */
export function areaToHexCount(areaSqMeters: number): number {
  return Math.floor(areaSqMeters / HEX_AREA_SQ_METERS)
}

/**
 * 格式化面积显示
 * 小于 10,000 m² 显示 m²，大于等于 10,000 m² 转换为 km²
 */
export function formatArea(areaSqMeters: number): {
  value: string
  unit: string
  fullText: string
} {
  if (areaSqMeters >= SQ_METERS_TO_KM_THRESHOLD) {
    const sqKm = areaSqMeters / 1000000
    const value = sqKm.toFixed(2)
    return {
      value,
      unit: "km²",
      fullText: `${value} km²`,
    }
  }
  
  const value = Math.round(areaSqMeters).toLocaleString()
  return {
    value,
    unit: "m²",
    fullText: `${value} m²`,
  }
}

/**
 * 格式化面积显示（从格子数量）
 */
export function formatAreaFromHexCount(hexCount: number): {
  value: string
  unit: string
  fullText: string
} {
  return formatArea(hexCountToArea(hexCount))
}

/**
 * 获取面积等效类比文案
 * 用于成就页面等场景，增强用户成就感
 */
export function getAreaEquivalent(areaSqMeters: number): string | null {
  // 标准足球场面积约 7,140 m²
  const footballFields = areaSqMeters / 7140
  
  // 标准篮球场面积约 420 m²
  const basketballCourts = areaSqMeters / 420
  
  // 标准网球场面积约 260 m²
  const tennisCourts = areaSqMeters / 260
  
  // 一个标准游泳池面积约 1,250 m² (50m x 25m)
  const swimmingPools = areaSqMeters / 1250
  
  if (footballFields >= 1) {
    const count = Math.floor(footballFields * 10) / 10
    if (count >= 10) {
      return `相当于 ${Math.round(count)} 个标准足球场`
    }
    return `相当于 ${count.toFixed(1)} 个标准足球场`
  }
  
  if (swimmingPools >= 1) {
    const count = Math.floor(swimmingPools * 10) / 10
    return `相当于 ${count.toFixed(1)} 个标准游泳池`
  }
  
  if (basketballCourts >= 1) {
    const count = Math.floor(basketballCourts)
    return `相当于 ${count} 个标准篮球场`
  }
  
  if (tennisCourts >= 1) {
    const count = Math.floor(tennisCourts)
    return `相当于 ${count} 个标准网球场`
  }
  
  return null
}

/**
 * 获取面积等效类比（从格子数量）
 */
export function getAreaEquivalentFromHexCount(hexCount: number): string | null {
  return getAreaEquivalent(hexCountToArea(hexCount))
}

/**
 * 计算排行榜中的面积数据
 */
export interface LeaderboardAreaEntry {
  hexCount: number
  area: number
  formattedArea: {
    value: string
    unit: string
    fullText: string
  }
}

export function calculateLeaderboardArea(hexCount: number): LeaderboardAreaEntry {
  const area = hexCountToArea(hexCount)
  return {
    hexCount,
    area,
    formattedArea: formatArea(area),
  }
}

/**
 * 实时面积增量显示格式
 * 用于跑步过程中的面积计数器
 */
export function formatAreaIncrement(areaSqMeters: number): string {
  if (areaSqMeters >= 1000) {
    return `+${(areaSqMeters / 1000).toFixed(1)}k m²`
  }
  return `+${Math.round(areaSqMeters)} m²`
}

/**
 * 获取单次占领的面积增量文案
 */
export function getCaptureAreaText(): string {
  return `+${HEX_AREA_SQ_METERS} m²`
}
