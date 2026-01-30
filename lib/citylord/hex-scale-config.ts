/**
 * CityLord 六边形网格缩放配置系统
 * 
 * 实现缩放自适应逻辑 (Zoom-Level Scaling Logic)
 * 确保六边形视觉效果与地理面积计算在不同比例尺下均保持合理
 */

// ============================================================
// 缩放级别配置 (Scale Configuration)
// ============================================================

export interface ZoomLevelConfig {
  name: string
  nameEn: string
  minZoom: number
  maxZoom: number
  hexRadiusMeters: number // 六边形边长 (s)
  hexAreaSqMeters: number // 六边形面积 = (3√3/2) × s²
  description: string
  maxRenderCount: number // 最大渲染数量，防止性能问题
  showLabels: boolean // 是否显示格子标签
  showProgress: boolean // 是否显示占领进度
}

/**
 * 正六边形面积公式: A = (3√3/2) × s²
 * 其中 s 为边长（半径）
 */
export function calculateHexArea(radiusMeters: number): number {
  return Math.round((3 * Math.sqrt(3) / 2) * radiusMeters * radiusMeters)
}

/**
 * 三级缩放配置
 */
export const ZOOM_LEVELS: ZoomLevelConfig[] = [
  {
    name: "近景",
    nameEn: "close",
    minZoom: 17,
    maxZoom: 22,
    hexRadiusMeters: 10,
    hexAreaSqMeters: calculateHexArea(10), // ≈ 260 m²
    description: "精确占领，可看到每一步的足迹",
    maxRenderCount: 500,
    showLabels: true,
    showProgress: true,
  },
  {
    name: "中景",
    nameEn: "medium",
    minZoom: 14,
    maxZoom: 17,
    hexRadiusMeters: 50,
    hexAreaSqMeters: calculateHexArea(50), // ≈ 6,495 m²
    description: "查看街区范围的领地",
    maxRenderCount: 300,
    showLabels: false,
    showProgress: false,
  },
  {
    name: "远景",
    nameEn: "far",
    minZoom: 0,
    maxZoom: 14,
    hexRadiusMeters: 200,
    hexAreaSqMeters: calculateHexArea(200), // ≈ 103,923 m²
    description: "查看城市级别的占领概况",
    maxRenderCount: 100,
    showLabels: false,
    showProgress: false,
  },
]

/**
 * 获取当前缩放级别的配置
 */
export function getZoomLevelConfig(zoom: number): ZoomLevelConfig {
  for (const level of ZOOM_LEVELS) {
    if (zoom >= level.minZoom && zoom < level.maxZoom) {
      return level
    }
  }
  // 默认返回远景配置
  return ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
}

/**
 * 获取相邻的缩放级别（用于平滑过渡）
 */
export function getAdjacentZoomLevel(currentZoom: number, direction: 'in' | 'out'): ZoomLevelConfig | null {
  const currentConfig = getZoomLevelConfig(currentZoom)
  const currentIndex = ZOOM_LEVELS.findIndex(l => l.nameEn === currentConfig.nameEn)
  
  if (direction === 'in' && currentIndex > 0) {
    return ZOOM_LEVELS[currentIndex - 1]
  }
  if (direction === 'out' && currentIndex < ZOOM_LEVELS.length - 1) {
    return ZOOM_LEVELS[currentIndex + 1]
  }
  return null
}

// ============================================================
// GPS 锚点系统 (Reference GPS Anchor)
// ============================================================

export interface GpsAnchor {
  lat: number
  lng: number
  timestamp: number
}

/**
 * 默认 GPS 锚点 (北京天安门广场)
 * 可根据用户位置动态更新
 */
export const DEFAULT_GPS_ANCHOR: GpsAnchor = {
  lat: 39.9042,
  lng: 116.4074,
  timestamp: Date.now(),
}

/**
 * 地球半径（米）
 */
const EARTH_RADIUS_METERS = 6371000

