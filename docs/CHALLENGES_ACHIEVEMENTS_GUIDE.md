# 城市挑战与成就系统 - 使用指南

## 概述

本指南介绍城市挑战与成就系统的完整 UI 模块，包括挑战卡片、挑战详情弹窗、挑战开始/完成动画、成就画廊、成就解锁弹窗等组件。

## 📦 组件清单

### 1. ChallengeCard（挑战卡片）

**文件**: `components/challenges/ChallengeCard.tsx`

**功能**:
- 显示挑战标题、描述、类型、目标、进度、奖励
- 支持紧凑模式和完整模式
- 显示剩余时间（限时挑战）
- 主线任务高亮显示
- 悬停动画效果
- 按城市主题色自动应用

**Props**:
```tsx
interface ChallengeCardProps {
  challenge: Challenge           // 挑战数据
  progress?: number             // 当前进度（0-100）
  onClick?: () => void         // 点击回调
  compact?: boolean            // 紧凑模式（默认 false）
}
```

**使用示例**:
```tsx
import { ChallengeCard } from "@/components/challenges"

<ChallengeCard
  challenge={challengeData}
  progress={65}
  onClick={() => console.log('点击挑战')}
/>
```

**紧凑模式**:
```tsx
<ChallengeCard
  challenge={challengeData}
  progress={65}
  compact={true}
  onClick={() => console.log('点击挑战')}
/>
```

---

### 2. ChallengeDetailModal（挑战详情弹窗）

**文件**: `components/challenges/ChallengeCard.tsx`

**功能**:
- 显示挑战完整信息
- 挑战类型标签
- 任务目标说明
- 奖励展示
- 时间限制提示
- "开始挑战"按钮
- 城市主题色背景

**Props**:
```tsx
interface ChallengeDetailModalProps {
  challenge: Challenge           // 挑战数据
  isOpen: boolean             // 是否打开
  onClose: () => void         // 关闭回调
  onStart: () => void         // 开始挑战回调
}
```

**使用示例**:
```tsx
import { ChallengeDetailModal } from "@/components/challenges"

<ChallengeDetailModal
  challenge={selectedChallenge}
  isOpen={showDetail}
  onClose={() => setShowDetail(false)}
  onStart={() => handleStart()}
/>
```

---

### 3. ChallengeStartTransition（挑战开始动画）

**文件**: `components/challenges/ChallengeStartTransition.tsx`

**功能**:
- 全屏过渡动画
- 三阶段动画：进入 → 保持 → 退出
- 粒子爆炸效果
- 挑战图标放大动画
- 城市主题色光晕
- 环形光晕扩散

**Props**:
```tsx
interface ChallengeStartTransitionProps {
  challenge: {
    name: string              // 挑战名称
    type: string              // 挑战类型
    description: string       // 挑战描述
  }
  isActive: boolean           // 是否激活
  onComplete: () => void     // 完成回调
}
```

**使用示例**:
```tsx
import { ChallengeStartTransition } from "@/components/challenges"

<ChallengeStartTransition
  challenge={{
    name: "紫禁城征服者",
    type: "conquest",
    description: "在北京市中心区域占领 50 个六边形",
  }}
  isActive={showAnimation}
  onComplete={() => setShowAnimation(false)}
/>
```

---

### 4. ChallengeCompleteAnimation（挑战完成动画）

**文件**: `components/challenges/ChallengeStartTransition.tsx`

**功能**:
- 全屏庆祝动画
- 彩带粒子爆炸
- 胜利图标
- 奖励展示（经验值、积分）
- 动画效果：弹跳、脉冲

**Props**:
```tsx
interface ChallengeCompleteAnimationProps {
  challenge: {
    name: string              // 挑战名称
    type: string              // 挑战类型
    rewards: {
      experience: number      // 经验值
      points: number         // 积分
    }
  }
  isActive: boolean           // 是否激活
  onComplete: () => void     // 完成回调
}
```

**使用示例**:
```tsx
import { ChallengeCompleteAnimation } from "@/components/challenges"

<ChallengeCompleteAnimation
  challenge={{
    name: "紫禁城征服者",
    type: "conquest",
    rewards: { experience: 500, points: 1000 }
  }}
  isActive={showComplete}
  onComplete={() => setShowComplete(false)}
/>
```

