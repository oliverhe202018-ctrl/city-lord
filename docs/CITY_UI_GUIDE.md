# 城市切换 UI 组件使用指南

## 概述

本指南介绍新开发的城市切换 UI 组件，包括地图头部状态栏、城市切换抽屉和城市活动横幅。

## 组件清单

### 1. MapHeader（地图头部状态栏）

**文件位置**: `components/map/MapHeader.tsx`

**功能**:
- 左侧：当前城市名称 + 图标（点击弹出城市切换抽屉）
- 中间：赛季进度条（显示当前赛季、剩余天数、进度百分比）
- 右侧：跑步实时数据小组件（配速、距离、时长）

**Z-Index**: `z-[100]`

**使用方法**:
```tsx
import { MapHeader } from "@/components/map/MapHeader"

export default function Page() {
  return (
    <div className="relative h-screen">
      <MapHeader />
      {/* 其他内容 */}
    </div>
  )
}
```

**功能特性**:
- ✅ 自动从 `CityContext` 获取当前城市信息
- ✅ 实时跑步数据模拟（配速、距离、时长）
- ✅ 赛季进度计算和显示
- ✅ 城市主题色自动应用
- ✅ 渐变遮罩背景确保文字可读性
- ✅ 开始/停止跑步功能

**跑步状态**:
- **未跑步**: 显示"开始跑步"按钮
- **跑步中**: 显示实时配速、距离、时长，带有脉冲动画

### 2. CityDrawer（城市切换抽屉）

**文件位置**: `components/map/CityDrawer.tsx`

**功能**:
- 从右侧滑出的城市选择面板
- 城市搜索功能
- 城市列表卡片展示
- 切换城市动画和加载状态
- 城市热度标签（热门/活跃/新兴）
- 占领进度条显示

**Z-Index**: `z-[201]`（抽屉）/ `z-[200]`（遮罩）

**使用方法**:
```tsx
import { CityDrawer } from "@/components/map/CityDrawer"

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>打开城市选择</button>
      <CityDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
```

**功能特性**:
- ✅ 从右侧滑入动画
- ✅ 实时搜索过滤
- ✅ 当前城市高亮显示
- ✅ 切换加载状态动画
- ✅ 城市热度标签
- ✅ 占领率进度条
- ✅ 底部提示信息
- ✅ 模拟地图视口跳转（500ms 动画）

**热度等级**:
- 🌡️ **热门** (活跃玩家 > 80%): 橙色
- ⚡ **活跃** (活跃玩家 50-80%): 黄色
- ✨ **新兴** (活跃玩家 < 50%): 蓝色

### 3. CityActivityBanner（城市活动横幅）

**文件位置**: `components/map/CityActivityBanner.tsx`

**功能**:
- 显示当前城市的专属活动
- 支持多种活动类型（双倍奖励、特殊活动、赛季开始、节日）
- 剩余时间倒计时
- 可关闭横幅（记录到 localStorage）
- 即将结束提醒（< 24 小时）

**Z-Index**: `z-[90]`

**使用方法**:
```tsx
import { CityActivityBanner } from "@/components/map/CityActivityBanner"

export default function Page() {
  return (
    <div className="relative h-screen">
      <CityActivityBanner />
      {/* 其他内容 */}
    </div>
  )
}
```

**功能特性**:
- ✅ 自动根据当前城市显示活动
- ✅ 每个城市专属活动配置
- ✅ 剩余时间实时计算
- ✅ 手动关闭（持久化存储）
- ✅ 即将结束警告（< 24h 红色脉冲）
- ✅ 活动进度条（限时活动）
- ✅ 优雅的进入动画

**活动类型**:
- **double_reward**: 双倍奖励活动
- **special_event**: 特殊活动
- **season_start**: 赛季开始
- **holiday**: 节日活动

**城市专属活动**:
- 🏯 **北京**: 故宫征服双倍奖励
- 🌃 **上海**: 外滩夜景征服挑战
- 🍲 **成都**: 火锅能量双倍活动
- 🏮 **广州**: 岭南文化周

## Z-Index 层级说明

```
z-[201]  - CityDrawer（抽屉本体）
z-[200]  - CityDrawer 背景遮罩
z-[100]  - MapHeader（地图头部）
z-[90]   - CityActivityBanner（活动横幅）
z-[50]   - 其他地图 UI 元素
```

## 城市主题色应用

每个城市都有独立的主题色配置：

```tsx
const theme = {
  primary: "#dc2626",   // 主色（进度条、按钮等）
  secondary: "#fca5a5", // 次要色（渐变等）
  accent: "#fef2f2",    // 强调色
  glow: "drop-shadow(0 0 8px rgba(220, 38, 38, 0.6))", // 发光效果
}
```

**应用示例**:
```tsx
<div style={{ color: city.theme.primary }}>
  使用城市主色
</div>

<div style={{
  background: `linear-gradient(90deg, ${city.theme.primary}, ${city.theme.secondary})`
}}>
  使用城市渐变
</div>
```

## 跑步实时数据

### MapHeader 中的跑步数据

**未跑步状态**:
```tsx
// 显示"开始跑步"按钮
<button onClick={handleToggleRunning}>
  <Navigation className="w-4 h-4 text-green-400" />
  <span>开始跑步</span>
</button>
```

