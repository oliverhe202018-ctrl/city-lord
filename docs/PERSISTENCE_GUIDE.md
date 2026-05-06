# 游戏数据持久化功能使用指南

## 概述

本项目实现了完整的游戏数据持久化功能，确保页面刷新后游戏进度不丢失。主要包括：

1. **Zustand Store 持久化** - 自动保存用户和库存数据到 LocalStorage
2. **Mock API 服务** - 模拟后端接口，提供城市数据和领地占领功能
3. **加载状态处理** - 全屏加载动画，提供流畅的用户体验

---

## 1. Zustand Store 持久化

### 自动持久化的数据

以下数据会自动保存到浏览器的 LocalStorage：

- **用户数据** (`UserSlice`)
  - 用户 ID
  - 昵称
  - 等级
  - 经验值
  - 体力值
  - 总占领面积
  - 头像

- **库存数据** (`InventorySlice`)
  - 道具列表
  - 道具数量
  - 道具类型

### 持久化配置

持久化配置位于 `store/useGameStore.ts`：

```typescript
export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({ ... }),
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
)
```

### 使用示例

```typescript
import { useUserActions, useLocationActions } from "@/store/useGameStore"

function MyComponent() {
  const { addExperience, addTotalArea } = useUserActions()
  const { setCityId } = useLocationActions()

  // 这些操作会自动持久化到 LocalStorage
  addExperience(100)
  addTotalArea(50)
  setCityId("beijing")

  // 刷新页面后数据不会丢失
}
```

---

## 2. Mock API 服务

### 文件位置

`services/mock-api.ts`

### 可用方法

#### 1. `fetchCityData(cityId: string)`

异步获取城市配置和排行榜数据。

**参数：**
- `cityId` - 城市 ID（如 "beijing", "shanghai"）

**返回：**
```typescript
{
  city: City,
  leaderboard: LeaderboardEntry[],
  totalPlayers: number
}
```

**示例：**
```typescript
import { fetchCityData } from "@/services/mock-api"

async function loadCity() {
  try {
    const data = await fetchCityData("beijing")
    console.log("城市数据:", data.city)
    console.log("排行榜:", data.leaderboard)
  } catch (error) {
    console.error("加载失败:", error)
  }
}
```

#### 2. `claimTerritory(cellId: string)`

模拟领地占领请求。

**参数：**
- `cellId` - 六边形格子 ID

**返回：**
```typescript
{
  success: boolean,
  cellId: string,
  capturedAt: string,
  experience: number,
  area: number
}
```

**特点：**
- 包含 500ms 网络延迟模拟
- 90% 成功率
- 自动更新本地 `CapturedCells` 数据
- 随机生成经验和面积奖励

**示例：**
```typescript
import { claimTerritory } from "@/services/mock-api"

async function captureHex(cellId: string) {
  try {
    const result = await claimTerritory(cellId)
    if (result.success) {
      console.log(`占领成功！获得 ${result.experience} 经验`)
      // 数据已自动保存到 LocalStorage
    }
  } catch (error) {
    console.error("占领失败:", error)
  }
}
```

#### 3. `getCapturedCellsLocal()`

获取本地已占领的格子列表。

**返回：** `string[]` - 已占领的格子 ID 列表

**示例：**
```typescript
import { getCapturedCellsLocal } from "@/services/mock-api"

const captured = getCapturedCellsLocal()
console.log(`已占领 ${captured.length} 个格子`)
```

#### 4. `clearCapturedCellsLocal()`

清除本地已占领的格子数据（用于重置或测试）。

**示例：**
```typescript
import { clearCapturedCellsLocal } from "@/services/mock-api"

clearCapturedCellsLocal() // 清除所有占领记录
```

---

## 3. 领地占领 Hook

### 文件位置

`components/citylord/territory-capture-hook.tsx`

### 使用方式