---

### 5. AchievementGallery（成就画廊）

**文件**: `components/achievements/AchievementGallery.tsx`

**功能**:
- 成就网格展示
- 按城市主题色渲染
- 三种状态：未解锁（灰色/锁图标）、可领取（高亮/呼吸动画）、已达成（金色）
- 等级分类：青铜、白银、黄金、铂金、钻石
- 过滤器：全部、未解锁、已达成
- 进度统计和进度条
- 成就详情弹窗
- 等级统计

**Props**:
```tsx
interface AchievementGalleryProps {
  achievements: Achievement[]          // 成就列表
  onUnlock?: (achievement: Achievement) => void  // 解锁回调
}
```

**使用示例**:
```tsx
import { AchievementGallery } from "@/components/achievements"
import { getAchievementsByCityId } from "@/lib/mock-data"

const achievements = getAchievementsByCityId("beijing")

<AchievementGallery
  achievements={achievements}
  onUnlock={(achievement) => console.log('解锁成就', achievement)}
/>
```

---

### 6. AchievementUnlockModal（成就解锁弹窗）

**文件**: `components/achievements/AchievementUnlockModal.tsx`

**功能**:
- 全屏解锁动画
- 粒子庆祝效果
- 三阶段动画：进入 → 庆祝 → 退出
- 成就图标旋转动画
- 奖励展示（经验值、积分）
- 领取奖励按钮
- 城市主题色光效

**Props**:
```tsx
interface AchievementUnlockModalProps {
  achievement: Achievement     // 成就数据
  isOpen: boolean             // 是否打开
  onClose: () => void         // 关闭回调
  onClaim: () => void         // 领取奖励回调
}
```

**使用示例**:
```tsx
import { AchievementUnlockModal } from "@/components/achievements"

<AchievementUnlockModal
  achievement={unlockedAchievement}
  isOpen={showUnlock}
  onClose={() => setShowUnlock(false)}
  onClaim={() => handleClaim()}
/>
```

---

### 7. AchievementUnlockBanner（成就解锁横幅）

**文件**: `components/achievements/AchievementUnlockModal.tsx`

**功能**:
- 小尺寸通知横幅
- 从顶部滑入
- 成就图标和名称
- 关闭按钮
- 城市主题色样式

**Props**:
```tsx
interface AchievementUnlockBannerProps {
  achievement: Achievement     // 成就数据
  isOpen: boolean             // 是否打开
  onClose: () => void         // 关闭回调
}
```

**使用示例**:
```tsx
import { AchievementUnlockBanner } from "@/components/achievements"

<AchievementUnlockBanner
  achievement={unlockedAchievement}
  isOpen={showBanner}
  onClose={() => setShowBanner(false)}
/>
```

---

## 🎨 设计系统

### 成就等级样式

| 等级 | 颜色 | 图标 | 样式 |
|------|------|------|------|
| 青铜 | 橙色 | Medal | from-orange-500/20 to-amber-600/10 |
| 白银 | 灰色 | Award | from-gray-400/20 to-slate-500/10 |
| 黄金 | 金色 | Trophy | from-yellow-500/20 to-amber-500/10 |
| 铂金 | 青色 | Crown | from-cyan-400/20 to-blue-500/10 |
| 钻石 | 紫色 | Diamond | from-purple-500/20 to-pink-500/10 |

### 成就状态

| 状态 | 描述 | 样式 | 动画 |
|------|------|------|------|
| 未解锁 | 未完成 | 灰色 + 锁图标 | 无 |
| 可领取 | 进度 > 80% | 高亮绿色 | 呼吸动画 |
| 已达成 | 已完成 | 金色 + 城市主题色 | 脉冲动画 |

### 挑战类型图标

| 类型 | 图标 | 名称 |
|------|------|------|
| conquest | Swords | 征服 |
| defense | Shield | 防守 |
| exploration | Compass | 探索 |
| social | Users | 社交 |
| daily | Clock | 每日 |

