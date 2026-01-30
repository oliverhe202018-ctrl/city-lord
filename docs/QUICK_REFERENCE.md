# 城市切换系统 - 快速参考

## 🚀 快速开始

### 1. 基本使用

#### 在地图页面中使用
```tsx
import { MapHeader } from "@/components/map/MapHeader"
import { CityActivityBanner } from "@/components/map/CityActivityBanner"

export default function MapPage() {
  return (
    <div className="relative h-screen">
      <MapHeader />
      <CityActivityBanner />
      {/* 你的地图内容 */}
    </div>
  )
}
```

#### 手动触发城市切换抽屉
```tsx
import { CityDrawer } from "@/components/map/CityDrawer"
import { useState } from "react"

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>选择城市</button>
      <CityDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
```

### 2. 使用 CityContext Hooks

#### 获取城市数据
```tsx
import { useCity } from "@/contexts/CityContext"

function MyComponent() {
  const {
    currentCity,          // 当前城市
    allCities,            // 所有城市
    switchCity,           // 切换城市方法
    currentCityProgress,  // 当前城市进度
    isLoading,            // 加载状态
  } = useCity()

  const handleSwitch = async () => {
    await switchCity("shanghai")
  }

  return (
    <div>
      <h1>{currentCity?.name}</h1>
      <button onClick={handleSwitch}>切换到上海</button>
    </div>
  )
}
```

#### 确保已选择城市（抛出错误）
```tsx
import { useCurrentCity } from "@/contexts/CityContext"

function MyComponent() {
  const city = useCurrentCity() // 确保已选择城市

  return <div>{city.name}</div>
}
```

#### 安全获取城市（可能为 null）
```tsx
import { useCurrentCitySafe } from "@/contexts/CityContext"

function MyComponent() {
  const city = useCurrentCitySafe()

  if (!city) {
    return <div>请先选择城市</div>
  }

  return <div>{city.name}</div>
}
```

### 3. 应用城市主题色

```tsx
function MyComponent() {
  const { currentCity } = useCity()

  if (!currentCity) return null

  return (
    <div
      style={{
        color: currentCity.theme.primary,
        borderColor: currentCity.theme.primary,
        background: `linear-gradient(135deg, ${currentCity.theme.primary}20, ${currentCity.theme.secondary}10)`,
      }}
    >
      使用城市主题色
    </div>
  )
}
```

### 4. 获取城市专属数据

```tsx
import { getCityById, getChallengesByCityId, getAchievementsByCityId } from "@/lib/mock-data"

function MyComponent() {
  const city = getCityById("beijing")
  const challenges = getChallengesByCityId("beijing")
  const achievements = getAchievementsByCityId("beijing")

  return (
    <div>
      <h2>{city?.name}</h2>
      <p>{challenges.length} 个挑战</p>
      <p>{achievements.length} 个成就</p>
    </div>
  )
}
```

## 🎨 Z-Index 参考

```
z-[201]  - CityDrawer（抽屉本体）
z-[200]  - CityDrawer 背景遮罩
z-[100]  - MapHeader（地图头部）
z-[90]   - CityActivityBanner（活动横幅）
z-[50]   - 其他地图 UI 元素
z-[20]   - 地图覆盖层
z-[10]   - 基础地图
```

## 📋 组件 Props 参考

### MapHeader
无 Props，自动从 CityContext 获取数据。

### CityDrawer
```tsx
interface CityDrawerProps {
  isOpen: boolean      // 是否打开
  onClose: () => void  // 关闭回调
}
```

### CityActivityBanner
无 Props，自动从 CityContext 获取数据。

## 🎯 常见场景

### 场景 1: 显示当前城市信息
```tsx
import { useCity } from "@/contexts/CityContext"

function CityInfoCard() {
  const { currentCity, currentCityProgress } = useCity()

  if (!currentCity) return null

  return (
    <div style={{ borderLeft: `4px solid ${currentCity.theme.primary}` }}>
      <h3>{currentCity.name}</h3>
      <p>{currentCity.stats.activePlayers} 活跃玩家</p>
      {currentCityProgress && (
        <p>我的排名: #{currentCityProgress.ranking}</p>
      )}
    </div>
  )
}
```