/**
 * 将经纬度差值转换为米
 */
export function latLngToMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { dx: number; dy: number } {
  const latMid = (lat1 + lat2) / 2
  const latRad = latMid * (Math.PI / 180)
  
  // 1度纬度对应的米数
  const metersPerLatDegree = (Math.PI / 180) * EARTH_RADIUS_METERS
  // 1度经度对应的米数（随纬度变化）
  const metersPerLngDegree = (Math.PI / 180) * EARTH_RADIUS_METERS * Math.cos(latRad)
  
  const dy = (lat2 - lat1) * metersPerLatDegree
  const dx = (lng2 - lng1) * metersPerLngDegree
  
  return { dx, dy }
}

/**
 * 将米转换为经纬度差值
 */
export function metersToLatLng(
  dx: number,
  dy: number,
  anchorLat: number
): { dLat: number; dLng: number } {
  const latRad = anchorLat * (Math.PI / 180)
  
  const metersPerLatDegree = (Math.PI / 180) * EARTH_RADIUS_METERS
  const metersPerLngDegree = (Math.PI / 180) * EARTH_RADIUS_METERS * Math.cos(latRad)
  
  const dLat = dy / metersPerLatDegree
  const dLng = dx / metersPerLngDegree
  
  return { dLat, dLng }
}

// ============================================================
// 六边形网格坐标系统 (Hex Grid Coordinate System)
// ============================================================

export interface HexCoordinate {
  q: number // 轴向坐标 q
  r: number // 轴向坐标 r
  s: number // 轴向坐标 s (q + r + s = 0)
}

export interface PixelCoordinate {
  x: number
  y: number
}

export interface GeoCoordinate {
  lat: number
  lng: number
}

/**
 * 六边形布局参数
 * 使用 pointy-top (尖顶朝上) 布局
 */
export interface HexLayout {
  size: number // 六边形半径（像素）
  origin: PixelCoordinate // 原点像素坐标
  anchor: GpsAnchor // GPS 锚点
  metersPerPixel: number // 每像素对应的米数
}

/**
 * 轴向坐标转像素坐标
 */
export function hexToPixel(hex: HexCoordinate, layout: HexLayout): PixelCoordinate {
  const size = layout.size
  // Pointy-top 六边形的转换矩阵
  const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r)
  const y = size * (3 / 2 * hex.r)
  
  return {
    x: x + layout.origin.x,
    y: y + layout.origin.y,
  }
}

/**
 * 像素坐标转轴向坐标
 */
export function pixelToHex(pixel: PixelCoordinate, layout: HexLayout): HexCoordinate {
  const size = layout.size
  const x = pixel.x - layout.origin.x
  const y = pixel.y - layout.origin.y
  
  // 逆矩阵转换
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size
  const r = (2 / 3 * y) / size
  
  return hexRound({ q, r, s: -q - r })
}

/**
 * 六边形坐标取整
 */
export function hexRound(hex: HexCoordinate): HexCoordinate {
  let q = Math.round(hex.q)
  let r = Math.round(hex.r)
  let s = Math.round(hex.s)
  
  const qDiff = Math.abs(q - hex.q)
  const rDiff = Math.abs(r - hex.r)
  const sDiff = Math.abs(s - hex.s)
  
  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s
  } else if (rDiff > sDiff) {
    r = -q - s
  } else {
    s = -q - r
  }
  
  return { q, r, s }
}

/**
 * GPS 坐标转六边形坐标
 */
export function geoToHex(
  geo: GeoCoordinate,
  layout: HexLayout,
  zoomConfig: ZoomLevelConfig
): HexCoordinate {
  // 计算相对于锚点的米偏移
  const { dx, dy } = latLngToMeters(
    layout.anchor.lat,
    layout.anchor.lng,
    geo.lat,
    geo.lng
  )
  
  // 转换为像素坐标
  const pixelX = dx / layout.metersPerPixel + layout.origin.x
  const pixelY = -dy / layout.metersPerPixel + layout.origin.y // Y 轴翻转
  
  return pixelToHex({ x: pixelX, y: pixelY }, layout)
}