---

## 📱 完整使用示例

### 挑战系统完整流程

```tsx
"use client"

import { useState } from "react"
import { useCity } from "@/contexts/CityContext"
import { getChallengesByCityId } from "@/lib/mock-data"
import {
  ChallengeCard,
  ChallengeDetailModal,
  ChallengeStartTransition,
  ChallengeCompleteAnimation,
} from "@/components/challenges"

export default function MyChallengesPage() {
  const { currentCity } = useCity()
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [showStartAnimation, setShowStartAnimation] = useState(false)
  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false)

  const challenges = currentCity
    ? getChallengesByCityId(currentCity.id)
    : []

  const handleStartChallenge = () => {
    setShowStartAnimation(true)
  }

  const handleCompleteChallenge = () => {
    setShowCompleteAnimation(true)
  }

  return (
    <div>
      {/* 挑战列表 */}
      <div className="space-y-3">
        {challenges.map((challenge) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            progress={Math.random() * 100}
            onClick={() => setSelectedChallenge(challenge)}
          />
        ))}
      </div>

      {/* 挑战详情弹窗 */}
      {selectedChallenge && (
        <ChallengeDetailModal
          challenge={selectedChallenge}
          isOpen={!!selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
          onStart={handleStartChallenge}
        />
      )}

      {/* 挑战开始动画 */}
      <ChallengeStartTransition
        challenge={selectedChallenge}
        isActive={showStartAnimation}
        onComplete={() => setShowStartAnimation(false)}
      />

      {/* 挑战完成动画 */}
      <ChallengeCompleteAnimation
        challenge={selectedChallenge}
        isActive={showCompleteAnimation}
        onComplete={() => setShowCompleteAnimation(false)}
      />
    </div>
  )
}
```

### 成就系统完整流程

```tsx
"use client"

import { useState } from "react"
import { useCity } from "@/contexts/CityContext"
import { getAchievementsByCityId } from "@/lib/mock-data"
import {
  AchievementGallery,
  AchievementUnlockModal,
  AchievementUnlockBanner,
} from "@/components/achievements"

export default function MyAchievementsPage() {
  const { currentCity } = useCity()
  const [unlockedAchievement, setUnlockedAchievement] = useState(null)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [showUnlockBanner, setShowUnlockBanner] = useState(false)

  const achievements = currentCity
    ? getAchievementsByCityId(currentCity.id)
    : []

  const handleUnlockAchievement = () => {
    const randomAchievement = achievements[Math.floor(Math.random() * achievements.length)]
    setUnlockedAchievement(randomAchievement)
    setShowUnlockModal(true)
  }

  const handleClaimReward = () => {
    setShowUnlockModal(false)
    setShowUnlockBanner(true)
  }

  return (
    <div>
      {/* 成就画廊 */}
      <AchievementGallery
        achievements={achievements}
        onUnlock={handleUnlockAchievement}
      />

      {/* 成就解锁弹窗 */}
      {unlockedAchievement && (
        <AchievementUnlockModal
          achievement={unlockedAchievement}
          isOpen={showUnlockModal}
          onClose={() => setShowUnlockModal(false)}
          onClaim={handleClaimReward}
        />
      )}

      {/* 成就解锁横幅 */}
      {unlockedAchievement && (
        <AchievementUnlockBanner
          achievement={unlockedAchievement}
          isOpen={showUnlockBanner}
          onClose={() => setShowUnlockBanner(false)}
        />
      )}
    </div>
  )
}
```

---

## 🎯 Z-Index 层级

```
z-[401]  - 成就解锁弹窗内容
z-[400]  - 成就解锁弹窗遮罩
z-[350]  - 成就解锁横幅
z-[301]  - 挑战详情弹窗内容
z-[300]  - 挑战详情弹窗遮罩
z-[500]  - 挑战开始/完成动画
```

---

## 🎬 动画效果

### 挑战开始动画

1. **进入阶段** (0-1.5s)
   - 背景渐变淡入
   - 图标从 0 缩放到 100%
   - 粒子开始生成

