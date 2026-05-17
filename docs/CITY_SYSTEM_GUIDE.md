# 多城市系统使用指南

## 概述

本项目实现了完整的多城市系统，允许用户在不同的城市之间切换，每个城市都有独立的数据、主题色、挑战任务和成就系统。

## 核心文件说明

### 1. 类型定义 (`types/city.ts`)

定义了以下核心类型：

- `City` - 城市数据结构
- `Challenge` - 挑战任务
- `Achievement` - 成就系统
- `UserCityProgress` - 用户城市进度
- `CitySwitchHistory` - 城市切换历史
- `CityLeaderboardEntry` - 排行榜条目

### 2. 模拟数据 (`lib/mock-data.ts`)

包含以下模拟数据：

- **4 个城市**: 北京、上海、成都、广州
- 每个城市都有独立的主题色配置
- 共 14 个挑战任务（每个城市 3-4 个）
- 共 14 个成就（全局 + 城市专属）

### 3. 城市上下文 (`contexts/CityContext.tsx`)

提供全局状态管理：

- `currentCity` - 当前选中城市
- `allCities` - 所有可用城市列表
- `switchCity(cityId)` - 切换城市方法
- `getCityProgress(cityId)` - 获取城市进度
- `switchHistory` - 切换历史记录

### 4. UI 组件

#### `CitySelector` (`components/city/CitySelector.tsx`)

城市选择器下拉菜单组件，允许用户在不同城市之间切换。

**使用示例：**
```tsx
import { CitySelector } from "@/components/city/CitySelector"

export default function MyComponent() {
  return (
    <div>
      <CitySelector />
    </div>
  )
}
```

#### `CityInfo` (`components/city/CityInfo.tsx`)

城市信息展示组件，显示当前城市的详细统计数据。

**使用示例：**
```tsx
import { CityInfo } from "@/components/city/CityInfo"

export default function MyComponent() {
  return (
    <div>
      <CityInfo />
    </div>
  )
}
```

## API 使用指南

### useCity Hook

获取完整的城市上下文：

```tsx
import { useCity } from "@/contexts/CityContext"

function MyComponent() {
  const {
    currentCity,        // 当前城市对象
    currentCityProgress, // 当前城市用户进度
    allCities,          // 所有城市列表
    switchCity,         // 切换城市方法
    getCityProgress,    // 获取特定城市进度
    isLoading,          // 加载状态
  } = useCity()

  const handleSwitchCity = async (cityId: string) => {
    await switchCity(cityId)
  }

  return <div>...</div>
}
```

### useCurrentCity Hook

获取当前城市（如果未选择则抛出错误）：

```tsx
import { useCurrentCity } from "@/contexts/CityContext"

function MyComponent() {
  const city = useCurrentCity() // 确保已选择城市

  return <div>{city.name}</div>
}
```

### useCurrentCitySafe Hook

安全获取当前城市（可能返回 null）：

```tsx
import { useCurrentCitySafe } from "@/contexts/CityContext"

function MyComponent() {
  const city = useCurrentCitySafe()

  if (!city) {
    return <div>请选择城市</div>
  }

  return <div>{city.name}</div>
}
```

## 辅助函数

### `getCityById(cityId)`

根据城市 ID 获取城市数据：

```tsx
import { getCityById } from "@/lib/mock-data"

const city = getCityById("beijing")
console.log(city?.name) // "北京"
```

### `getChallengesByCityId(cityId)`

获取指定城市的挑战任务列表：

```tsx
import { getChallengesByCityId } from "@/lib/mock-data"

const challenges = getChallengesByCityId("shanghai")
console.log(challenges.length) // 3
```

### `getAchievementsByCityId(cityId?)`

获取成就列表（可过滤特定城市）：

```tsx
import { getAchievementsByCityId } from "@/lib/mock-data"

// 获取全局成就
const globalAchievements = getAchievementsByCityId()

// 获取北京专属成就
const beijingAchievements = getAchievementsByCityId("beijing")
```

