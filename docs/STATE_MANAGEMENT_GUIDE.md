# Zustand 状态管理系统使用指南

## 概述

本指南介绍了 City Lord 游戏使用 Zustand 实现的全局状态管理系统。

## 目录

- [安装](#安装)
- [Store 结构](#store-结构)
- [User Slice](#user-slice)
- [Location Slice](#location-slice)
- [Inventory Slice](#inventory-slice)
- [使用方法](#使用方法)
- [持久化](#持久化)
- [最佳实践](#最佳实践)

---

## 安装

```bash
npm install zustand
```

---

## Store 结构

```typescript
export interface GameState {
  user: UserState
  location: LocationState
  inventory: InventoryState
}

export interface GameActions {
  // User Actions
  setNickname: (nickname: string) => void
  addExperience: (amount: number) => void
  levelUp: () => void
  consumeStamina: (amount: number) => void
  restoreStamina: (amount: number) => void
  addTotalArea: (amount: number) => void
  setAvatar: (avatar: string) => void

  // Location Actions
  updateLocation: (lat: number, lng: number) => void
  setCityId: (cityId: string) => void
  startRunning: () => void
  stopRunning: () => void
  updateSpeed: (speed: number) => void
  addDistance: (distance: number) => void
  updateDuration: () => void

  // Inventory Actions
  addItem: (item: InventoryItem) => void
  removeItem: (itemId: string, quantity?: number) => void
  useItem: (itemId: string) => void
  getItemCount: (itemId: string) => number
}
```

---

## User Slice

### State

```typescript
export interface UserState {
  userId: string
  nickname: string
  level: number
  currentExp: number
  maxExp: number
  stamina: number
  maxStamina: number
  totalArea: number
  avatar: string
}
```

### Actions

#### `setNickname(nickname: string)`
更新用户昵称。

```typescript
const { setNickname } = useUserActions()
setNickname("新昵称")
```

#### `addExperience(amount: number)`
增加经验值并自动处理升级逻辑（每 1000 经验升一级）。

```typescript
const { addExperience } = useUserActions()
addExperience(500) // 增加 500 经验
```

#### `levelUp()`
手动升级（增加一级，重置经验）。

```typescript
const { levelUp } = useUserActions()
levelUp()
```

#### `consumeStamina(amount: number)`
消耗体力值（不会低于 0）。

```typescript
const { consumeStamina } = useUserActions()
consumeStamina(20) // 消耗 20 体力
```

#### `restoreStamina(amount: number)`
恢复体力值（不会超过最大值）。

```typescript
const { restoreStamina } = useUserActions()
restoreStamina(30) // 恢复 30 体力
```

#### `addTotalArea(amount: number)`
增加总占领面积。

```typescript
const { addTotalArea } = useUserActions()
addTotalArea(5000) // 增加 5000 m²
```

#### `setAvatar(avatar: string)`
更新用户头像。

```typescript
const { setAvatar } = useUserActions()
setAvatar("https://api.dicebear.com/7.x/avataaars/svg?seed=new-avatar")
```

---

## Location Slice

### State

```typescript
export interface LocationState {
  latitude: number | null
  longitude: number | null
  cityId: string | null
  isRunning: boolean
  lastUpdate: number | null
  speed: number
  distance: number
  duration: number
}
```

### Actions

#### `updateLocation(lat: number, lng: number)`
更新 GPS 坐标。

```typescript
const { updateLocation } = useLocationActions()
updateLocation(39.9042, 116.4074) // 北京坐标
```

#### `setCityId(cityId: string)`
设置当前城市 ID。

```typescript
const { setCityId } = useLocationActions()
setCityId("beijing")
```

#### `startRunning()`
开始跑步。

```typescript
const { startRunning } = useLocationActions()
startRunning()
```

#### `stopRunning()`
停止跑步。

```typescript
const { stopRunning } = useLocationActions()
stopRunning()
```

#### `updateSpeed(speed: number)`
更新跑步速度（米/秒）。

```typescript
const { updateSpeed } = useLocationActions()
updateSpeed(3.5) // 3.5 m/s
```

#### `addDistance(distance: number)`
增加跑步距离（米）。

```typescript
const { addDistance } = useLocationActions()
addDistance(100) // 增加 100 米
```

#### `updateDuration()`
更新跑步时长（内部自动计算）。

```typescript
const { updateDuration } = useLocationActions()
updateDuration()
```

---

## Inventory Slice

### State

```typescript
export interface InventoryItem {
  id: string
  name: string
  description: string
  icon: string
  quantity: number
  type: 'stamina' | 'exp' | 'area' | 'special'
  effect: {
    value: number
    duration?: number
  }
}

export interface InventoryState {
  items: Map<string, InventoryItem>
  totalItems: number
}
```

### Actions

#### `addItem(item: InventoryItem)`
添加道具到背包（如果已存在则增加数量）。

```typescript
const { addItem } = useInventoryActions()

addItem({
  id: "stamina_potion",
  name: "体力药水",
  description: "恢复 30 点体力",
  icon: "🧪",
  quantity: 5,
  type: 'stamina',
  effect: { value: 30 },
})
```

#### `removeItem(itemId: string, quantity?: number)`
从背包移除道具（默认移除 1 个）。

```typescript
const { removeItem } = useInventoryActions()
removeItem("stamina_potion", 2) // 移除 2 个体力药水
```

#### `useItem(itemId: string)`
使用道具（自动应用效果并减少数量）。

```typescript
const { useItem } = useInventoryActions()
useItem("stamina_potion") // 使用体力药水，自动恢复体力
```

#### `getItemCount(itemId: string)`
获取道具数量。

```typescript
const { getItemCount } = useInventoryActions()
const count = getItemCount("stamina_potion")
console.log(`体力药水数量: ${count}`)
```

---

## 使用方法

### 基础使用

```typescript
import { useGameStore } from "@/store/useGameStore"

function MyComponent() {
  const user = useGameStore((state) => state.user)
  const { setNickname, addExperience } = useGameStore((state) => ({
    setNickname: state.setNickname,
    addExperience: state.addExperience,
  }))

  return (
    <div>
      <p>{user.nickname}</p>
      <p>等级: {user.level}</p>
      <p>经验: {user.currentExp} / {user.maxExp}</p>
      <button onClick={() => setNickname("新昵称")}>
        修改昵称
      </button>
      <button onClick={() => addExperience(100)}>
        增加 100 经验
      </button>
    </div>
  )
}
```

### 使用 Selectors

```typescript
import {
  useUser,
  useUserLevel,
  useUserExp,
  useUserStamina,
  useLocation,
  useIsRunning,
} from "@/store/useGameStore"

function MyComponent() {
  // 读取完整用户状态
  const user = useUser()

  // 读取特定属性
  const level = useUserLevel()
  const { currentExp, maxExp } = useUserExp()
  const { stamina, maxStamina } = useUserStamina()

  // 读取位置信息
  const { latitude, longitude, isRunning, distance, duration } = useLocation()

  // 读取跑步状态
  const running = useIsRunning()

  return (
    <div>
      <p>{user.nickname} - 等级 {level}</p>
      <p>经验: {currentExp} / {maxExp}</p>
      <p>体力: {stamina} / {maxStamina}</p>
      <p>跑步中: {running ? "是" : "否"}</p>
      <p>距离: {distance}m</p>
      <p>时长: {duration}秒</p>
    </div>
  )
}
```

### 使用 Actions Hooks

```typescript
import {
  useUserActions,
  useLocationActions,
  useInventoryActions,
} from "@/store/useGameStore"

function MyComponent() {
  const { setNickname, addExperience, consumeStamina } = useUserActions()
  const { updateLocation, startRunning, stopRunning } = useLocationActions()
  const { addItem, useItem } = useInventoryActions()

  const handleStartRun = () => {
    consumeStamina(10) // 消耗 10 体力
    startRunning()
  }

  const handleAddExp = () => {
    addExperience(100)
  }

  const handleUseItem = () => {
    useItem("stamina_potion")
  }

  return (
    <div>
      <button onClick={handleStartRun}>开始跑步</button>
      <button onClick={handleAddExp}>增加经验</button>
      <button onClick={handleUseItem}>使用道具</button>
    </div>
  )
}
```

---

## 持久化

Store 使用 Zustand 的 `persist` 中间件自动保存到 localStorage。

```typescript
persist(
  (set, get) => ({ /* state */ }),
  {
    name: 'city-lord-game-storage',
    partialize: (state) => ({
      user: state.user,
      inventory: Array.from(state.inventory.entries()),
    }),
    onRehydrateStorage: () => (state) => {
      // 将 Map 数组转换回 Map 对象
      if (state?.inventory) {
        const inventory = state.inventory as any
        if (Array.isArray(inventory)) {
          state.inventory = {
            items: new Map(inventory),
            totalItems: inventory.reduce((sum: number, [, item]: any) => sum + item.quantity, 0),
          }
        }
      }
    },
  }
)
```

### 清除持久化数据

```typescript
const { resetUser, resetInventory } = useUserActions()

// 清除用户数据
resetUser()

// 清除背包数据
resetInventory()
```

---

## 升级逻辑

系统自动处理升级逻辑：

```typescript
addExperience(1500) // 自动从等级 1 升到等级 2（多出 500 经验）
```

计算公式：
- 最大经验 = 等级 × 1000
- 升级所需经验 = 最大经验 - 当前经验
- 升级次数 = Math.floor(增加的经验 / 最大经验)
- 剩余经验 = 增加的经验 % 最大经验

---

## 最佳实践

### 1. 使用 Selectors

使用预定义的 selectors 而不是直接订阅整个 state，可以减少不必要的重渲染：

```typescript
// ❌ 不好：订阅整个 store
const { user, location } = useGameStore()

// ✅ 好：只订阅需要的部分
const user = useUser()
const { latitude, longitude } = useLocation()
```

### 2. 分离 Actions

使用预定义的 actions hooks 而不是直接订阅所有 actions：

```typescript
// ❌ 不好：订阅所有 actions
const { setNickname, addExperience, ... } = useGameStore((state) => state)

// ✅ 好：只订阅需要的 actions
const { setNickname, addExperience } = useUserActions()
```

### 3. 异步更新

对于异步操作，可以在 action 内部直接修改 state：

```typescript
const updateAsyncData = async () => {
  const data = await fetchData()
  setNickname(data.nickname)
  addExperience(data.exp)
}
```

### 4. 计算属性

对于需要计算的值，在组件内部计算而不是存储在 state 中：

```typescript
function MyComponent() {
  const { currentExp, maxExp } = useUserExp()

  // 计算进度百分比
  const expProgress = Math.floor((currentExp / maxExp) * 100)

  return (
    <div>
      <ProgressBar progress={expProgress} />
    </div>
  )
}
```

---

## 示例组件

### 完整的用户信息组件

```typescript
import { useUser, useUserExp, useUserStamina, useUserActions } from "@/store/useGameStore"

function UserInfo() {
  const user = useUser()
  const { currentExp, maxExp } = useUserExp()
  const { stamina, maxStamina } = useUserStamina()
  const { setNickname, addExperience, consumeStamina } = useUserActions()

  const expProgress = Math.floor((currentExp / maxExp) * 100)
  const staminaProgress = Math.floor((stamina / maxStamina) * 100)

  return (
    <div>
      <h2>{user.nickname} - Lv.{user.level}</h2>

      {/* 经验条 */}
      <ProgressBar
        label="经验"
        progress={expProgress}
        color="green"
      >
        {currentExp} / {maxExp}
      </ProgressBar>

      {/* 体力条 */}
      <ProgressBar
        label="体力"
        progress={staminaProgress}
        color="blue"
      >
        {stamina} / {maxStamina}
      </ProgressBar>

      <button onClick={() => setNickname("新昵称")}>
        修改昵称
      </button>
      <button onClick={() => addExperience(100)}>
        增加 100 经验
      </button>
      <button onClick={() => consumeStamina(10)}>
        消耗 10 体力
      </button>
    </div>
  )
}
```

---

## 完整的跑步追踪组件

```typescript
import {
  useLocation,
  useLocationActions,
  useUserActions,
} from "@/store/useGameStore"

function RunningTracker() {
  const { isRunning, distance, duration, speed } = useLocation()
  const { consumeStamina, addExperience, addTotalArea } = useUserActions()
  const { startRunning, stopRunning, addDistance, updateDuration } = useLocationActions()

  const pace = distance > 0 ? Math.floor((duration / distance) * 1000) : 0

  // 模拟跑步数据更新
  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      addDistance(3.5) // 每秒增加 3.5 米
      updateDuration() // 更新时长
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, addDistance, updateDuration])

  const handleToggleRunning = () => {
    if (isRunning) {
      stopRunning()
      // 跑步结束后给予奖励
      const expGained = Math.floor(distance / 10)
      const areaGained = Math.floor(distance * 5)
      addExperience(expGained)
      addTotalArea(areaGained)
    } else {
      startRunning()
      consumeStamina(1) // 每秒消耗 1 体力
    }
  }

  return (
    <div>
      <button onClick={handleToggleRunning}>
        {isRunning ? "停止跑步" : "开始跑步"}
      </button>
      <div>
        <p>距离: {distance}m</p>
        <p>时长: {duration}秒</p>
        <p>配速: {pace}秒/公里</p>
        <p>速度: {speed}m/s</p>
      </div>
    </div>
  )
}
```

---

## 调试

### 使用 DevTools

```bash
npm install zustand devtools
```

```typescript
import { devtools } from 'zustand/middleware'

export const useGameStore = create<GameState & GameActions>()(
  devtools(
    persist(
      (set, get) => ({ /* state */ }),
      { /* persist options */ }
    ),
    { name: 'CityLordGameStore' }
  )
)
```

---

## 后续扩展

1. **添加新的 Slice**
   - 添加好友系统 slice
   - 添加挑战任务 slice
   - 添加成就系统 slice

2. **添加更多 Actions**
   - 实现批量操作
   - 添加事务支持
   - 实现撤销/重做

3. **优化持久化**
   - 使用 IndexedDB 代替 localStorage
   - 实现数据迁移
   - 添加备份功能

4. **性能优化**
   - 使用 immer 处理不可变更新
   - 实现选择器缓存
   - 优化批量更新
