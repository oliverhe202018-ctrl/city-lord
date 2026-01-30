/**
 * H3 地理处理工具库
 *
 * 基于 h3-js 库实现核心地理算法功能：
 * - 经纬度到六边形 ID 的精确映射
 * - 六边形边界计算（用于地图绘制）
 * - 邻近六边形查询（用于视野渲染）
 *
 * @see https://h3geo.org/docs/quickstart/
 */

import * as h3 from 'h3-js'

// ==================== Types ====================

export interface HexagonBoundary {
  lat: number
  lng: number
}

export interface HexagonCell {
  id: string // H3 索引
  resolution: number // 分辨率级别 (0-15)
  boundary: HexagonBoundary[] // 6个顶点坐标
  centerLat: number
  centerLng: number
}

export interface HexagonDisk {
  cells: HexagonCell[]
  centerId: string
  radius: number
}

// ==================== Constants ====================

/**
 * H3 分辨率配置
 * 
 * 分辨率  | 边长      | 面积           | 适用场景
 * --------|-----------|----------------|------------------
 * 7       | ~183m     | ~0.89 km²      | 城市区域
 * 8       | ~61m      | ~0.1 km²       | 街区级别
 * 9       | ~20m      | ~0.011 km²     | 建筑级别 ⭐ 推荐
 * 10      | ~7m       | ~0.0012 km²    | 精确位置 ⭐ 推荐
 */
export const H3_RESOLUTION = 9

/**
 * 渲染半径（圈数）
 * 
 * 每圈增加一层六边形
 * radius=0: 1 个六边形（中心）
 * radius=1: 7 个六边形
 * radius=2: 19 个六边形
 * radius=3: 37 个六边形
 * 
 * 公式：1 + 3 * n * (n + 1)
 */
export const RENDER_RADIUS = 15 // 覆盖约 600 米范围

/**
 * 最大渲染数量（性能优化）
 */
export const MAX_RENDER_COUNT = 500

// ==================== Core Functions ====================

/**
 * 将经纬度转换为 H3 索引
 * 
 * @param lat - 纬度 (-90 到 90)
 * @param lng - 经度 (-180 到 180)
 * @param resolution - H3 分辨率 (默认 9)
 * @returns H3 索引字符串
 * 
 * @example
 * latLngToCell(39.9042, 116.4074, 9) // '89283082c37ffff'
 */
export function latLngToCell(
  lat: number,
  lng: number,
  resolution: number = H3_RESOLUTION
): string {
  // 输入验证
  if (lat < -90 || lat > 90) {
    throw new Error(`纬度超出范围: ${lat}，有效范围 [-90, 90]`)
  }
  if (lng < -180 || lng > 180) {
    throw new Error(`经度超出范围: ${lng}，有效范围 [-180, 180]`)
  }
  if (resolution < 0 || resolution > 15) {
    throw new Error(`分辨率超出范围: ${resolution}，有效范围 [0, 15]`)
  }

  // 使用 h3-js 将经纬度转换为 H3 索引
  return h3.latLngToCell(lat, lng, resolution)
}

/**
 * 获取六边形的 6 个顶点坐标
 * 
 * @param h3Index - H3 索引
 * @returns 6 个顶点的经纬度数组（按顺时针顺序）
 * 
 * @example
 * cellToBoundary('89283082c37ffff')
 * // [
 * //   { lat: 39.9045, lng: 116.4078 },
 * //   { lat: 39.9046, lng: 116.4080 },
 * //   ...
 * // ]
 */
export function cellToBoundary(h3Index: string): HexagonBoundary[] {
  // 输入验证
  if (!h3Index) {
    throw new Error(`无效的 H3 索引: ${h3Index}`)
  }

  // 使用 h3-js 获取六边形边界
  const boundary = h3.cellToBoundary(h3Index)
  return boundary.map(point => ({ lat: point[0], lng: point[1] }))
}

