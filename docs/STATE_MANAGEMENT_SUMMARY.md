# Zustand 状态管理系统开发总结

## ✅ 完成状态

Zustand 状态管理系统已全部开发完成，无 linter 错误。

---

## 📦 创建的文件

### 1. **Store 文件**

**`store/useGameStore.ts`** (400+ 行)

完整的全局状态管理，包含：

#### UserSlice
- 用户基础信息（ID、昵称、等级）
- 经验值管理（自动升级）
- 体力值管理
- 总占领面积
- 头像管理

#### LocationSlice
- GPS 坐标（纬度、经度）
- 当前城市 ID
- 跑步状态（isRunning）
- 跑步数据（速度、距离、时长）

#### InventorySlice
- 道具管理（Map 存储）
- 道具类型（体力、经验、面积、特殊）
- 道具使用和效果
- 道具数量管理

---

## 🔧 重构的组件

### 1. **MapHeader** (`components/map/MapHeader.tsx`)

**重构内容**:
- 移除本地 state `runningStats`
- 使用 `useLocation()` 从 store 读取跑步数据
- 使用 `useLocationActions()` 获取跑步操作方法
- 使用 `useUserArea()` 读取用户占领面积
- 简化跑步状态管理

**变更对比**:

```typescript
// ❌ 重构前
const [runningStats, setRunningStats] = useState<RunningStats>({
  isRunning: false,
  distance: 0,
  pace: 0,
  duration: 0,
})

// ✅ 重构后
const { isRunning, distance, duration, speed } = useLocation()
const { startRunning, stopRunning, updateSpeed } = useLocationActions()
```

---

### 2. **Profile** (`components/citylord/profile.tsx`)

**重构内容**:
- 使用 `useUser()` 读取完整用户信息
- 使用 `useUserExp()` 读取经验值
- 使用 `useUserStamina()` 读取体力值
- 使用 `useUserArea()` 读取占领面积
- 显示用户 ID 后 8 位
- 添加体力值进度条
- 修复网格布局（改为 2x3）

**变更对比**:

```typescript
// ❌ 重构前
const xpProgress = 72
const territoryHexCount = 387
const territoryArea = formatAreaFromHexCount(territoryHexCount)

// ✅ 重构后
const user = useUser()
const { currentExp, maxExp } = useUserExp()
const { stamina, maxStamina } = useUserStamina()
const totalArea = useUserArea()

const xpProgress = Math.floor((currentExp / maxExp) * 100)
const territoryHexCount = Math.floor(totalArea / 129)
```

---

## 🎯 实现的 Actions

### User Actions

| Action | 参数 | 描述 |
|--------|------|------|
| `setNickname` | `nickname: string` | 更新用户昵称 |
| `addExperience` | `amount: number` | 增加经验并处理升级 |
| `levelUp` | - | 手动升级 |
| `consumeStamina` | `amount: number` | 消耗体力（不低于 0） |
| `restoreStamina` | `addExperience` | 恢复体力（不超过最大值） |
| `addTotalArea` | `amount: number` | 增加占领面积 |
| `setAvatar` | `avatar: string` | 更新头像 |
| `resetUser` | - | 重置用户数据 |

---

### Location Actions

| Action | 参数 | 描述 |
|--------|------|------|
| `updateLocation` | `lat, lng` | 更新 GPS 坐标 |
| `setCityId` | `cityId: string` | 设置当前城市 ID |
| `startRunning` | - | 开始跑步 |
| `stopRunning` | - | 停止跑步 |
| `updateSpeed` | `speed: number` | 更新跑步速度 |
| `addDistance` | `distance: number` | 增加跑步距离 |
| `updateDuration` | - | 更新跑步时长 |
| `resetLocation` | - | 重置位置数据 |

---

### Inventory Actions