**跑步中状态**:
```tsx
// 显示实时数据
<div>
  <div>配速: 6'42"</div>
  <div>距离: 1.2km</div>
  <div>时长: 12:34</div>
</div>
```

**数据格式化函数**:
- `formatPace(seconds)`: 秒 -> "X'XX""
- `formatDistance(meters)`: 米 -> "X.XXkm" 或 "XXXm"
- `formatDuration(seconds)`: 秒 -> "HH:MM:SS" 或 "MM:SS"

### 模拟数据更新

跑步状态下，每秒自动更新：
```tsx
setInterval(() => {
  setRunningStats(prev => ({
    ...prev,
    duration: prev.duration + 1,
    distance: prev.distance + 3.5, // 3.5m/s
    pace: calculatePace(prev.duration, prev.distance),
  }))
}, 1000)
```

## 集成到现有页面

### 更新 app/page.tsx

```tsx
import { MapHeader } from "@/components/map/MapHeader"
import { CityActivityBanner } from "@/components/map/CityActivityBanner"

// 在地图视图中
{activeTab === "map" && (
  <div className="relative h-full">
    {/* 1. 地图头部状态栏 */}
    <MapHeader />

    {/* 2. 城市活动横幅（仅在非跑步状态显示） */}
    {!isRunning && <CityActivityBanner />}

    {/* 3. 调整其他 UI 元素位置 */}
    <div className="absolute top-[calc(env(safe-area-inset-top)+12rem)]">
      <DailyGoalCard />
    </div>

    {/* 4. 六边形网格 */}
    <HexGridOverlay />

    {/* 5. 其他内容 */}
  </div>
)}
```

### 调整位置

由于新增了头部和活动横幅，需要调整其他元素的位置：

- **Settings 按钮**: 从 `top-[calc(env(safe-area-inset-top)+1rem)]` 调整到 `top-[calc(env(safe-area-inset-top)+7rem)]`
- **Daily Goal Card**: 从 `top-[calc(env(safe-area-inset-top)+5rem)]` 调整到 `top-[calc(env(safe-area-inset-top)+12rem)]`

## 自定义配置

### 添加新城市活动

编辑 `CityActivityBanner.tsx`:

```tsx
const activities: Record<string, CityActivity[]> = {
  beijing: [
    {
      id: "bj-002",
      type: "special_event",
      title: "北京马拉松挑战",
      description: "完成42.195公里跑步，解锁专属成就！",
      icon: "🏃",
      theme: { primary: "#dc2626", secondary: "#fca5a5" },
      endTime: "2025-04-20T23:59:59",
      badge: "挑战",
    },
  ],
  // ... 其他城市
}
```

### 自定义活动横幅样式

修改 `CityActivityBanner.tsx` 中的样式配置：

```tsx
<div
  style={{
    background: `linear-gradient(135deg, ${activity.theme.primary}15 0%, ${activity.theme.secondary}10 100%)`,
    borderColor: `${activity.theme.primary}30`,
  }}
>
```

## 测试建议

### 测试场景

1. **城市切换测试**
   - ✅ 点击城市名称打开抽屉
   - ✅ 搜索城市功能
   - ✅ 切换到新城市
   - ✅ 验证主题色变化
   - ✅ 验证地图视口跳转

2. **跑步数据测试**
   - ✅ 点击"开始跑步"
   - ✅ 验证数据实时更新
   - ✅ 验证配速、距离、时长格式
   - ✅ 点击停止跑步

3. **活动横幅测试**
   - ✅ 验证不同城市显示不同活动
   - ✅ 关闭横幅
   - ✅ 刷新页面验证关闭状态持久化
   - ✅ 验证即将结束警告（修改 endTime 测试）

4. **响应式测试**
   - ✅ 不同屏幕尺寸下的布局
   - ✅ 横屏模式
   - ✅ 抽屉打开时的滚动

## 常见问题

### Q: 如何修改头部高度？

A: 修改 `MapHeader.tsx` 中的 padding 和布局：
```tsx
<div className="relative px-4 py-3">
  // 调整 padding 来改变高度
</div>
```

### Q: 如何添加更多城市？

A: 在 `lib/mock-data.ts` 中添加新的城市对象，并在 `CityActivityBanner.tsx` 中配置专属活动。

### Q: 如何禁用某个城市的活动？

A: 在 `getCityActivities` 函数中返回空数组：
```tsx
const activities: Record<string, CityActivity[]> = {
  beijing: [], // 禁用北京活动
  // ...
}
```

### Q: 如何修改跑步数据更新频率？

A: 在 `MapHeader.tsx` 中修改 `setInterval` 的间隔：
```tsx
const interval = setInterval(() => {
  // ...
}, 1000) // 修改为其他毫秒数
```

## 性能优化建议

1. **使用 React.memo**: 对卡片组件使用 `React.memo` 避免不必要的重渲染
2. **虚拟列表**: 城市列表过多时使用虚拟滚动
3. **防抖搜索**: 城市搜索添加防抖
4. **懒加载**: 活动横幅按需加载

## 下一步开发

- [ ] 集成真实 GPS 数据
- [ ] 实现地图视口真实跳转（使用地图库 API）
- [ ] 添加城市排行榜入口
- [ ] 实现活动参与功能
- [ ] 添加城市天气显示
- [ ] 支持更多城市