/**
 * 获取中心六边形周围 N 圈的所有六边形
 * 
 * @param h3Index - 中心六边形的 H3 索引
 * @param radius - 扩展半径（圈数）
 * @returns 包含所有六边形的对象
 * 
 * @example
 * getDisk('89283082c37ffff', 2)
 * // {
 * //   cells: [...], // 19 个六边形
 * //   centerId: '89283082c37ffff',
 * //   radius: 2
 * // }
 */
export function getDisk(h3Index: string, radius: number = RENDER_RADIUS): HexagonDisk {
  // 输入验证
  if (!h3Index) {
    throw new Error(`无效的 H3 索引: ${h3Index}`)
  }
  if (radius < 0 || radius > 20) {
    throw new Error(`半径超出范围: ${radius}，有效范围 [0, 20]`)
  }

  // 使用 h3-js 获取周围六边形
  const cellIds = h3.gridDiskDistances(h3Index, radius).map((item: any) => item[0])

  // 限制最大渲染数量
  const limitedCellIds = cellIds.slice(0, MAX_RENDER_COUNT)

  const cells = limitedCellIds.map(id => {
    const [centerLat, centerLng] = h3.cellToLatLng(id)
    return {
      id,
      resolution: h3.getResolution(id),
      boundary: cellToBoundary(id),
      centerLat,
      centerLng,
    }
  })

  return { cells, centerId: h3Index, radius }
}

// ==================== Utility Functions ====================

/**
 * 获取六边形的中心点坐标
 * 
 * @param h3Index - H3 索引
 * @returns { lat, lng }
 */
export function cellToLatLng(h3Index: string): { lat: number; lng: number } {
  // 输入验证
  if (!h3Index) {
    throw new Error(`无效的 H3 索引: ${h3Index}`)
  }

  // 使用 h3-js 获取中心点坐标
  const [lat, lng] = h3.cellToLatLng(h3Index)
  return { lat, lng }
}

/**
 * 计算两个六边形之间的距离（六边形步数）
 * 
 * @param origin - 起点 H3 索引
 * @param destination - 终点 H3 索引
 * @returns 距离（步数）
 */
export function cellDistance(origin: string, destination: string): number {
  // 输入验证
  if (!origin || !destination) {
    throw new Error(`无效的 H3 索引`)
  }

  // 使用 h3-js 计算六边形距离
  return h3.gridDistance(origin, destination)
}

/**
 * 获取两个六边形之间的路径（最短路径）
 *
 * @param origin - 起点 H3 索引
 * @param destination - 终点 H3 索引
 * @returns 路径 H3 索引数组
 */
export function cellPath(origin: string, destination: string): string[] {
  // 输入验证
  if (!origin || !destination) {
    throw new Error(`无效的 H3 索引`)
  }

  // 使用 h3-js 计算路径 (h3-js v4.x 使用 gridPathCells)
  // 注意: 如果单元格相距太远或位于不同的基站单元，此函数可能会引发错误
  try {
    return h3.gridPathCells(origin, destination)
  } catch (err) {
    console.warn(`无法计算 H3 路径 from ${origin} to ${destination}:`, err)
    return [] // 路径查找失败时返回空数组
  }
}

/**
 * 判断两个六边形是否相邻
 * 
 * @param a - H3 索引 a
 * @param b - H3 索引 b
 * @returns 是否相邻
 */
export function isNeighbor(a: string, b: string): boolean {
  return cellDistance(a, b) === 1
}

/**
 * 获取六边形的 6 个相邻六边形
 * 
 * @param h3Index - H3 索引
 * @returns 6 个相邻六边形的 H3 索引数组
 */
export function getNeighbors(h3Index: string): string[] {
  // 输入验证
  if (!h3Index) {
    throw new Error(`无效的 H3 索引: ${h3Index}`)
  }

  // 使用 h3-js 获取相邻六边形
  const disk = h3.gridDisk(h3Index, 1)
  return disk.filter(id => id !== h3Index)
}

/**
 * 计算视口范围内的所有六边形
 * 
 * @param centerLat - 视口中心纬度
 * @param centerLng - 视口中心经度
 * @param widthKm - 视口宽度（公里）
 * @param heightKm - 视口高度（公里）
 * @returns 六边形数组
 */