```typescript
import { useTerritoryCapture } from "@/components/citylord/territory-capture-hook"

function MyComponent() {
  const {
    isCapturing,           // 是否正在占领
    capturedCells,         // 已占领的格子列表
    captureTerritory,      // 占领函数
    isCaptured,           // 检查格子是否已占领
    getCapturedCount,      // 获取已占领数量
    resetCapturedCells     // 重置占领记录
  } = useTerritoryCapture()

  const handleCapture = async () => {
    const result = await captureTerritory("hex-cell-001", 5)
    if (result.success) {
      console.log("占领成功！")
    }
  }

  return (
    <button onClick={handleCapture} disabled={isCapturing}>
      {isCapturing ? "占领中..." : "占领"}
    </button>
  )
}
```

### 领地占领组件示例

#### 简单占领按钮

```typescript
import { SimpleTerritoryButton } from "@/components/citylord/territory-capture-demo"

<SimpleTerritoryButton
  cellId="hex-cell-001"
  onCaptureSuccess={() => console.log("占领成功！")}
/>
```

#### 完整演示组件

```typescript
import { TerritoryCaptureDemo } from "@/components/citylord/territory-capture-demo"

<TerritoryCaptureDemo />
```

---

## 4. 加载状态处理

### LoadingScreen 组件

全屏加载动画，带有呼吸效果的 Logo。

**参数：**
- `message?` - 加载提示文字（默认："加载中..."）
- `progress?` - 加载进度 0-100（可选）

**示例：**
```typescript
import { LoadingScreen } from "@/components/citylord/loading-screen"

// 基础用法
<LoadingScreen message="正在加载城市数据..." />

// 带进度条
<LoadingScreen message="下载资源..." progress={75} />
```

### LoadingSpinner 组件

轻量级加载指示器，用于局部加载场景。

**参数：**
- `size?` - "sm" | "md" | "lg"（默认："md"）
- `className?` - 额外的 CSS 类名

**示例：**
```typescript
import { LoadingSpinner } from "@/components/citylord/loading-screen"

<LoadingSpinner size="sm" />
<LoadingSpinner size="lg" className="text-blue-500" />
```

### LoadingOverlay 组件

半透明加载遮罩，用于内容区域加载。

**参数：**
- `message?` - 加载提示文字（默认："加载中..."）
- `blur?` - 是否启用背景模糊（默认：true）

**示例：**
```typescript
import { LoadingOverlay } from "@/components/citylord/loading-screen"

<div className="relative h-64">
  <LoadingOverlay message="请稍候..." />
  <YourContent />
</div>
```

### 在 CityContext 中使用

`CityProvider` 会自动管理加载状态：

```typescript
import { useCity } from "@/contexts/CityContext"

function MyComponent() {
  const { isLoading, currentCity } = useCity()

  if (isLoading || !currentCity) {
    return <LoadingScreen message="正在加载城市数据..." />
  }

  return <YourGameContent />
}
```

### 在页面中使用

在 `app/page.tsx` 中，主组件会检查加载状态：

```typescript
function CityLordAppContent() {
  const { isLoading: isCityLoading, currentCity } = useCity()

  // 全屏加载状态
  if (isCityLoading || !currentCity) {
    return <LoadingScreen message="正在加载城市数据..." />
  }

  return <GameContent />
}
```

---

## 5. CityContext 集成

### 新增属性

`useCity()` Hook 返回新增的属性：

```typescript
{
  // ...原有属性
  leaderboard: CityDataResponse["leaderboard"] | null,
  totalPlayers: number,
  isLoading: boolean,
}
```

### 自动加载

- **初始化**：从 LocalStorage 读取 `currentCityId`，调用 `fetchCityData` 加载数据
- **切换城市**：调用 `switchCity()` 时自动加载新城市数据和排行榜
- **错误处理**：加载失败时保留当前数据，显示错误提示

### 示例