/**
 * 六边形坐标转 GPS 坐标
 */
export function hexToGeo(
  hex: HexCoordinate,
  layout: HexLayout
): GeoCoordinate {
  const pixel = hexToPixel(hex, layout)
  
  // 转换为米偏移
  const dx = (pixel.x - layout.origin.x) * layout.metersPerPixel
  const dy = -(pixel.y - layout.origin.y) * layout.metersPerPixel // Y 轴翻转
  
  // 转换为经纬度
  const { dLat, dLng } = metersToLatLng(dx, dy, layout.anchor.lat)
  
  return {
    lat: layout.anchor.lat + dLat,
    lng: layout.anchor.lng + dLng,
  }
}

// ============================================================
// 缩放级别转换与父子对齐 (Scale Level Transition)
// ============================================================

/**
 * 计算两个缩放级别之间的六边形对应关系
 * 确保父子级对齐
 */
export function getHexScaleRatio(
  fromConfig: ZoomLevelConfig,
  toConfig: ZoomLevelConfig
): number {
  return toConfig.hexRadiusMeters / fromConfig.hexRadiusMeters
}

/**
 * 将小比例尺的六边形坐标转换为大比例尺
 * 用于缩放时保持对齐
 */
export function convertHexBetweenScales(
  hex: HexCoordinate,
  fromConfig: ZoomLevelConfig,
  toConfig: ZoomLevelConfig
): HexCoordinate {
  const ratio = getHexScaleRatio(fromConfig, toConfig)
  
  return hexRound({
    q: hex.q * ratio,
    r: hex.r * ratio,
    s: hex.s * ratio,
  })
}

/**
 * 获取一个大六边形包含的所有小六边形坐标
 */
export function getChildHexes(
  parentHex: HexCoordinate,
  parentConfig: ZoomLevelConfig,
  childConfig: ZoomLevelConfig
): HexCoordinate[] {
  const ratio = getHexScaleRatio(childConfig, parentConfig)
  const children: HexCoordinate[] = []
  
  // 父六边形中心在子坐标系中的位置
  const centerQ = Math.round(parentHex.q * ratio)
  const centerR = Math.round(parentHex.r * ratio)
  
  // 遍历子六边形范围
  const range = Math.ceil(ratio)
  for (let dq = -range; dq <= range; dq++) {
    for (let dr = -range; dr <= range; dr++) {
      const childHex: HexCoordinate = {
        q: centerQ + dq,
        r: centerR + dr,
        s: -(centerQ + dq) - (centerR + dr),
      }
      
      // 验证该子六边形是否在父六边形内
      const parentOfChild = convertHexBetweenScales(childHex, childConfig, parentConfig)
      if (
        parentOfChild.q === parentHex.q &&
        parentOfChild.r === parentHex.r
      ) {
        children.push(childHex)
      }
    }
  }
  
  return children
}

// ============================================================
// 视口裁剪与性能优化 (Viewport Culling)
// ============================================================

export interface ViewportBounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/**
 * 获取视口内可见的六边形范围
 */
export function getVisibleHexRange(
  bounds: ViewportBounds,
  layout: HexLayout,
  zoomConfig: ZoomLevelConfig
): { minQ: number; maxQ: number; minR: number; maxR: number } {
  // 计算四个角的六边形坐标
  const corners = [
    geoToHex({ lat: bounds.minLat, lng: bounds.minLng }, layout, zoomConfig),
    geoToHex({ lat: bounds.minLat, lng: bounds.maxLng }, layout, zoomConfig),
    geoToHex({ lat: bounds.maxLat, lng: bounds.minLng }, layout, zoomConfig),
    geoToHex({ lat: bounds.maxLat, lng: bounds.maxLng }, layout, zoomConfig),
  ]
  
  const qs = corners.map(c => c.q)
  const rs = corners.map(c => c.r)
  
  // 添加边距
  const padding = 2
  
  return {
    minQ: Math.min(...qs) - padding,
    maxQ: Math.max(...qs) + padding,
    minR: Math.min(...rs) - padding,
    maxR: Math.max(...rs) + padding,
  }
}

