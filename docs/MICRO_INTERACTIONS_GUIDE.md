# 微交互动效系统使用指南

## 概述

本指南介绍了 City Lord 游戏的微交互动效系统，包括占领反馈、数字滚动、城市切换转场和主题适配。

## 目录

- [占领反馈动画](#占领反馈动画)
- [数字滚动动画](#数字滚动动画)
- [城市切换转场](#城市切换转场)
- [主题适配组件](#主题适配组件)
- [全局 CSS 动画](#全局-css-动画)
- [集成示例](#集成示例)

---

## 占领反馈动画

### CaptureRipple - 圆形波纹效果

从中心向外扩散的圆形波纹动画，用于一般的占领反馈。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `x` | `number` | - | 波纹中心的 X 坐标 |
| `y` | `number` | - | 波纹中心的 Y 坐标 |
| `color` | `string` | `"#22c55e"` | 波纹颜色 |
| `size` | `number` | `100` | 波纹大小（像素） |
| `duration` | `number` | `1000` | 动画持续时间（毫秒） |
| `onComplete` | `() => void` | - | 动画完成回调 |
| `isTriggered` | `boolean` | `true` | 是否触发动画 |

#### 使用示例

```tsx
import { CaptureRipple } from "@/components/micro-interactions"

<CaptureRipple
  x={window.innerWidth / 2}
  y={window.innerHeight / 2}
  color="#22c55e"
  size={150}
  duration={1000}
  onComplete={() => console.log("动画完成")}
  isTriggered={isAnimating}
/>
```

---

### HexCaptureRipple - 六边形波纹效果

专为六边形网格设计的占领动画，从中心向外扩散六边形波纹。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `centerX` | `number` | - | 中心点的 X 坐标 |
| `centerY` | `number` | - | 中心点的 Y 坐标 |
| `hexSize` | `number` | - | 六边形的大小 |
| `color` | `string` | `"#22c55e"` | 波纹颜色 |
| `onComplete` | `() => void` | - | 动画完成回调 |
| `isTriggered` | `boolean` | `true` | 是否触发动画 |

#### 使用示例

```tsx
import { HexCaptureRipple } from "@/components/micro-interactions"

<HexCaptureRipple
  centerX={x}
  centerY={y}
  hexSize={30}
  color={currentCity?.themeColors.primary || "#22c55e"}
  onComplete={() => setAnimating(false)}
  isTriggered={isAnimating}
/>
```

---

## 数字滚动动画

### CountingNumber - 基础计数器

通用的数字滚动动画组件，支持自定义格式化。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `value` | `number` | - | 目标值 |
| `duration` | `number` | `1500` | 动画持续时间（毫秒） |
| `decimals` | `number` | `0` | 小数位数 |
| `formatValue` | `(value: number) => string` | - | 自定义格式化函数 |
| `className` | `string` | `""` | 自定义样式类名 |
| `isTriggered` | `boolean` | `true` | 是否触发动画 |
| `onAnimationComplete` | `() => void` | - | 动画完成回调 |

#### 使用示例

```tsx
import { CountingNumber } from "@/components/micro-interactions"

<CountingNumber
  value={1000}
  duration={1000}
  decimals={2}
  formatValue={(value) => `$${value.toFixed(2)}`}
  isTriggered={isAnimating}
/>
```

---

### CountingArea - 面积计数器

专门用于显示占领面积的计数组件，支持 m²、km²、tiles 三种单位。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `area` | `number` | - | 面积值（平方米） |
| `duration` | `number` | `1500` | 动画持续时间（毫秒） |
| `unit` | `"m²"` \| `"km²"` \| `"tiles"` | `"m²"` | 单位 |
| `className` | `string` | `""` | 自定义样式类名 |
| `isTriggered` | `boolean` | `true` | 是否触发动画 |

#### 使用示例

```tsx
import { CountingArea } from "@/components/micro-interactions"

<CountingArea
  area={125000}
  unit="m²"
  duration={1500}
  isTriggered={isAnimating}
/>
```

---

### CountingDistance - 距离计数器

专门用于显示跑步距离的计数组件，支持米和公里单位。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `distance` | `number` | - | 距离值（米） |
| `duration` | `number` | `1500` | 动画持续时间（毫秒） |
| `unit` | `"m"` \| `"km"` | `"km"` | 单位 |
| `decimals` | `number` | `2` | 小数位数 |
| `className` | `string` | `""` | 自定义样式类名 |
| `isTriggered` | `boolean` | `true` | 是否触发动画 |

#### 使用示例

```tsx
import { CountingDistance } from "@/components/micro-interactions"

<CountingDistance
  distance={5000}
  unit="km"
  decimals={2}
  duration={1500}
  isTriggered={isAnimating}
/>
```

---

### CountingPoints - 积分计数器

专门用于显示积分奖励的计数组件，自动添加 "+" 前缀。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `points` | `number` | - | 积分值 |
| `duration` | `number` | `1500` | 动画持续时间（毫秒） |
| `decimals` | `number` | `0` | 小数位数 |
| `className` | `string` | `""` | 自定义样式类名 |
| `isTriggered` | `boolean` | `true` | 是否触发动画 |

#### 使用示例

```tsx
import { CountingPoints } from "@/components/micro-interactions"

<CountingPoints
  points={500}
  duration={1500}
  isTriggered={isAnimating}
/>
```

---

## 城市切换转场

### CityTransition - 飞机飞行模式

显示飞机从一个城市飞往另一个城市的转场动画。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `fromCityName` | `string` | - | 出发城市名称 |
| `toCityName` | `string` | - | 目的地城市名称 |
| `isActive` | `boolean` | - | 是否显示转场 |
| `onComplete` | `() => void` | - | 转场完成回调 |
| `duration` | `number` | `2000` | 动画持续时间（毫秒） |

#### 使用示例

```tsx
import { CityTransition } from "@/components/micro-interactions"

<CityTransition
  fromCityName="北京"
  toCityName="上海"
  isActive={isTransitioning}
  onComplete={() => setTransitioning(false)}
  duration={2000}
/>
```

---

### MapSweepTransition - 地图扫掠模式

显示地图快速扫掠的转场效果，带有装饰性粒子。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `fromCity` | `{ name: string; color: string }` | - | 出发城市 |
| `toCity` | `{ name: string; color: string }` | - | 目的地城市 |
| `isActive` | `boolean` | - | 是否显示转场 |
| `onComplete` | `() => void` | - | 转场完成回调 |
| `duration` | `number` | `2500` | 动画持续时间（毫秒） |

#### 使用示例

```tsx
import { MapSweepTransition } from "@/components/micro-interactions"

<MapSweepTransition
  fromCity={{ name: "成都", color: "#22c55e" }}
  toCity={{ name: "广州", color: "#f59e0b" }}
  isActive={isTransitioning}
  onComplete={() => setTransitioning(false)}
  duration={2500}
/>
```

---

## 主题适配组件

### ThemedGradientButton - 主题感知按钮

根据当前主题和城市自动应用渐变色和阴影的按钮组件。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `variant` | `"primary"` \| `"secondary"` \| `"success"` \| `"danger"` | `"primary"` | 按钮变体 |
| `size` | `"sm"` \| `"md"` \| `"lg"` | `"md"` | 按钮大小 |
| `children` | `React.ReactNode` | - | 按钮内容 |
| `className` | `string` | `""` | 自定义样式类名 |
| `...buttonProps` | `React.ButtonHTMLAttributes` | - | 其他按钮属性 |

#### 使用示例

```tsx
import { ThemedGradientButton } from "@/components/micro-interactions"

<ThemedGradientButton
  variant="primary"
  size="md"
  onClick={handleClick}
>
  点击我
</ThemedGradientButton>
```

---

### ThemedCard - 主题感知卡片

根据当前主题和城市自动应用样式和效果的卡片组件。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `children` | `React.ReactNode` | - | 卡片内容 |
| `className` | `string` | `""` | 自定义样式类名 |
| `variant` | `"default"` \| `"glow"` \| `"bordered"` | `"default"` | 卡片变体 |
| `interactive` | `boolean` | `false` | 是否可交互 |

#### 使用示例

```tsx
import { ThemedCard } from "@/components/micro-interactions"

<ThemedCard variant="glow" interactive className="p-4">
  <h3 className="text-white">卡片标题</h3>
  <p className="text-white/60">卡片内容</p>
</ThemedCard>
```

---

### ThemedProgressBar - 主题感知进度条

根据当前主题和城市自动应用渐变色和动画的进度条。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `progress` | `number` | - | 进度值（0-100） |
| `size` | `"sm"` \| `"md"` \| `"lg"` | `"md"` | 进度条大小 |
| `animated` | `boolean` | `true` | 是否动画 |
| `showPercentage` | `boolean` | `false` | 是否显示百分比 |
| `className` | `string` | `""` | 自定义样式类名 |

#### 使用示例

```tsx
import { ThemedProgressBar } from "@/components/micro-interactions"

<ThemedProgressBar
  progress={75}
  size="md"
  animated={true}
  showPercentage={true}
/>
```

---

## 全局 CSS 动画

### 新增动画

| 动画名称 | 描述 | 持续时间 |
|----------|------|----------|
| `ripple-out` | 圆形波纹向外扩散 | 1s |
| `ripple-flash` | 中心闪光效果 | 0.8s |
| `hex-ripple-out` | 六边形波纹向外扩散 | 1.5s |
| `hex-flash` | 六边形中心闪光 | 1s |
| `trail` | 飞机尾迹效果 | 0.8s |
| `grid-scroll` | 网格滚动背景 | 2s |
| `particle-float` | 粒子浮动效果 | 2s |
| `shimmer` | 按钮光泽效果 | 2s |
| `count-pop` | 数字弹出效果 | 0.3s |
| `theme-fade` | 主题切换淡入 | 0.3s |
| `btn-glow` | 按钮发光效果 | 2s |
| `progress-pulse` | 进度条脉冲 | 2s |

### 使用 CSS 动画类

```tsx
<div className="animate-ripple-out" />
<div className="animate-shimmer" />
<div className="animate-count-pop" />
<div className="animate-btn-glow" />
```

---

## 集成示例

### 完整示例：占领六边形

```tsx
"use client"

import { useState } from "react"
import { HexCaptureRipple, CountingArea, CountingPoints } from "@/components/micro-interactions"
import { useCity } from "@/contexts/CityContext"

function HexGridItem() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [capturedArea, setCapturedArea] = useState(0)
  const { currentCity } = useCity()

  const handleCapture = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2

    setIsCapturing(true)
    setCapturedArea((prev) => prev + 500)

    setTimeout(() => {
      setIsCapturing(false)
    }, 1500)
  }

  return (
    <div onClick={handleCapture} className="relative">
      {/* 六边形 */}
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />
      </svg>

      {/* 占领波纹动画 */}
      {isCapturing && (
        <HexCaptureRipple
          centerX={x}
          centerY={y}
          hexSize={50}
          color={currentCity?.themeColors.primary || "#22c55e"}
          isTriggered={isCapturing}
        />
      )}
    </div>
  )
}
```

---

### 完整示例：城市切换

```tsx
"use client"

import { useState } from "react"
import { CityTransition, MapSweepTransition } from "@/components/micro-interactions"
import { useCity } from "@/contexts/CityContext"

function CitySwitcher() {
  const [transitionMode, setTransitionMode] = useState<"flight" | "sweep">("flight")
  const [isTransitioning, setIsTransitioning] = useState(false)
  const { currentCity, switchCity } = useCity()

  const handleCitySwitch = async (newCityId: string) => {
    setIsTransitioning(true)

    // 等待转场动画
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // 切换城市
    await switchCity(newCityId)

    setIsTransitioning(false)
  }

  return (
    <>
      {/* 转场动画 */}
      {transitionMode === "flight" ? (
        <CityTransition
          fromCityName={currentCity?.name || "当前城市"}
          toCityName="新城市"
          isActive={isTransitioning}
          duration={2000}
        />
      ) : (
        <MapSweepTransition
          fromCity={{ name: currentCity?.name || "当前", color: currentCity?.themeColors.primary || "#3b82f6" }}
          toCity={{ name: "新城市", color: "#22c55e" }}
          isActive={isTransitioning}
          duration={2500}
        />
      )}
    </>
  )
}
```

---

### 完整示例：数字滚动

```tsx
"use client"

import { useState } from "react"
import { CountingNumber, CountingArea, CountingDistance, CountingPoints } from "@/components/micro-interactions"

function StatsDisplay() {
  const [stats, setStats] = useState({
    area: 50000,
    distance: 1200,
    points: 1000,
  })

  const updateStats = () => {
    setStats((prev) => ({
      area: prev.area + 10000,
      distance: prev.distance + 500,
      points: prev.points + 200,
    }))
  }

  return (
    <div className="space-y-4">
      {/* 面积 */}
      <div>
        <p className="text-sm text-white/60">占领面积</p>
        <CountingArea value={stats.area} unit="m²" isTriggered />
      </div>

      {/* 距离 */}
      <div>
        <p className="text-sm text-white/60">跑步距离</p>
        <CountingDistance value={stats.distance} unit="km" isTriggered />
      </div>

      {/* 积分 */}
      <div>
        <p className="text-sm text-white/60">获得积分</p>
        <CountingPoints value={stats.points} isTriggered />
      </div>

      {/* 更新按钮 */}
      <button onClick={updateStats}>
        更新统计
      </button>
    </div>
  )
}
```

---

## 最佳实践

1. **性能优化**
   - 使用 `isTriggered` 控制动画触发
   - 合理设置动画时长
   - 避免同时播放过多动画

2. **用户体验**
   - 提供动画完成回调
   - 支持动画跳过
   - 保持动画流畅性

3. **主题适配**
   - 使用城市主题色
   - 支持多主题切换
   - 保持视觉一致性

4. **响应式设计**
   - 根据屏幕尺寸调整动画参数
   - 移动端优先
   - 优化动画性能

---

## 演示页面

访问 `/micro-interactions-demo` 路由查看完整的微交互动画演示页面。

---

## 扩展建议

1. **更多动画类型**
   - 粒子系统
   - 3D 动画
   - 物理效果

2. **交互增强**
   - 触摸反馈
   - 鼠标跟随
   - 手势支持

3. **性能优化**
   - Web Animations API
   - CSS 动画优先
   - 减少重绘

4. **可访问性**
   - 减少动画选项
   - 偏好设置
   - ARIA 支持