2. **保持阶段** (1.5-3.5s)
   - 图标弹跳动画
   - 粒子持续运动
   - 挑战名称和描述淡入
   - 环形光晕脉冲

3. **退出阶段** (3.5-4s)
   - 所有元素放大并淡出
   - 调用 onComplete

### 成就解锁动画

1. **进入阶段** (0-0.5s)
   - 弹窗从 0 缩放到 100%
   - 粒子生成

2. **庆祝阶段** (0.5-4s)
   - 成就图标弹跳
   - 彩带粒子爆炸
   - 奖励展示动画
   - 背景光晕脉冲

3. **退出阶段** (4-4.5s)
   - 弹窗放大并淡出
   - 调用 onClose

---

## 🔧 自定义配置

### 修改成就等级颜色

编辑 `AchievementGallery.tsx` 中的 `getTierStyle` 函数：

```tsx
const getTierStyle = (tier: Achievement["tier"]) => {
  const styles: Record<Achievement["tier"], { ... }> = {
    bronze: {
      bg: "from-orange-500/20 to-amber-600/10",
      border: "border-orange-500/30",
      text: "text-orange-400",
      icon: Medal,
    },
    // ... 修改其他等级
  }
  return styles[tier]
}
```

### 修改动画时长

编辑 `ChallengeStartTransition.tsx` 中的计时器：

```tsx
// 保持阶段时长（毫秒）
const holdTimer = setTimeout(() => {
  setPhase("hold")
  clearInterval(particleInterval)
}, 1500) // 修改这里

// 退出阶段时长（毫秒）
const exitTimer = setTimeout(() => {
  setPhase("exit")
  onComplete()
}, 3500) // 修改这里
```

---

## 📊 数据结构

### Challenge 类型

```tsx
interface Challenge {
  id: string
  cityId: string
  name: string
  description: string
  type: 'conquest' | 'defense' | 'exploration' | 'social' | 'daily'
  objective: {
    type: 'tiles' | 'area' | 'time' | 'friends' | 'logins'
    target: number
    current?: number
  }
  rewards: {
    experience: number
    points: number
    items?: string[]
  }
  status: 'available' | 'in_progress' | 'completed' | 'expired'
  startDate: string
  endDate: string
  priority: number
  isTimeLimited: boolean
  isMainQuest: boolean
}
```

### Achievement 类型

```tsx
interface Achievement {
  id: string
  cityId?: string
  name: string
  description: string
  type: 'milestone' | 'collection' | 'dominance' | 'social' | 'special'
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  conditions: {
    type: 'tiles_captured' | 'area_controlled' | 'cities_visited' | 'friends_count' | 'consecutive_days'
    threshold: number
  }
  rewards: {
    title?: string
    badge: string
    experience: number
    points: number
  }
  isCompleted: boolean
  completedAt?: string
  progress?: {
    current: number
    max: number
  }
  icon?: string
}
```

---

## 🧪 测试建议

### 挑战系统测试

- [ ] 点击挑战卡片打开详情
- [ ] 查看挑战完整信息
- [ ] 点击"开始挑战"触发动画
- [ ] 动画流畅度
- [ ] 紧凑模式显示
- [ ] 限时挑战倒计时

### 成就系统测试

- [ ] 成就网格显示
- [ ] 过滤器功能（全部/未解锁/已达成）
- [ ] 点击成就查看详情
- [ ] 成就解锁动画
- [ ] 领取奖励流程
- [ ] 进度统计更新

### 响应式测试

- [ ] 不同屏幕尺寸
- [ ] 移动端横屏
- [ ] 弹窗滚动

---

## 🚀 下一步开发

1. **集成真实数据**
   - 从 API 获取挑战和成就
   - 实时更新进度
   - 自动解锁成就

2. **增加更多成就类型**
   - 特殊事件成就
   - 季节性成就
   - 社交成就

3. **增强动画效果**
   - 更多粒子效果
   - 音效配合
   - 触觉反馈

4. **挑战推荐系统**
   - 根据玩家等级推荐
   - 智能排序
   - 个性化展示

---

**最后更新**: 2025-01-26
**版本**: 1.0.0
**状态**: ✅ 已完成