## 主题色配置

每个城市都有独立的主题色配置：

```tsx
const theme = {
  primary: "#dc2626",   // 主色（按钮、进度条等）
  secondary: "#fca5a5", // 次要色
  accent: "#fef2f2",    // 强调色
  glow: "drop-shadow(0 0 8px rgba(220, 38, 38, 0.6))", // 发光效果
}
```

使用示例：
```tsx
<div style={{ color: city.theme.primary }}>
  使用城市主题色
</div>
```

## 数据结构示例

### City 对象

```tsx
{
  id: "beijing",
  name: "北京",
  coordinates: { lat: 39.9042, lng: 116.4074 },
  bounds: { north: 40.2, south: 39.6, east: 116.8, west: 115.8 },
  theme: { primary: "#dc2626", secondary: "#fca5a5", accent: "#fef2f2", glow: "..." },
  seasonStatus: { currentSeason: 1, startDate: "2025-01-01", endDate: "2025-06-30", isActive: true },
  stats: { totalArea: 16410.54, totalPlayers: 125000, activePlayers: 32000, totalTiles: 5000000, capturedTiles: 3245000 },
  icon: "🏯",
  description: "六朝古都，现代都市的繁华与传统文化的碰撞"
}
```

### Challenge 对象

```tsx
{
  id: "bj-conquest-001",
  cityId: "beijing",
  name: "紫禁城征服者",
  description: "在北京市中心区域占领 50 个六边形",
  type: "conquest",
  objective: { type: "tiles", target: 50 },
  rewards: { experience: 500, points: 1000 },
  status: "available",
  startDate: "2025-01-01",
  endDate: "2025-03-31",
  priority: 5,
  isTimeLimited: true,
  isMainQuest: true
}
```

### Achievement 对象

```tsx
{
  id: "ach-global-001",
  name: "旅行者",
  description: "访问过 2 个不同城市",
  type: "collection",
  tier: "bronze",
  conditions: { type: "cities_visited", threshold: 2 },
  rewards: { title: "城市旅行者", badge: "🧳", experience: 200, points: 500 },
  isCompleted: false
}
```

## 扩展建议

### 1. 添加新城市

在 `lib/mock-data.ts` 中添加新的城市对象：

```tsx
{
  id: "shenzhen",
  name: "深圳",
  coordinates: { lat: 22.5431, lng: 114.0579 },
  bounds: { north: 22.9, south: 22.4, east: 114.6, west: 113.8 },
  theme: { primary: "#8b5cf6", secondary: "#c4b5fd", accent: "#f5f3ff", glow: "..." },
  // ... 其他配置
}
```

### 2. 集成真实 API

将模拟数据替换为 API 调用：

```tsx
// 替换 generateMockProgress 函数
const fetchCityProgress = async (cityId: string): Promise<UserCityProgress> => {
  const response = await fetch(`/api/cities/${cityId}/progress`)
  return response.json()
}
```

### 3. 添加更多挑战和成就

在 `lib/mock-data.ts` 中扩展 `mockChallenges` 和 `mockAchievements` 数组。

## 注意事项

1. **Provider 必须在应用根部**: 确保 `CityProvider` 在 `app/layout.tsx` 中被包裹
2. **客户端组件**: 所有使用 `useCity` hook 的组件必须是客户端组件（添加 `"use client"`）
3. **异步操作**: `switchCity` 是异步方法，需要使用 `await` 或 `.then()`
4. **本地存储**: 当前城市选择会保存在 localStorage 中，刷新后会自动恢复
5. **错误处理**: 建议在调用 `switchCity` 时添加错误处理

## 下一步开发建议

1. 集成真实的后端 API（Supabase/Firebase）
2. 实现实时数据同步
3. 添加城市排行榜功能
4. 实现挑战任务进度追踪
5. 添加成就通知系统
6. 集成地图服务（Mapbox GL 或 Leaflet）
7. 实现六边形网格与真实地图的映射