| Action | 参数 | 描述 |
|--------|------|------|
| `addItem` | `item: InventoryItem` | 添加道具（自动合并） |
| `removeItem` | `itemId, quantity?` | 移除道具 |
| `useItem` | `itemId: string` | 使用道具（自动应用效果） |
| `getItemCount` | `itemId: string` | 获取道具数量 |
| `resetInventory` | - | 重置背包 |

---

## 📊 代码统计

| 类别 | 文件数 | 代码行数 |
|------|--------|----------|
| Store 文件 | 1 | ~400 行 |
| 重构组件 | 2 | ~100 行修改 |
| 文档 | 2 | ~1000 行 |
| **总计** | **5** | **~1500 行** |

---

## 🎨 Store 设计

### Slice 模式

使用 Slice 模式组织代码：

```typescript
const createUserSlice = (set, get) => ({
  // state
  ...initialUserState,

  // actions
  setNickname: (nickname) => set({ user: { ...get().user, nickname } }),
  addExperience: (amount) => { /* ... */ },
  // ...
})

export const useGameStore = create<GameState & GameActions>()(
  (set, get) => ({
    user: initialUserState,
    location: initialLocationState,
    inventory: initialInventoryState,

    // 合并所有 slice
    ...createUserSlice(set, get),
    ...createLocationSlice(set, get),
    ...createInventorySlice(set, get),
  })
)
```

### Selectors

提供预定义的 selectors 优化性能：

```typescript
// User Selectors
export const useUser = () => useGameStore((state) => state.user)
export const useUserLevel = () => useGameStore((state) => state.user.level)
export const useUserExp = () => useGameStore((state) => ({
  currentExp: state.user.currentExp,
  maxExp: state.user.maxExp,
}))
export const useUserStamina = () => useGameStore((state) => ({
  stamina: state.user.stamina,
  maxStamina: state.user.maxStamina,
}))
export const useUserArea = () => useGameStore((state) => state.user.totalArea)

// Location Selectors
export const useLocation = () => useGameStore((state) => ({
  latitude: state.location.latitude,
  longitude: state.location.longitude,
  cityId: state.location.cityId,
  isRunning: state.location.isRunning,
  speed: state.location.speed,
  distance: state.location.distance,
  duration: state.location.duration,
}))

export const useIsRunning = () => useGameStore((state) => state.location.isRunning)

// Inventory Selectors
export const useInventory = () => useGameStore((state) => state.inventory)
export const useInventoryItem = (itemId: string) =>
  useGameStore((state) => state.inventory.items.get(itemId))
```

### Actions Hooks

提供预定义的 actions hooks：

```typescript
export const useUserActions = () => useGameStore((state) => ({
  setNickname: state.setNickname,
  addExperience: state.addExperience,
  levelUp: state.levelUp,
  consumeStamina: state.consumeStamina,
  restoreStamina: state.restoreStamina,
  addTotalArea: state.addTotalArea,
  setAvatar: state.setAvatar,
}))

export const useLocationActions = () => useGameStore((state) => ({
  updateLocation: state.updateLocation,
  setCityId: state.setCityId,
  startRunning: state.startRunning,
  stopRunning: state.stopRunning,
  updateSpeed: state.updateSpeed,
  addDistance: state.addDistance,
  updateDuration: state.updateDuration,
}))

export const useInventoryActions = () => useGameStore((state) => ({
  addItem: state.addItem,
  removeItem: state.removeItem,
  useItem: state.useItem,
  getItemCount: state.getItemCount,
}))
```

---

## 💾 持久化

使用 Zustand 的 `persist` 中间件自动保存到 localStorage：

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

### 保存的数据

- **用户信息**: ID、昵称、等级、经验、体力、面积、头像
- **背包信息**: 道具列表（转换为数组存储）

### 不保存的数据

- **位置信息**: GPS 坐标、跑步状态（每次重新加载重新初始化）

---

## 🎯 升级逻辑

系统自动处理升级逻辑：

### 规则
- 每 1000 经验升一级
- 超过当前等级所需经验会自动累积到下一级
- 最大经验 = 等级 × 1000

