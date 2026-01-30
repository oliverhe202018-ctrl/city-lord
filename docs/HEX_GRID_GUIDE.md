# 地理六边形网格系统指南

## 概述

本文档详细说明了基于 H3 地理算法的六边形网格系统的实现和使用方法。

---

## 目录

- [H3 地理算法](#h3-地理算法)
- [核心 API](#核心-api)
- [组件使用](#组件使用)
- [Hook 使用](#hook-使用)
- [性能优化](#性能优化)
- [最佳实践](#最佳实践)

---

## H3 地理算法

### 什么是 H3？

H3 是 Uber 开发的分层地理空间索引系统。它将地球表面划分为六边形网格，每个六边形都有唯一的标识符（H3 索引）。

### 分辨率配置

| 分辨率 | 边长 | 面积 | 适用场景 |
|--------|------|------|----------|
| 7 | ~183m | ~0.89 km² | 城市区域 |
| 8 | ~61m | ~0.1 km² | 街区级别 |
| **9** | **~20m** | **~0.011 km²** | **建筑级别 ⭐ 推荐** |
| 10 | ~7m | ~0.0012 km² | 精确位置 ⭐ 推荐 |

本项目默认使用 **分辨率 9**，边长约 20 米，适合城市级别的占领游戏。

### 渲染半径

```typescript
export const RENDER_RADIUS = 15 // 覆盖约 600 米范围
```

- radius=0: 1 个六边形（中心）
- radius=1: 7 个六边形
- radius=2: 19 个六边形
- radius=3: 37 个六边形
- radius=15: 703 个六边形

公式：`1 + 3 * n * (n + 1)`

---

## 核心 API

### latLngToCell

将经纬度转换为 H3 索引。

```typescript
import { latLngToCell } from "@/lib/hex-utils"

const h3Index = latLngToCell(39.9042, 116.4074, 9)
// 返回: '89283082c37ffff'
```

#### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `lat` | `number` | 是 | 纬度 (-90 到 90) |
| `lng` | `number` | 是 | 经度 (-180 到 180) |
| `resolution` | `number` | 否 | H3 分辨率 (0-15)，默认 9 |

#### 返回值

返回 H3 索引字符串（16 个字符的十六进制字符串）。

#### 错误处理

- 纬度超出范围：抛出 `Error("纬度超出范围: xxx，有效范围 [-90, 90]")`
- 经度超出范围：抛出 `Error("经度超出范围: xxx，有效范围 [-180, 180]")`
- 分辨率超出范围：抛出 `Error("分辨率超出范围: xxx，有效范围 [0, 15]")`

---

### cellToBoundary

获取六边形的 6 个顶点坐标。

```typescript
import { cellToBoundary } from "@/lib/hex-utils"

const boundary = cellToBoundary('89283082c37ffff')
// 返回:
// [
//   { lat: 39.9045, lng: 116.4078 },
//   { lat: 39.9046, lng: 116.4080 },
//   ...
// ]
```

#### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `h3Index` | `string` | 是 | H3 索引 |

#### 返回值

返回 6 个顶点的经纬度数组（按顺时针顺序）。

---

### getDisk

获取中心六边形周围 N 圈的所有六边形。

```typescript
import { getDisk } from "@/lib/hex-utils"

const disk = getDisk('89283082c37ffff', 2)
// 返回:
// {
//   cells: [...], // 19 个六边形
//   centerId: '89283082c37ffff',
//   radius: 2
// }
```

#### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `h3Index` | `string` | 是 | 中心六边形的 H3 索引 |
| `radius` | `number` | 否 | 扩展半径（圈数），默认 15 |

#### 返回值

返回包含所有六边形的对象。

#### 性能优化

自动限制最大渲染数量（`MAX_RENDER_COUNT = 500`），避免性能问题。

---

### getViewportCells

计算视口范围内的所有六边形。

```typescript
import { getViewportCells } from "@/lib/hex-utils"

const cells = getViewportCells(39.9042, 116.4074, 2, 2)
// 返回: 视口范围内的六边形数组
```

#### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `centerLat` | `number` | 是 | 视口中心纬度 |
| `centerLng` | `number` | 是 | 视口中心经度 |
| `widthKm` | `number` | 否 | 视口宽度（公里），默认 2 |
| `heightKm` | `number` | 否 | 视口高度（公里），默认 2 |

#### 返回值

返回视口范围内的六边形数组。

---

### 工具函数

#### cellToLatLng

获取六边形的中心点坐标。

```typescript
const { lat, lng } = cellToLatLng('89283082c37ffff')
```

#### cellDistance

计算两个六边形之间的距离（六边形步数）。

```typescript
const distance = cellDistance('89283082c37ffff', '89283082c37fffe')
// 返回: 1
```

#### isNeighbor

判断两个六边形是否相邻。

```typescript
const isNeighbor = isNeighbor('89283082c37ffff', '89283082c37fffe')
// 返回: true
```

#### getNeighbors

获取六边形的 6 个相邻六边形。

```typescript
const neighbors = getNeighbors('89283082c37ffff')
// 返回: 6 个相邻六边形的 H3 索引数组
```

#### isValidH3Index

验证 H3 索引是否有效。

```typescript
const isValid = isValidH3Index('89283082c37ffff')
// 返回: true
```

#### formatH3Index

将 H3 索引转换为可读的字符串。

```typescript
const formatted = formatH3Index('89283082c37ffff')
// 返回: '89283082...ffff'
```

---

## 组件使用

### GeoHexGrid

基于真实 GPS 坐标的动态六边形网格组件。

#### 基础用法

```tsx
import { GeoHexGrid } from "@/components/map/GeoHexGrid"

function MyMap() {
  return (
    <GeoHexGrid
      width={800}
      height={600}
      hexSize={20}
    />
  )
}
```

#### Props

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `width` | `number` | 否 | 800 | 画布宽度 |
| `height` | `number` | 否 | 600 | 画布高度 |
| `hexSize` | `number` | 否 | 20 | 六边形半径（像素） |
| `onHexClick` | `(cellId, lat, lng) => void` | 否 | - | 点击六边形回调 |
| `onHexHover` | `(cellId: string \| null) => void` | 否 | - | 悬停六边形回调 |
| `showLabels` | `boolean` | 否 | false | 是否显示标签 |
| `showProgress` | `boolean` | 否 | false | 是否显示进度 |

#### 交互示例

```tsx
function InteractiveMap() {
  const handleHexClick = (cellId: string, lat: number, lng: number) => {
    console.log("点击六边形:", cellId, lat, lng)
    // 占领六边形逻辑
  }

  const handleHexHover = (cellId: string | null) => {
    console.log("悬停六边形:", cellId)
  }

  return (
    <GeoHexGrid
      width={800}
      height={600}
      hexSize={20}
      onHexClick={handleHexClick}
      onHexHover={handleHexHover}
      showLabels={true}
      showProgress={true}
    />
  )
}
```

#### 特性

1. **自动更新**：从 `useGameStore` 读取用户实时坐标，GPS 位置变化时自动更新网格
2. **性能优化**：只渲染视口范围内的六边形（最多 500 个）
3. **交互支持**：支持点击、悬停交互
4. **视觉反馈**：悬停高亮、中心点脉冲动画
5. **状态指示**：显示加载状态、错误信息、六边形数量

---

## Hook 使用

### useGeolocation

地理定位 Hook，支持真实 GPS 定位和模拟 GPS 定位。

#### 基础用法

```tsx
import { useGeolocation } from "@/hooks/useGeolocation"

function MyComponent() {
  const geo = useGeolocation({
    simulate: false, // 使用真实 GPS
    enableHighAccuracy: true,
    timeout: 10000,
    watchInterval: 1000,
  })

  if (geo.isLoading) {
    return <div>定位中...</div>
  }

  if (geo.error) {
    return <div>错误: {geo.error}</div>
  }

  return <div>GPS 已连接</div>
}
```

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `enableHighAccuracy` | `boolean` | 否 | true | 是否启用高精度定位 |
| `timeout` | `number` | 否 | 10000 | 超时时间（毫秒） |
| `maximumAge` | `number` | 否 | 0 | 缓存的最大年龄（毫秒） |
| `watchInterval` | `number` | 否 | 1000 | 模拟模式下更新间隔（毫秒） |
| `simulate` | `boolean` | 否 | false | 是否启用模拟模式 |

#### 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `isSupported` | `boolean` | 浏览器是否支持地理定位 |
| `isLoading` | `boolean` | 是否正在加载 |
| `error` | `string \| null` | 错误信息 |
| `lastUpdate` | `number \| null` | 最后更新时间戳 |
| `manualUpdateLocation` | `(lat, lng) => void` | 手动更新位置（测试用） |

#### 模拟模式（开发用）

```tsx
const geo = useGeolocation({
  simulate: true, // 启用模拟模式
  watchInterval: 1000, // 每秒更新一次
})

// 模拟模式会在北京天安门广场附近随机游走
```

#### 真实 GPS 定位（生产用）

```tsx
const geo = useGeolocation({
  simulate: false, // 使用真实 GPS
  enableHighAccuracy: true,
  timeout: 10000,
})

// 会调用 navigator.geolocation.watchPosition
```

---

## 性能优化

### 1. 限制最大渲染数量

```typescript
export const MAX_RENDER_COUNT = 500
```

只渲染视口范围内的 500 个六边形，避免性能问题。

### 2. 使用缓存

```typescript
import { hexagonCache, latLngToCellCached } from "@/lib/hex-utils"

// 使用缓存的 latLngToCell
const cell = latLngToCellCached(39.9042, 116.4074, 9)
```

缓存最多 1000 个六边形，避免重复计算。

### 3. 防抖更新

```tsx
useEffect(() => {
  const timer = setTimeout(() => {
    generateHexGrid()
  }, 300) // 防抖

  return () => clearTimeout(timer)
}, [generateHexGrid])
```

GPS 位置变化时，300ms 后才重新生成网格。

### 4. Canvas 渲染

使用 Canvas API 而不是 DOM 元素渲染六边形，大幅提升性能。

### 5. 批量操作

```tsx
import { batchLatLngToCell, batchCellToBoundary } from "@/lib/hex-utils"

// 批量转换
const h3Indexes = batchLatLngToCell(coords, 9)
const boundaries = batchCellToBoundary(h3Indexes)
```

---

## 最佳实践

### 1. 选择合适的分辨率

| 场景 | 推荐分辨率 |
|------|-----------|
| 城市级别占领 | 9（~20m） |
| 精确位置占领 | 10（~7m） |
| 街区级别 | 8（~61m） |

### 2. 限制渲染半径

```tsx
// 室内地图：小半径
const radius = 5 // 覆盖约 200 米

// 室外地图：中半径
const radius = 10 // 覆盖约 400 米

// 开阔地带：大半径
const radius = 15 // 覆盖约 600 米
```

### 3. 错误处理

```tsx
try {
  const h3Index = latLngToCell(lat, lng, 9)
  const boundary = cellToBoundary(h3Index)
} catch (error) {
  console.error("地理转换失败:", error)
  // 显示友好的错误信息
}
```

### 4. 输入验证

```tsx
if (!isValidH3Index(h3Index)) {
  console.error("无效的 H3 索引")
  return
}
```

### 5. 性能监控

```tsx
console.log(`生成 ${cells.length} 个六边形，耗时 ${performance.now() - startTime}ms`)
```

监控生成六边形的时间，及时优化性能。

---

## 完整示例

查看演示页面：`/geo-grid-demo`

演示页面包含：

- 真实 GPS 定位 / 模拟 GPS 切换
- 动态六边形网格
- 缩放、平移
- 点击、悬停交互
- 实时 GPS 位置更新
- 六边形占领逻辑

---

## 下一步

- [ ] 集成 h3-js 库（待安装）
- [ ] 添加地图投影（墨卡托投影）
- [ ] 优化 Canvas 渲染性能
- [ ] 添加六边形占领状态管理
- [ ] 实现六边形占领动画
- [ ] 添加六边形边界检测