```typescript
import { useCity } from "@/contexts/CityContext"

function LeaderboardDisplay() {
  const { leaderboard, totalPlayers, isLoading } = useCity()

  if (isLoading) {
    return <div>加载排行榜中...</div>
  }

  return (
    <div>
      <h3>排行榜 ({totalPlayers} 名玩家)</h3>
      {leaderboard?.map((entry) => (
        <div key={entry.rank}>
          #{entry.rank} {entry.nickname} - {entry.totalArea} km²
        </div>
      ))}
    </div>
  )
}
```

---

## 6. MapHeader 加载状态

当城市数据正在加载或未选择城市时，`MapHeader` 会显示加载指示器：

```typescript
if (!currentCity || isLoading) {
  return (
    <div className="absolute top-0 left-0 right-0 z-[100] flex items-center justify-center px-4 py-3">
      <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2">
        <LoadingSpinner size="sm" />
        <span className="text-sm text-white/80">
          {isLoading ? "加载城市数据..." : "请选择城市"}
        </span>
      </div>
    </div>
  )
}
```

---

## 7. CityDrawer 加载状态

切换城市时，`CityDrawer` 会显示切换状态：

- 城市图标替换为加载动画
- 显示"切换中..."标签
- 禁用其他城市的点击

```typescript
{isSwitchingTo && (
  <span className="px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white/60 rounded-full flex items-center gap-1">
    切换中...
  </span>
)}
```

---

## 8. 本地存储结构

### 主要存储键

1. **`city-lord-game-storage`** - Zustand Store 持久化数据
   ```json
   {
     "state": {
       "user": { ... },
       "inventory": [["item-id", { ... }]]
     },
     "version": 0
   }
   ```

2. **`currentCityId`** - 当前选择的城市 ID
   ```json
   "beijing"
   ```

3. **`capturedCells`** - 已占领的格子列表
   ```json
   ["hex-cell-001", "hex-cell-002", ...]
   ```

### 手动清除存储

```typescript
// 清除游戏数据
localStorage.removeItem("city-lord-game-storage")

// 清除当前城市选择
localStorage.removeItem("currentCityId")

// 清除占领记录
localStorage.removeItem("capturedCells")
```

---

## 9. 测试功能

### 重置游戏进度

```typescript
import { clearCapturedCellsLocal } from "@/services/mock-api"
import { useUserActions } from "@/store/useGameStore"

function ResetGame() {
  const { resetUser, resetInventory } = useUserActions()

  const handleReset = () => {
    // 清除占领记录
    clearCapturedCellsLocal()

    // 重置用户数据
    resetUser()

    // 重置库存
    resetInventory()

    // 清除城市选择
    localStorage.removeItem("currentCityId")

    // 刷新页面
    window.location.reload()
  }

  return <button onClick={handleReset}>重置游戏</button>
}
```

---

## 10. 注意事项

1. **LocalStorage 限制**
   - LocalStorage 有大小限制（通常 5-10MB）
   - 大量数据时应考虑使用 IndexedDB
   - 定期清理过期数据

2. **数据同步**
   - 当前实现仅限本地存储
   - 真实后端应实现服务器同步
   - 需要处理冲突解决策略

3. **错误处理**
   - 所有 API 调用都应包含错误处理
   - 网络失败时应显示友好的错误提示
   - 考虑实现重试机制

4. **性能优化**
   - 避免频繁写入 LocalStorage
   - 考虑批量更新数据
   - 使用 debounce/throttle 优化

---

## 11. 未来扩展

1. **后端集成**
   - 替换 Mock API 为真实 REST/GraphQL API
   - 实现服务器数据同步
   - 添加离线支持

2. **增强功能**
   - 实时排行榜更新
   - 多人联机领地争夺
   - 战斗系统

3. **数据迁移**
   - 版本升级时数据迁移
   - 兼容旧版本数据
   - 数据备份与恢复

---

## 总结

本实现提供了完整的数据持久化解决方案，包括：

✅ 自动保存用户和库存数据
✅ 模拟后端 API 服务
✅ 全屏加载动画
✅ 领地占领功能
✅ 城市切换集成
✅ 错误处理和重试机制

所有功能模块完整实现，代码结构清晰，易于扩展和维护。