/**
 * 限制渲染的六边形数量
 */
export function limitHexCount(
  hexes: HexCoordinate[],
  maxCount: number,
  priorityHex?: HexCoordinate
): HexCoordinate[] {
  if (hexes.length <= maxCount) {
    return hexes
  }
  
  // 如果有优先级六边形（如用户当前位置），优先保留它附近的
  if (priorityHex) {
    const sorted = [...hexes].sort((a, b) => {
      const distA = Math.abs(a.q - priorityHex.q) + Math.abs(a.r - priorityHex.r)
      const distB = Math.abs(b.q - priorityHex.q) + Math.abs(b.r - priorityHex.r)
      return distA - distB
    })
    return sorted.slice(0, maxCount)
  }
  
  return hexes.slice(0, maxCount)
}

// ============================================================
// 面积统计聚合 (Area Statistics Aggregation)
// ============================================================

export interface HexAreaStats {
  totalHexCount: number
  totalAreaSqMeters: number
  formattedArea: {
    value: string
    unit: string
    fullText: string
  }
  zoomLevel: string
  hexRadiusMeters: number
}

/**
 * 计算当前缩放级别下的面积统计
 * 确保不同缩放级别下统计结果一致
 */
export function calculateAreaStats(
  hexCount: number,
  zoomConfig: ZoomLevelConfig
): HexAreaStats {
  const totalAreaSqMeters = hexCount * zoomConfig.hexAreaSqMeters
  
  // 格式化面积
  let value: string
  let unit: string
  
  if (totalAreaSqMeters >= 10000) {
    const sqKm = totalAreaSqMeters / 1000000
    value = sqKm.toFixed(2)
    unit = "km²"
  } else {
    value = Math.round(totalAreaSqMeters).toLocaleString()
    unit = "m²"
  }
  
  return {
    totalHexCount: hexCount,
    totalAreaSqMeters,
    formattedArea: {
      value,
      unit,
      fullText: `${value} ${unit}`,
    },
    zoomLevel: zoomConfig.name,
    hexRadiusMeters: zoomConfig.hexRadiusMeters,
  }
}

/**
 * 将一个缩放级别的面积统计转换为另一个级别
 * 用于保持统计一致性
 */
export function convertAreaStatsBetweenScales(
  stats: HexAreaStats,
  toConfig: ZoomLevelConfig
): HexAreaStats {
  // 面积保持不变，只重新计算格子数
  const newHexCount = Math.round(stats.totalAreaSqMeters / toConfig.hexAreaSqMeters)
  return calculateAreaStats(newHexCount, toConfig)
}

// ============================================================
// 导出完整配置对象 (ScaleConfig Export)
// ============================================================

export const ScaleConfig = {
  // 缩放级别配置
  zoomLevels: ZOOM_LEVELS,
  getZoomLevelConfig,
  getAdjacentZoomLevel,
  
  // GPS 锚点
  defaultAnchor: DEFAULT_GPS_ANCHOR,
  latLngToMeters,
  metersToLatLng,
  
  // 坐标转换
  hexToPixel,
  pixelToHex,
  hexRound,
  geoToHex,
  hexToGeo,
  
  // 缩放级别转换
  getHexScaleRatio,
  convertHexBetweenScales,
  getChildHexes,
  
  // 视口裁剪
  getVisibleHexRange,
  limitHexCount,
  
  // 面积统计
  calculateAreaStats,
  convertAreaStatsBetweenScales,
  calculateHexArea,
}

export default ScaleConfig