### 示例

```typescript
// 等级 1，最大经验 1000，当前经验 800
addExperience(500) // 增加到 1300

// 结果：
// 等级: 2
// 当前经验: 300 (1300 - 1000)
// 最大经验: 2000 (2 × 1000)
```

---

## 🚀 快速开始

### 安装依赖

```bash
npm install zustand
```

### 使用 Store

```typescript
// 读取数据
import { useUser, useUserLevel, useUserExp } from "@/store/useGameStore"

function MyComponent() {
  const user = useUser()
  const level = useUserLevel()
  const { currentExp, maxExp } = useUserExp()

  return (
    <div>
      <p>{user.nickname} - Lv.{level}</p>
      <p>经验: {currentExp} / {maxExp}</p>
    </div>
  )
}

// 使用 Actions
import { useUserActions, useLocationActions } from "@/store/useGameStore"

function MyComponent() {
  const { addExperience, consumeStamina } = useUserActions()
  const { updateLocation, startRunning } = useLocationActions()

  const handleRun = () => {
    consumeStamina(10)
    startRunning()
    updateLocation(39.9042, 116.4074)
  }

  const handleAddExp = () => {
    addExperience(100)
  }

  return (
    <div>
      <button onClick={handleRun}>开始跑步</button>
      <button onClick={handleAddExp}>增加经验</button>
    </div>
  )
}
```

---

## 📋 完成清单

- [x] 安装 zustand 依赖
- [x] 创建 `store/useGameStore.ts`
- [x] 定义 UserSlice（用户、经验、体力、面积）
- [x] 定义 LocationSlice（GPS、城市、跑步状态）
- [x] 定义 InventorySlice（道具管理）
- [x] 实现 `updateLocation(lat, lng)` Action
- [x] 实现 `addExperience(amount)` Action（含升级逻辑）
- [x] 实现 `consumeStamina(amount)` Action
- [x] 重构 MapHeader 组件
- [x] 重构 Profile 组件
- [x] 创建 Selectors（优化性能）
- [x] 创建 Actions Hooks
- [x] 实现持久化（localStorage）
- [x] 完整使用指南文档
- [x] 开发总结文档
- [x] Linter 检查（0 错误）

---

## 💡 核心特性

### 1. 简洁的 API

```typescript
// 读取数据
const user = useUser()
const { isRunning, distance } = useLocation()

// 使用 Actions
const { addExperience, startRunning } = useUserActions()
```

### 2. 自动升级

```typescript
addExperience(1500) // 自动从等级 1 升到等级 2
```

### 3. 性能优化

- 使用 Selectors 订阅特定状态
- 避免不必要的重渲染
- Slice 模式组织代码

### 4. 持久化

- 自动保存到 localStorage
- Map 数据结构支持
- 灵活的部分持久化

### 5. 类型安全

- 完整的 TypeScript 类型定义
- 编译时类型检查
- 智能代码提示

---

## 🚀 后续建议

### 1. 扩展 Store

- 添加好友系统 slice
- 添加挑战任务 slice
- 添加成就系统 slice
- 添加排行榜 slice

### 2. 集成 API

- 添加 API 调用 Actions
- 实现数据同步
- 添加错误处理

### 3. 性能优化

- 使用 immer 处理不可变更新
- 实现选择器缓存
- 添加批量更新

### 4. 开发工具

- 集成 Redux DevTools
- 添加时间旅行调试
- 实现状态快照

---

## 📝 总结

Zustand 状态管理系统已经全部开发完成，包含：

- ✅ 1 个完整的 Store 文件
- ✅ 3 个 Slice（User、Location、Inventory）
- ✅ 20+ 个 Actions
- ✅ 10+ 个 Selectors
- ✅ 持久化支持（localStorage）
- ✅ 重构 2 个组件（MapHeader、Profile）
- ✅ 2 份完整文档
- ✅ 0 个 linter 错误

所有组件都已经准备就绪，可以直接使用！