### 场景 2: 城市列表
```tsx
import { getAllCities } from "@/lib/mock-data"

function CityList() {
  const cities = getAllCities()

  return (
    <div>
      {cities.map(city => (
        <div key={city.id} style={{ borderLeftColor: city.theme.primary }}>
          {city.icon} {city.name}
        </div>
      ))}
    </div>
  )
}
```

### 场景 3: 条件渲染城市专属内容
```tsx
import { useCity } from "@/contexts/CityContext"

function CitySpecificContent() {
  const { currentCity } = useCity()

  if (!currentCity) return null

  const content: Record<string, JSX.Element> = {
    beijing: <div>🏯 北京专属内容</div>,
    shanghai: <div>🌃 上海专属内容</div>,
    chengdu: <div>🍲 成都专属内容</div>,
    guangzhou: <div>🏮 广州专属内容</div>,
  }

  return content[currentCity.id] || <div>通用内容</div>
}
```

### 场景 4: 跑步按钮控制
```tsx
import { useState } from "react"

function RunButton() {
  const [isRunning, setIsRunning] = useState(false)

  return (
    <button
      onClick={() => setIsRunning(!isRunning)}
      style={{
        background: isRunning ? '#dc2626' : '#22c55e'
      }}
    >
      {isRunning ? '停止跑步' : '开始跑步'}
    </button>
  )
}
```

## 🔧 辅助函数

### 数据格式化
```tsx
// 这些函数在 MapHeader.tsx 中定义，可以导入使用
formatPace(402)        // "6'42""
formatDistance(1200)    // "1.2km"
formatDistance(500)     // "500m"
formatDuration(754)     // "12:34"
formatDuration(3600)    // "1:00:00"
```

### 城市热度计算
```tsx
function getCityHeat(activePlayers: number, maxPlayers: number) {
  const ratio = activePlayers / maxPlayers
  if (ratio > 0.8) return { label: "🔥 热门", color: "text-orange-400" }
  if (ratio > 0.5) return { label: "⚡ 活跃", color: "text-yellow-400" }
  return { label: "✨ 新兴", color: "text-blue-400" }
}
```

### 占领率计算
```tsx
function calculateCaptureRate(captured: number, total: number) {
  return ((captured / total) * 100).toFixed(1) + '%'
}
```

## 🐛 调试技巧

### 检查当前城市
```tsx
const { currentCity } = useCity()
console.log('当前城市:', currentCity)
console.log('城市主题色:', currentCity?.theme.primary)
```

### 查看所有城市
```tsx
import { getAllCities } from "@/lib/mock-data"
console.log('所有城市:', getAllCities())
```

### 查看城市切换历史
```tsx
const { switchHistory } = useCity()
console.log('切换历史:', switchHistory)
```

### 清除本地存储（重置）
```tsx
// 清除城市选择
localStorage.removeItem("currentCityId")

// 清除已关闭的活动
localStorage.removeItem("dismissedActivities")

// 刷新页面生效
location.reload()
```

## 📱 响应式类名

```tsx
// 头部容器
className="absolute top-0 left-0 right-0 z-[100]"

// 抽屉
className="fixed top-0 right-0 bottom-0 z-[201] w-full max-w-md"

// 活动横幅
className="fixed top-[88px] left-4 right-4 z-[90] space-y-2"
```

## 🎨 Tailwind 工具类

### 渐变背景
```tsx
bg-gradient-to-br from-white/10 to-transparent
bg-gradient-to-r from-white/10 to-white/5
```

### 毛玻璃效果
```tsx
backdrop-blur-xl
bg-white/5
bg-slate-900/95
```

### 边框
```tsx
border border-white/10
border-l-3
border-l-[${city.theme.primary}]
```

### 阴影
```tsx
shadow-2xl
shadow-lg
drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))
```

## 📚 更多资源

- **完整使用指南**: `docs/CITY_SYSTEM_GUIDE.md`
- **UI 组件指南**: `docs/CITY_UI_GUIDE.md`
- **开发总结**: `docs/CITY_SYSTEM_SUMMARY.md`
- **类型定义**: `types/city.ts`
- **模拟数据**: `lib/mock-data.ts`
- **Context 实现**: `contexts/CityContext.tsx`

---

**最后更新**: 2025-01-26
**版本**: 1.0.0
**状态**: ✅ 已完成
