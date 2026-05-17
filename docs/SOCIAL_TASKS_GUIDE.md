# 社交互动与任务系统使用指南

## 概述

本指南介绍了 City Lord 游戏的社交互动与任务系统组件，包括好友动态流、好友挑战和任务中心。

## 目录

- [SocialFeed - 好友动态流](#socialfeed---好友动态流)
- [FriendChallengeCard - 好友挑战卡片](#friendchallengecard---好友挑战卡片)
- [TaskCenter - 任务中心](#taskcenter---任务中心)
- [TaskCompletionAnimation - 任务完成动画](#taskcompletionanimation---任务完成动画)
- [集成示例](#集成示例)

---

## SocialFeed - 好友动态流

半透明的浮层，滚动显示好友的实时动态消息。

### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `position` | `"bottom-left"` \| `"bottom-right"` \| `"top-left"` \| `"top-right"` | `"bottom-left"` | 显示位置 |
| `maxItems` | `number` | `3` | 最大显示条目数 |
| `autoScroll` | `boolean` | `true` | 是否自动滚动 |
| `scrollInterval` | `number` | `4000` | 自动滚动间隔（毫秒） |
| `onDismiss` | `() => void` | - | 关闭回调 |
| `onCollapse` | `() => void` | - | 折叠回调 |

### SocialFeedItem 类型

```typescript
interface SocialFeedItem {
  id: string
  userId: string
  userName: string
  userAvatar: string
  userLevel: number
  action: "capture" | "achievement" | "challenge" | "levelup"
  actionText: string
  location?: string
  timestamp: Date
  cityName?: string
}
```

### 使用示例

```tsx
import { SocialFeed } from "@/components/social"

<SocialFeed
  position="bottom-left"
  maxItems={3}
  autoScroll={true}
  onDismiss={() => console.log("关闭")}
  onCollapse={() => console.log("折叠")}
/>
```

### 特性

- **多种位置选项**: 支持四个角落的位置
- **自动滚动**: 自动轮播显示好友动态
- **动作类型**: 支持占领、成就、挑战、升级四种类型
- **动画效果**: 平滑的进入和切换动画
- **折叠/关闭**: 可折叠和关闭，不遮挡地图
- **响应式**: 适配不同屏幕尺寸

---

## FriendChallengeCard - 好友挑战卡片

显示好友的挑战信息，包括头像、等级、挑战类型和操作按钮。

### FriendChallengeCardProps

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `challenge` | `FriendChallenge` | - | 挑战数据 |
| `onAccept` | `(challengeId: string) => void` | - | 接受挑战回调 |
| `onReject` | `(challengeId: string) => void` | - | 拒绝挑战回调 |
| `onViewProfile` | `(userId: string) => void` | - | 查看个人资料回调 |
| `compact` | `boolean` | `false` | 是否紧凑模式 |

### FriendChallenge 类型

```typescript
interface FriendChallenge {
  id: string
  userId: string
  userName: string
  userAvatar: string
  userLevel: number
  totalTiles: number
  winRate: number
  challengeType: "conquest" | "defense" | "speed"
  challengeText: string
  difficulty: "easy" | "medium" | "hard"
  timeRemaining: string
  isOnline: boolean
}
```

### 使用示例

```tsx
import { FriendChallengeCard, FriendChallengeList } from "@/components/social"

<FriendChallengeList
  maxDisplay={3}
  compact={false}
  onAccept={(id) => console.log("接受:", id)}
  onReject={(id) => console.log("拒绝:", id)}
/>
```

### 特性

- **三种挑战类型**: 征服、防守、竞速
- **难度等级**: 简单、中等、困难
- **在线状态**: 显示好友是否在线
- **统计数据**: 显示好友的占领数和胜率
- **紧凑模式**: 支持紧凑显示，节省空间

---

## TaskCenter - 任务中心

包含每日任务和城市专属任务的任务管理系统。

### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `onTaskComplete` | `(taskId: string) => void` | - | 任务完成回调 |
| `onTaskStart` | `(taskId: string) => void` | - | 开始任务回调 |
| `defaultTab` | `"daily"` \| `"city"` | `"daily"` | 默认标签页 |

### Task 类型

```typescript
interface Task {
  id: string
  title: string
  description: string
  type: "daily" | "city" | "weekly" | "special"
  icon: React.ReactNode
  target: number
  current: number
  reward: {
    points: number
    experience: number
  }
  status: TaskStatus
  isTimeLimited?: boolean
  timeRemaining?: string
  isMainQuest?: boolean
}
```

### TaskStatus

```typescript
type TaskStatus = "todo" | "in-progress" | "completed"
```

### 使用示例

```tsx
import { TaskCenter } from "@/components/tasks"

<TaskCenter
  defaultTab="daily"
  onTaskComplete={(taskId) => console.log("任务完成:", taskId)}
  onTaskStart={(taskId) => console.log("开始任务:", taskId)}
/>
```

### 特性

- **两种任务类型**: 每日任务和城市专属任务
- **三种状态**: 未开始、进行中、已完成
- **进度追踪**: 实时显示任务进度
- **奖励展示**: 清晰显示积分和经验奖励
- **主线任务**: 高亮显示主线任务
- **限时任务**: 显示时间限制标记

---

## TaskCompletionAnimation - 任务完成动画

任务完成时的全屏庆祝动画，带有粒子效果。

### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `isActive` | `boolean` | - | 是否显示动画 |
| `taskTitle` | `string` | - | 任务标题 |
| `rewardPoints` | `number` | - | 奖励积分 |
| `rewardExperience` | `number` | - | 奖励经验 |
| `onComplete` | `() => void` | - | 动画完成回调 |
| `duration` | `number` | `2000` | 动画持续时间（毫秒） |

### 使用示例

```tsx
import { TaskCompletionAnimation } from "@/components/tasks"

<TaskCompletionAnimation
  isActive={showAnimation}
  taskTitle="占领 5 个六边形"
  rewardPoints={100}
  rewardExperience={50}
  onComplete={() => setShowAnimation(false)}
  duration={2000}
/>
```

### 特性

- **粒子爆炸**: 30 个彩色粒子从中心扩散
- **脉冲环**: 主图标周围有脉冲环动画
- **城市主题色**: 自动应用当前城市主题色
- **奖励展示**: 清晰显示积分和经验奖励
- **自动关闭**: 动画完成后自动关闭

---

## 集成示例

### 完整示例

```tsx
"use client"

import { useState } from "react"
import { SocialFeed, FriendChallengeList, TaskCenter, TaskCompletionAnimation } from "@/components"
import { MapHeader } from "@/components/map/MapHeader"

export default function SocialTasksPage() {
  const [showTaskCompletion, setShowTaskCompletion] = useState(false)

  return (
    <div className="h-screen w-screen overflow-hidden">
      {/* 地图头部 */}
      <MapHeader />

      {/* 主内容区 */}
      <div className="relative h-[calc(100vh-7rem)]">
        {/* 地图内容 */}

        {/* 社交动态流 */}
        <SocialFeed
          position="bottom-left"
          maxItems={3}
        />

        {/* 好友挑战 */}
        <div className="absolute top-24 right-4 z-[70] w-80">
          <div className="rounded-2xl bg-black/80 backdrop-blur-xl p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">好友挑战</h3>
            <FriendChallengeList
              maxDisplay={2}
              compact={true}
              onAccept={(id) => console.log("接受:", id)}
              onReject={(id) => console.log("拒绝:", id)}
            />
          </div>
        </div>
      </div>

      {/* 任务完成动画 */}
      <TaskCompletionAnimation
        isActive={showTaskCompletion}
        taskTitle="占领 5 个六边形"
        rewardPoints={100}
        rewardExperience={50}
        onComplete={() => setShowTaskCompletion(false)}
      />
    </div>
  )
}
```

### 在地图页面集成

```tsx
// app/page.tsx
import { SocialFeed } from "@/components/social"
import { TaskCenter } from "@/components/tasks"

function CityLordAppContent() {
  const [activeTab, setActiveTab] = useState<TabType>("map")

  return (
    <>
      {/* 地图视图 */}
      {activeTab === "map" && (
        <>
          <MapHeader />
          <div className="relative h-full">
            {/* 地图内容 */}

            {/* 社交动态流 */}
            <SocialFeed position="bottom-left" />
          </div>
        </>
      )}

      {/* 任务页面 */}
      {activeTab === "missions" && (
        <TaskCenter />
      )}
    </>
  )
}
```

---

## 移动端布局优化

### Z-Index 层级

```
z-[70]   - 好友挑战列表
z-[60]   - 社交动态流
z-[50]   - 任务完成动画
z-[40]   - 其他 UI 元素
```

### 不遮挡地图核心操作区

所有社交和任务组件都设计为不遮挡地图的核心操作区：

1. **SocialFeed**: 默认位于左下角，可折叠和关闭
2. **FriendChallengeCard**: 位于右上角，紧凑模式下占用空间小
3. **TaskCenter**: 独立页面，不与地图同时显示

### 响应式设计

```tsx
// 移动端：调整组件大小
<div className="fixed bottom-24 left-4 right-4 z-[60] max-w-sm">
  <SocialFeed maxItems={2} />
</div>

// 桌面端：调整位置和大小
<div className="fixed bottom-24 left-8 z-[60] w-[400px]">
  <SocialFeed maxItems={3} />
</div>
```

---

## 最佳实践

1. **性能优化**
   - 使用 `autoScroll` 控制动态流轮播
   - 限制 `maxItems` 避免过度渲染
   - 使用 `compact` 模式节省空间

2. **用户体验**
   - 提供折叠和关闭功能
   - 使用动画增强交互反馈
   - 保持组件层级清晰

3. **数据管理**
   - 实时更新好友动态
   - 同步任务进度
   - 缓存用户头像和基本信息

4. **响应式布局**
   - 根据屏幕尺寸调整组件位置
   - 移动端优先设计
   - 避免遮挡地图核心操作区

---

## 演示页面

访问 `/social-demo` 路由查看完整的演示页面。

---

## 扩展建议

1. **实时数据**
   - 集成 WebSocket 实现实时好友动态
   - 使用 Server-Sent Events (SSE) 推送任务更新

2. **交互增强**
   - 添加好友个人资料快速查看
   - 实现挑战接受后的对战界面
   - 添加任务分享功能

3. **数据分析**
   - 统计好友活跃度
   - 分析任务完成率
   - 追踪挑战成功率

4. **个性化**
   - 根据用户喜好调整组件显示
   - 支持自定义组件位置和样式
   - 记忆用户的折叠/展开状态