export function getViewportCells(
  centerLat: number,
  centerLng: number,
  widthKm: number = 2,
  heightKm: number = 2
): HexagonCell[] {
  const centerId = latLngToCell(centerLat, centerLng, H3_RESOLUTION)
  
  // 计算需要的半径（圈数）
  const avgRadius = Math.max(widthKm, heightKm) / 2 / 0.1 // 假设每个六边形 100 米
  const diskRadius = Math.ceil(avgRadius)

  const disk = getDisk(centerId, diskRadius)

  // 过滤视口范围内的六边形
  const cells = disk.cells.filter(cell => {
    const latDiff = Math.abs(cell.centerLat - centerLat)
    const lngDiff = Math.abs(cell.centerLng - centerLng)
    
    // 粗略估算：1 度约 111 公里
    const latKm = latDiff * 111
    const lngKm = lngDiff * 111 * Math.cos(centerLat * Math.PI / 180)

    return latKm <= heightKm / 2 && lngKm <= widthKm / 2
  })

  return cells
}

/**
 * 将 H3 索引转换为可读的字符串
 * 
 * @param h3Index - H3 索引
 * @returns 格式化字符串
 */
export function formatH3Index(h3Index: string): string {
  if (!h3Index) return 'N/A'
  return `${h3Index.slice(0, 8)}...${h3Index.slice(-4)}`
}

/**
 * 验证 H3 索引是否有效
 *
 * @param h3Index - H3 索引
 * @returns 是否有效
 */
export function isValidH3Index(h3Index: string): boolean {
  if (!h3Index) return false

  // 使用 h3-js 验证索引有效性 (h3-js v4.x 使用 isValidCell)
  return h3.isValidCell(h3Index)
}

/**
 * 获取六边形的面积（平方米）
 *
 * @param h3Index - H3 索引
 * @returns 面积（平方米）
 */
export function cellArea(h3Index: string): number {
  // 输入验证
  if (!h3Index) {
    throw new Error(`无效的 H3 索引: ${h3Index}`)
  }

  // 使用 h3-js 计算六边形面积（平方米）
  return h3.cellArea(h3Index, h3.UNITS.m2)
}

// ==================== Batch Operations ====================

/**
 * 批量转换经纬度为 H3 索引
 * 
 * @param coords - 经纬度数组
 * @param resolution - H3 分辨率
 * @returns H3 索引数组
 */
export function batchLatLngToCell(
  coords: Array<{ lat: number; lng: number }>,
  resolution: number = H3_RESOLUTION
): string[] {
  return coords.map(coord => latLngToCell(coord.lat, coord.lng, resolution))
}

/**
 * 批量获取六边形边界
 * 
 * @param h3Indexes - H3 索引数组
 * @returns 边界数组
 */
export function batchCellToBoundary(h3Indexes: string[]): HexagonBoundary[][] {
  return h3Indexes.map(id => cellToBoundary(id))
}

// ==================== Performance Optimization ====================

/**
 * 缓存 H3 索引计算结果（避免重复计算）
 */
export class HexagonCache {
  private cache: Map<string, HexagonCell> = new Map()
  private maxCacheSize: number

  constructor(maxCacheSize: number = 1000) {
    this.maxCacheSize = maxCacheSize
  }

  get(id: string): HexagonCell | undefined {
    return this.cache.get(id)
  }

  set(id: string, cell: HexagonCell): void {
    if (this.cache.size >= this.maxCacheSize) {
      // 删除最早的缓存
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(id, cell)
  }

  has(id: string): boolean {
    return this.cache.has(id)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// 创建全局缓存实例
export const hexagonCache = new HexagonCache()

/**
 * 使用缓存的 latLngToCell
 */
export function latLngToCellCached(
  lat: number,
  lng: number,
  resolution: number = H3_RESOLUTION
): HexagonCell {
  const id = latLngToCell(lat, lng, resolution)
  
  if (hexagonCache.has(id)) {
    return hexagonCache.get(id)!
  }

  const cell: HexagonCell = {
    id,
    resolution,
    boundary: cellToBoundary(id),
    centerLat: lat,
    centerLng: lng,
  }

  hexagonCache.set(id, cell)
  return cell
}
