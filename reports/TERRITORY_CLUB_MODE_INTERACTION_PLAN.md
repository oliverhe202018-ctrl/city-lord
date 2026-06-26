# Territory Club Mode Interaction Implementation Plan

> **版本：** v3.0  
> **创建日期：** 2026-06-27  
> **状态：** 待审批（本轮仅批准 PR 1 — API Data Layer）

---

## 1. Scope

本轮仅聚焦 **Club Mode（俱乐部模式）** 下的领地点击交互 MVP。

**明确包含：**
- 俱乐部模式下相邻领地分组渲染（connected components）
- 点击领地后底部 TerritoryDetailSheet Club Mode compact 首屏
- 精简版 Club Profile 抽屉
- 俱乐部模式顶部 ClubInfoBar 横条

**明确排除：**
- 个人模式（Single Player）的任何改动
- 阵营模式（Faction）的任何改动
- 聊天、动态、完整成员列表页
- 地图系统整体重构
- 登录、支付、定位权限、运动记录等无关模块
- 数据库 schema 变更（除非 Top 5 Territories 明确无法通过现有数据查询）
- 删除任何现有玩法信息（血量/护盾/积分等保留到"更多详情"区域）

---

## 2. Current Code Audit Summary

### 2.1 前端已有能力

| 能力 | 文件 | 状态 |
|------|------|------|
| 领地色块 Canvas 渲染 | `TerritoryLayer.tsx` | 已有，但俱乐部模式按 `ownerClubId` 全量分组，未做相邻判断 |
| 俱乐部头像纹理平铺 | `TerritoryLayer.tsx` L530-L567 | 已有，使用 `createPattern` |
| 选中领地描边高亮 | `TerritoryLayer.tsx` L505-L527 | 已有，颜色取自 `ownerPersonalColor` |
| 领地详情底部抽屉 | `TerritoryDetailSheet.tsx` | 已有，内容过多需 Club Mode 下 compact |
| 背景图读取 | `TerritoryDetailSheet.tsx` L36-L38 | 前端已支持读取 `background_url`，但 API 未返回该字段 |
| 查看俱乐部按钮 | `TerritoryDetailSheet.tsx` L365-L375 | 已有，位于弹窗底部 |
| 三点菜单 + 举报 | `TerritoryMoreMenu.tsx` | 已有，直接跳转 `/settings/feedback` |
| 俱乐部档案弹窗 | `ClubProfileSheet.tsx` → `ClubDetailView.tsx` | 已有，但内容过重（含聊天/动态/成员列表） |
| 领地霸主横条 | `KingAreaBanner.tsx` | 已有，俱乐部模式下未选中领地时返回 null |
| 模式切换 | `MapControls.tsx` + `useMapDisplayStore.ts` | 已有，互斥切换 |
| 领地列表含俱乐部信息 | `/api/v1/territories` | 已有，返回 `ownerClubId`, `ownerClub`, `ownerFillColor` |

### 2.2 后端已有能力

| API / Action | 路径 | 返回字段 | 状态 |
|-------------|------|---------|------|
| 领地详情 | `/api/v1/territory/detail` | territoryId, cityName, capturedAt, area, owner(id,nickname,avatarUrl), club(id,name,logoUrl), recentRun, hp, shield... | **缺少 `owner.backgroundUrl`** |
| 俱乐部详情(缓存) | `/api/club/get-club-details-cached` | 通过 `v_clubs_summary` 视图返回 club 全量字段 + `total_area`, `member_count`, `active_member_count` | 已有 total_area 和 member_count |
| 俱乐部排名 | `/api/club/get-club-rank-stats` | `{ global: number, provincial: number }` | 已有全国和省内排名 |
| 俱乐部 Top 排行 | `/api/club/get-top-clubs-by-area` | 返回全局/省内 Top N 俱乐部 | 这是俱乐部间排行，**不是俱乐部内部成员排行** |
| 用户 Profile | `/api/v1/user/profile` | 包含 `background_url` | 已有，但领地详情 API 未引用 |
| 俱乐部公开档案 | `getClubPublicProfile()` (action) | club info + total_area + rank_national + rank_province + **top_territories (Top 5 成员)** | **本阶段禁止调用**。依赖的 RPC 函数 `get_club_total_area` 和 `get_club_rank` 在仓库 migration 中不存在，调用会运行时崩溃。本阶段不依赖此 action，改用组合方案（`getClubDetailsCached` + `getClubRankStats` + admin client）。如未来要保留该 action，需单独开任务重写或补 migration，不属于本阶段 |
| 俱乐部内部成员排行 | `getInternalMembers(clubId)` (action) | 成员按 `total_area` 降序排列 | 已有，但本阶段不调用。该 action 在公开 API 场景下可能受 RLS 限制，优先使用 admin client 直接查询 club_members + profiles.total_area 获取 Top 5 |
| 领地列表 | `/api/v1/territories` | 含 `ownerClubId`, `ownerClub`, `ownerFillColor`, `ownerPathColor`, `geojson_json` | 已有，数据充足 |

### 2.3 关键缺口

| 缺口 | 影响 | 解决方案 |
|------|------|---------|
| 领地详情 API 不返回 `owner.backgroundUrl` | TerritoryDetailSheet 背景图无法显示用户设置的背景 | 在 API 的 profiles select 中增加 `background_url` 字段 |
| 俱乐部公开档案无可用 API Route | ClubProfileSheet 无法获取 Top 5 Territories 数据 | 新增 `/api/club/get-club-public-profile` API Route，**不调用** `getClubPublicProfile()` action，改用 `getClubDetailsCached` + `getClubRankStats` + admin client 直接查询组合实现 |
| 相邻领地未做连通分量判断 | 同俱乐部不相邻领地被错误合并渲染 | 新增 connected components 算法 |
| 无 ClubInfoBar 组件 | 俱乐部模式下未点击领地时无俱乐部信息横条 | 新增 `ClubInfoBar.tsx` |
| ClubProfileSheet 内容过重 | 弹窗包含聊天/动态等无关功能 | 新建精简版 `ClubProfileCompactView.tsx` |

---

## 3. Target UX

### 交互流程

```
1. 用户切换到 Club Mode（右侧按钮）
   → 地图上所有俱乐部领地显示俱乐部头像纹理填充
   → 顶部出现 ClubInfoBar 横条（俱乐部名称 + 总面积）

2. 用户点击某块俱乐部领地
   → 该领地所在的相邻连通区域出现统一描边（颜色 = 被点击领地的 ownerFillColor）
   → 不相邻的同俱乐部领地不受影响，保持普通填充状态
   → 底部弹出 TerritoryDetailSheet（Club Mode compact 首屏）

3. TerritoryDetailSheet Club Mode compact 首屏显示：
   → 顶部背景图 = 领主设置的 background_url（非俱乐部头像平铺）
   → 领主头像 + 昵称
   → 所属俱乐部名称标签
   → 占领时间
   → 地理位置
   → 跑步核心数据（距离/时长/配速/面积）
   → 右侧 "查看俱乐部" 按钮
   → 三点菜单 → 弹出小窗口 → "举报" → 跳转反馈页
   → 血量/护盾/积分/领地类型等游戏信息保留在"更多详情/展开"区域

4. 点击 "查看俱乐部"
   → 底部弹出精简版 Club Profile 抽屉

5. Club Profile 显示内容：
   → 标题 "Club Profile"
   → 俱乐部头像 + 俱乐部名称
   → 总占领面积 + 成员数
   → Rankings: 全国排名 + 省内排名
   → Top 5 Territories: 俱乐部内前 5 名成员的占领面积
```

---

## 4. P0 Task Breakdown

### P0-1: Adjacent Club Territory Grouping（相邻俱乐部领地分组渲染）

**目标：** 只把真正相邻或接触的同俱乐部领地合并为 connected component，不相邻的分开渲染。

**涉及文件：**
- `city-lord-app/src/components/map/TerritoryLayer.tsx`（主要修改）
- `city-lord-app/src/lib/citylord/territory-adjacency.ts`（新增）

**当前代码位置：**
- 分组逻辑：`TerritoryLayer.tsx` L444-L459，按 `ownerClubId` 分组
- 渲染逻辑：L460-L569，同组所有领地合并为一个 Path
- 描边逻辑：L505-L527，选中时画外轮廓
- 头像纹理：L530-L567，`createPattern` 平铺

**数据依赖：**
- 领地列表 API 返回的 `geojson_json`（每个领地的多边形坐标）
- `ownerClubId`（俱乐部 ID）
- `ownerFillColor`（领地填充颜色）

**具体改动步骤：**

1. **新增 `city-lord-app/src/lib/citylord/territory-adjacency.ts`**
   - 包含 `UnionFind` 类、`getBBox()`、`bboxesIntersect()`、`areTerritoriesAdjacent()`、`groupClubTerritoriesByConnectedComponents()`
   - 输入：`{ id, ownerClubId, geojson_json }[]`（当前视口内的领地列表）
   - 输出：`Map<clubId, string[][]>`，每个 connected component 是一组相邻领地的 ID 列表

2. **相邻判断算法（三层容错）**
   - **第 1 层：BBox 预筛选**
     - 计算每个领地的 BBox `[minLng, minLat, maxLng, maxLat]`
     - 如果两个领地 BBox 不相交，直接跳过，不调用 Turf.js
   - **第 2 层：Turf.js `booleanIntersects` + `booleanTouches`**
     - `turf.booleanIntersects(polyA, polyB)` 判断是否相交
     - `turf.booleanTouches(polyA, polyB)` 判断是否共享边界
     - 任一为 true 即视为相邻
   - **第 3 层（容错）：微小缝隙 buffer**
     - 如存在因 GPS 精度导致的微小缝隙（< 5m），可考虑 `turf.buffer(poly, 0.00005, { units: 'kilometers' })` 后再次 `booleanIntersects`
     - **buffer 阈值必须很小（≤ 5m）**，避免错误合并不相邻区域
     - 此层为可选，根据实际测试数据决定是否启用

3. **连通分量算法：Union-Find（并查集）**
   - 遍历所有同俱乐部领地对，BBox 预筛选后调用相邻判断
   - 相邻则 union
   - 最终 `getComponents()` 返回所有连通分量

4. **渲染修改**
   - 将 `TerritoryLayer.tsx` L444-L459 的简单 `groupBy(ownerClubId)` 替换为 `groupByConnectedComponents()`
   - 每个 connected component 独立绘制 Path、描边、头像纹理
   - 选中某块领地时，只高亮它所在的 connected component

5. **性能优化**
   - 只在 Club Mode 下执行相邻判断（个人/阵营模式保持原有逻辑）
   - 使用 `useMemo` 缓存分组结果，依赖项为 `territories` + `mapDisplayMode`
   - 相邻判断只在领地列表变化时重新计算，不在每次渲染时计算
   - 对大量领地（> 200）考虑分帧计算或 Web Worker

6. **描边颜色**
   - 取自被点击领地的 `ownerFillColor`（即 `territory-renderer.ts` 中的个人设置颜色）
   - 如果 `ownerFillColor` 为空，使用俱乐部默认色

7. **多块不连续领地处理**
   - 每个 connected component 独立渲染
   - 每个 component 有自己的头像纹理区域
   - 点击某块领地时，只高亮该 component，其他 component 保持普通状态

**测试覆盖（必须）：**
- [ ] 两个领地相交 → 判定为相邻
- [ ] 两个领地相切（共享边界） → 判定为相邻
- [ ] 两个领地分离 → 判定为不相邻
- [ ] 两个领地有微小缝隙（< 5m） → 根据 buffer 策略决定
- [ ] 多岛屿场景（一个俱乐部 3 块不连续领地） → 3 个独立 component
- [ ] 单领地场景 → 1 个 component
- [ ] 全相邻场景（5 块领地全部相连） → 1 个 component
- [ ] 链式相邻（A-B-C，A 和 C 不相邻） → 1 个 component（A、B、C 连通）

**风险：**
- 相邻判断计算量：同俱乐部领地过多时可能卡顿 → BBox 预筛选 + useMemo 缓存缓解
- Turf.js 坐标系统：确保 `geojson_json` 的坐标系与 Turf.js 一致（项目使用 GCJ-02，Turf.js 无坐标系概念，只要输入输出一致即可）
- 微小缝隙误判：buffer 阈值过大可能错误合并 → 严格限制 ≤ 5m

**验收标准：**
- [ ] 同俱乐部但不相邻的领地不再合并渲染
- [ ] 点击某块领地，只高亮它所在的相邻连通区域
- [ ] 不相邻的同俱乐部领地各自独立描边
- [ ] 描边颜色符合被点击领地的颜色设置
- [ ] 俱乐部头像纹理在每个连通区域内正确平铺
- [ ] 个人模式和阵营模式不受影响

**是否需要后端/API：** 否，纯前端改动。

---

### P0-2: Territory Detail Sheet Club Mode Compact（领地详情弹窗 Club Mode 精简）

**目标：** Club Mode 下点击领地后，底部抽屉首屏精简显示核心信息，背景图使用用户设置的 `background_url`。原有游戏信息保留到"更多详情/展开"区域。

**涉及文件：**
- `city-lord-app/src/components/citylord/territory/TerritoryDetailSheet.tsx`（主要修改）
- `app/api/v1/territory/detail/route.ts`（后端补充字段）
- `city-lord-app/src/components/citylord/territory/TerritoryMoreMenu.tsx`（三点菜单调整）

**当前代码位置：**
- 背景图读取：`TerritoryDetailSheet.tsx` L36-L38，从 `user_metadata.background_url` 或 `profile.background_url` 获取
- 背景图渲染：L119-L124
- 领主头像：L184-L211
- 俱乐部名称标签：L227-L233
- 占领时间：L253-L260
- 位置信息：L234-L237
- 三点菜单：L241-L249 → `TerritoryMoreMenu.tsx`
- 查看俱乐部按钮：L365-L375

**数据结构（当前 API 返回）：**
```typescript
{
  territoryId: string,
  cityName: string,
  capturedAt: string | null,
  area: number,
  owner: { id, nickname, avatarUrl } | null,  // 缺少 backgroundUrl
  club: { id, name, logoUrl } | null,
  recentRun: { distanceKm, durationStr, paceMinPerKm } | null,
  current_hp, health, shield, score_weight, territory_type, ...
}
```

**具体改动步骤：**

1. **后端：领地详情 API 补充 `backgroundUrl`**
   - 文件：`app/api/v1/territory/detail/route.ts`
   - 修改点：L81-L86 的 `profiles` select 中增加 `background_url: true`
   - 修改点：L138-L143 的 `result.owner` 构造中增加 `backgroundUrl: territory.profiles.background_url`
   - 如果 `territory.profiles` 为空走 fallback 查询（L146-L148），也需增加 `background_url`
   - **接口路径**：`GET /api/v1/territory/detail?territoryId=xxx`
   - **新增字段**：`owner.backgroundUrl: string | null`

2. **前端：TerritoryDetailSheet 背景图**
   - 优先使用 API 返回的 `owner.backgroundUrl`
   - 如果 `backgroundUrl` 为空，使用默认渐变背景（保持现有 fallback）

3. **Club Mode 首屏 compact（不删除玩法信息）**
   - **首屏保留显示：**
     - 领主头像 + 昵称
     - 所属俱乐部名称标签
     - 占领时间
     - 地理位置
     - 跑步核心数据（距离/时长/配速/面积）
   - **折叠到"更多详情/展开"区域（不删除）：**
     - 领地完整度百分比条
     - 血量/护盾/积分比重
     - 领地类型标签
     - 领地自定义名称
     - 跑步记录列表
   - **实现方式：** 从 `useMapDisplayStore` 读取 `mapDisplayMode === 'club'`，条件渲染
   - **个人模式必须保持现状**，不做任何改动

4. **"查看俱乐部"按钮位置调整**
   - 当前在弹窗最底部（L365-L375）
   - 移到头像行右侧（L184-L217 区域），与三点菜单并排显示

5. **三点菜单调整**
   - 当前 `TerritoryMoreMenu.tsx` 直接 `navigate` 到 `/settings/feedback`
   - 改为先弹一个小 Dialog 显示"举报"选项，点击后再跳转
   - 举报跳转路径保持 `/settings/feedback`

6. **避免影响个人模式**
   - 所有 compact 逻辑通过 `mapDisplayMode === 'club'` 条件控制
   - 个人模式下保持现有完整显示，不做任何改动

**风险：**
- API 返回 `backgroundUrl` 后，需确认图片 URL 格式是否正确（相对路径 vs 绝对路径）
- compact 后用户可能找不到血量/护盾等游戏数据 → 提供"更多详情"展开入口

**验收标准：**
- [ ] TerritoryDetailSheet 显示领主头像、昵称、俱乐部名称、占领时间、位置
- [ ] 背景图使用 `owner.backgroundUrl`，空值有 fallback
- [ ] Club Mode 下首屏 compact，血量/护盾/积分等保留到"更多详情"区域
- [ ] "查看俱乐部"按钮位于头像行右侧
- [ ] 三点菜单点击先弹小窗口再跳转举报页
- [ ] 个人模式下显示不受影响

**是否需要后端/API：** 是，领地详情 API 需补充 `owner.backgroundUrl` 字段。

---

### P0-3: Compact Club Profile Sheet（精简版俱乐部档案弹窗）

**目标：** 新建精简版 Club Profile 抽屉，只展示核心信息 + Top 5 Territories。

**涉及文件：**
- 新增 `city-lord-app/src/components/citylord/territory/ClubProfileCompactView.tsx`
- `city-lord-app/src/components/citylord/territory/ClubProfileSheet.tsx`（修改引用）
- 新增 `app/api/club/get-club-public-profile/route.ts`（API Route）

**推荐方案：新建 `ClubProfileCompactView.tsx`**

**理由：**
1. `ClubDetailView.tsx` 已有完整的俱乐部详情页（含聊天/动态/成员列表/Tabs），代码量大（1500+ 行）
2. 给 `ClubDetailView` 加 `compact` prop 会导致组件内部大量条件判断，增加复杂度
3. 新建独立组件更清晰，职责单一，不影响现有俱乐部详情页
4. 精简版弹窗是临时展示场景，完整详情页是独立页面，两者使用场景不同

**当前可复用数据（全部使用现有可用 API/action）：**
- `getClubDetailsCached(clubId)` — 返回 club 全量字段 + `total_area`, `member_count`（通过 `v_clubs_summary` 视图，使用 admin client）
- `getClubRankStats(clubId)` — 返回 `{ global, provincial }`（使用 admin client）
- admin client 直接查询 `club_members` + `profiles.total_area` — 取 Top 5 成员（绕过 RLS）

**重要：不调用 `getClubPublicProfile()` action**，因为它依赖的 RPC 函数在 Supabase 中不存在。

**具体改动步骤：**

1. **新增 API Route：`/api/club/get-club-public-profile`**
   - 文件：`app/api/club/get-club-public-profile/route.ts`
   - **不调用 `getClubPublicProfile()` action**
   - 使用以下组合方案：
     - club 基础信息 + total_area + member_count：调用 `getClubDetailsCached(clubId)`
     - 全国/省内排名：调用 `getClubRankStats(clubId)`
     - Top 5 成员：使用 `getSupabaseAdmin()` 直接查询 `club_members` + `profiles.total_area`，按面积降序取前 5
   - 无需鉴权（公开数据）

2. **API Route 实现逻辑：**
   ```typescript
   // app/api/club/get-club-public-profile/route.ts
   import { NextResponse } from 'next/server'
   import { getClubDetailsCached, getClubRankStats } from '@/app/actions/club'
   import { getSupabaseAdmin } from '@/lib/supabase/admin'

   export async function GET(request: Request) {
     const { searchParams } = new URL(request.url)
     const clubId = searchParams.get('clubId')
     if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 })

     const clubDetails = await getClubDetailsCached(clubId)
     if (!clubDetails) return NextResponse.json(null, { status: 200 })

     const rankStats = await getClubRankStats(clubId)

     // Top 5 成员：使用 admin client 直接查询，绕过 RLS
     const { data: memberData } = await getSupabaseAdmin()
       .from('club_members')
       .select(`user_id, role, profiles:user_id(id, nickname, avatar_url, total_area)`)
       .eq('club_id', clubId)
       .eq('status', 'active')

     const topMembers = (memberData || [])
       .map((m: any) => ({
         member_id: m.profiles?.id,
         nickname: m.profiles?.nickname || 'Unknown',
         avatar_url: m.profiles?.avatar_url,
         total_area: Number(m.profiles?.total_area) || 0
       }))
       .sort((a, b) => b.total_area - a.total_area)
       .slice(0, 5)
       .map((m, i) => ({ ...m, rank: i + 1 }))

     return NextResponse.json({
       id: clubDetails.id,
       name: clubDetails.name,
       avatar_url: clubDetails.avatar_url,
       total_area: Number(clubDetails.total_area) || 0,
       member_count: clubDetails.total_member_count || clubDetails.active_member_count || 0,
       rank_national: rankStats.global,
       rank_province: rankStats.provincial,
       top_territories: topMembers
     })
   }
   ```

3. **新建 `ClubProfileCompactView.tsx`**
   - Props：`{ clubId: string, onClose: () => void }`
   - 内部调用 `/api/club/get-club-public-profile?clubId=xxx`
   - 显示内容：
     - 标题 "Club Profile"（顶部居中）
     - 俱乐部头像（圆形，左侧）+ 俱乐部名称（右侧）
     - 总占领面积 + 成员数（一行显示）
     - Rankings 区域：全国排名 + 省内排名（两列布局）
     - Top 5 Territories 区域：前 5 名成员的头像/昵称/面积（列表）
   - 样式：深色背景、圆角、紧凑布局，对齐竞品图二

4. **修改 `ClubProfileSheet.tsx`**
   - 将 `ClubDetailView` 引用改为 `ClubProfileCompactView`
   - 保留 `ClubDetailView` 的完整页面入口（通过其他方式访问，如俱乐部列表页）

5. **Loading / Empty / Error 状态**
   - Loading：显示骨架屏或 spinner
   - Empty：Top 5 Territories 为空时显示"暂无成员领地数据"
   - Error：显示"加载失败，请重试"

6. **Top 5 Territories 数据缺失时的 MVP 方案**
   - `profiles.total_area` 字段在 Prisma schema 中确认存在
   - 如果该字段数据不准确或为空，MVP 阶段显示明确空态："Top 5 领地数据暂不可用"
   - 不阻塞其他功能上线

**风险：**
- `profiles.total_area` 字段数据可能不准确（需确认该字段是否在领地结算时正确更新）
- API 返回数据为空时，组件需正确处理空态

**验收标准：**
- [ ] Club Profile 弹窗显示俱乐部头像、名称、总面积、成员数
- [ ] Rankings 显示全国排名和省内排名
- [ ] Top 5 Territories 显示前 5 名成员的占领面积
- [ ] API 数据缺失时显示明确空态
- [ ] 不包含聊天、动态、完整成员列表
- [ ] 完整 `ClubDetailView` 页面不受影响

**是否需要后端/API：** 是，需新增 `/api/club/get-club-public-profile` API Route。

---

### P0-4: Club Info Bar（俱乐部模式顶部横条）

**目标：** Club Mode 下，在顶部模式切换条下方显示俱乐部信息横条。

**涉及文件：**
- 新增 `city-lord-app/src/components/map/ClubInfoBar.tsx`
- `city-lord-app/src/components/mode/ModeSwitcher.tsx`（集成 ClubInfoBar）

**推荐方案：新建 `ClubInfoBar.tsx`**

**理由：**
1. `KingAreaBanner.tsx` 职责是显示"当前视野领地霸主"，与俱乐部信息横条职责不同
2. `KingAreaBanner` 在俱乐部模式下未选中领地时返回 null（L15），无法满足需求
3. 新建独立组件职责清晰，不破坏现有霸主逻辑

**数据来源规则（明确）：**

| 场景 | 显示内容 | 数据来源 |
|------|---------|---------|
| 未点击领地 + 用户已加入俱乐部 | 用户所属俱乐部名称 + 总面积 | `/api/club/get-club-details-cached` 获取用户所属俱乐部 |
| 点击某块领地后 | 被点击领地所属俱乐部名称 + 总面积 | 从 `selectedTerritory.ownerClub` 获取（领地列表 API 已返回） |
| 用户未加入俱乐部 + 未选中领地 | 隐藏横条 | - |
| 用户未加入俱乐部 + 选中领地 | 被点击领地所属俱乐部名称 + 总面积 | 从 `selectedTerritory.ownerClub` 获取 |

**优先级：点击领地后 > 用户所属俱乐部 > 隐藏**

**未选中领地时：**
- 如果用户已加入俱乐部，显示所属俱乐部名称 + 总面积
- 如果用户未加入俱乐部，隐藏横条

**用户未加入俱乐部时：**
- 未选中领地：隐藏横条
- 选中领地：显示被点击领地所属俱乐部信息

**避免与 `KingAreaBanner` 重叠：**
- `KingAreaBanner` 显示在地图上方（霸主信息）
- `ClubInfoBar` 显示在 `ModeSwitcher` 下方（俱乐部信息）
- 两者垂直排列，不重叠
- Club Mode 下 `KingAreaBanner` 可隐藏或继续显示霸主（不强制改动）

**具体改动步骤：**

1. **新建 `ClubInfoBar.tsx`**
   - Props：`{ clubName: string, totalArea: number, clubLogoUrl?: string }`
   - 样式：
     - 上方：俱乐部头像（小）+ 俱乐部名称 + 总面积（如 "634.3 KM²"）
     - 下方小标签：俱乐部名称或 "CLUB OF THE"（参考竞品图一顶部）
   - 背景：半透明深色，与地图融合
   - 位置：绝对定位在地图顶部，`ModeSwitcher` 下方

2. **获取俱乐部数据**
   - 未选中领地时：调用 `/api/club/get-club-details-cached` 获取用户所属俱乐部（通过 `getUserClub()` action 获取 clubId）
   - 选中领地后：从 `selectedTerritory.ownerClub` 直接获取（领地列表 API 已返回 club name 和 logoUrl）
   - 缓存结果，避免频繁请求

3. **修改 `ModeSwitcher.tsx`**
   - 在 `ModeSwitcher` 下方（或内部）集成 `ClubInfoBar`
   - 仅在 `mapDisplayMode === 'club'` 时显示
   - 传入俱乐部名称和总面积

4. **不影响个人模式**
   - `ClubInfoBar` 仅在 Club Mode 下渲染
   - 个人模式下 `KingAreaBanner` 继续显示领地霸主

**风险：**
- 用户所属俱乐部数据获取时机：需在地图加载时提前获取
- 俱乐部总面积可能为 0 或 null（新俱乐部）→ 显示 "0 KM²"

**验收标准：**
- [ ] Club Mode 下顶部横条显示俱乐部名称 + 总面积
- [ ] 未点击领地时显示用户所属俱乐部（如已加入）
- [ ] 点击领地后显示被点击领地所属俱乐部
- [ ] 用户未加入俱乐部且未选中领地时隐藏横条
- [ ] 横条位于 ModeSwitcher 下方，不与 KingAreaBanner 重叠
- [ ] 个人模式下 KingAreaBanner 不受影响

**是否需要后端/API：** 否，使用现有 `/api/club/get-club-details-cached` 即可。

---

## 5. API Gap Analysis

| 数据项 | 现有 API | 是否已返回 | 缺口 | 所属 PR |
|--------|---------|-----------|------|--------|
| `background_url`（领地所有者） | `/api/v1/territory/detail` | **否** | 需在 profiles select 中增加 `background_url` | PR 1 |
| `background_url`（用户 Profile） | `/api/v1/user/profile` | **是** | 无缺口 | - |
| `club total_area` | `/api/club/get-club-details-cached` | **是** | 无缺口 | - |
| `club member_count` | `/api/club/get-club-details-cached` | **是** | 无缺口 | - |
| `national rank` | `/api/club/get-club-rank-stats` | **是** (`global`) | 无缺口 | - |
| `province rank` | `/api/club/get-club-rank-stats` | **是** (`provincial`) | 无缺口 | - |
| `club top 5 members by territory area` | 无 | **否** | 需新增 API Route，使用 admin client 查询 | PR 1 |
| `club internal members sorted by area` | `getInternalMembers()` (action) | **是** | 无缺口（但 action 受 RLS 限制） | - |

### 最小新增 API 方案

**1. 修改现有 API：`/api/v1/territory/detail`**
- 补充 `owner.backgroundUrl` 字段
- 改动量：约 5 行代码（select 增加字段 + 构造结果增加字段 + fallback 查询增加字段）

**2. 新增 API Route：`/api/club/get-club-public-profile`**
- 路径：`app/api/club/get-club-public-profile/route.ts`
- 逻辑：组合 `getClubDetailsCached` + `getClubRankStats` + admin client 查询 Top 5 成员
- **不调用** `getClubPublicProfile()` action
- 返回：club info + total_area + member_count + rank_national + rank_province + top_territories
- 改动量：约 40 行代码

---

## 6. Data Schema Proposal

### 6.1 Territory Detail API 补充字段

**接口：** `GET /api/v1/territory/detail?territoryId=xxx`

**新增字段：**
```typescript
{
  owner: {
    id: string,
    nickname: string,
    avatarUrl: string | null,
    backgroundUrl: string | null  // 新增
  }
}
```

### 6.2 Club Public Profile API

**接口：** `GET /api/club/get-club-public-profile?clubId=xxx`

**Response Schema：**
```typescript
{
  id: string,
  name: string,
  avatar_url: string | null,
  total_area: number,  // 单位：km²
  member_count: number,
  rank_national: number | null,
  rank_province: number | null,
  top_territories: [
    {
      rank: number,
      member_id: string,
      nickname: string | null,
      avatar_url: string | null,
      total_area: number  // 单位：km²
    }
  ]  // 最多 5 条，不足 5 条时按实际数量返回
}
```

### 6.3 Club Info Bar 数据

**接口：** `GET /api/club/get-club-details-cached?clubId=xxx`

**已有字段（无需修改）：**
```typescript
{
  id: string,
  name: string,
  avatar_url: string | null,
  total_area: number,
  member_count: number,
  active_member_count: number,
  total_member_count: number
}
```

---

## 7. UI Component Plan

### 7.1 新增组件

| 组件 | 路径 | 职责 | 所属 PR |
|------|------|------|--------|
| `ClubInfoBar` | `city-lord-app/src/components/map/ClubInfoBar.tsx` | 俱乐部模式顶部横条，显示俱乐部名称 + 总面积 | PR 3 |
| `ClubProfileCompactView` | `city-lord-app/src/components/citylord/territory/ClubProfileCompactView.tsx` | 精简版俱乐部档案弹窗，显示核心信息 + Top 5 | PR 3 |

### 7.2 改造组件

| 组件 | 改动 | 所属 PR |
|------|------|--------|
| `TerritoryDetailSheet` | Club Mode 下首屏 compact，背景图使用 `backgroundUrl`，"查看俱乐部"按钮移到头部，游戏信息折叠到"更多详情" | PR 3 |
| `ClubProfileSheet` | 引用改为 `ClubProfileCompactView` | PR 3 |
| `TerritoryLayer` | 俱乐部模式分组逻辑改为 connected components | PR 2 |
| `TerritoryMoreMenu` | 三点菜单改为先弹小窗口再跳转 | PR 3 |
| `ModeSwitcher` | 集成 `ClubInfoBar` | PR 3 |

### 7.3 `compact` prop for ClubDetailView 是否必要

**结论：不必要。**

理由：
- `ClubDetailView` 是完整俱乐部详情页（1500+ 行），包含 Tabs、聊天、动态、成员列表
- 加 `compact` prop 会导致组件内部大量条件判断，违反单一职责原则
- 精简版弹窗是临时展示场景，完整详情页是独立页面，两者使用场景完全不同
- 新建 `ClubProfileCompactView` 更清晰，代码量小（约 200 行）

---

## 8. Rendering Algorithm Plan

### 8.1 相邻领地分组算法

**文件：** `city-lord-app/src/lib/citylord/territory-adjacency.ts`（新增）

**函数签名：**
```typescript
function groupClubTerritoriesByConnectedComponents(
  territories: { id: string; ownerClubId: string; geojson_json: string }[]
): Map<string, string[][]>
// 返回：Map<clubId, connectedComponent[]>
// 每个 connectedComponent 是一组相邻领地的 ID 列表
```

**输入：**
- 当前视口内的领地列表（已从 API 获取）
- 每个领地包含 `id`, `ownerClubId`, `geojson_json`

**输出：**
- `Map<clubId, string[][]>`
- 外层 key 是俱乐部 ID
- 内层是每个连通分量的领地 ID 数组

**算法步骤：**

1. **按俱乐部分组**
   ```typescript
   const clubGroups = new Map<string, Territory[]>()
   territories.forEach(t => {
     if (t.ownerClubId) {
       clubGroups.get(t.ownerClubId)?.push(t) || clubGroups.set(t.ownerClubId, [t])
     }
   })
   ```

2. **对每个俱乐部，使用 Union-Find 计算连通分量**
   ```typescript
   class UnionFind {
     parent: Map<string, string>
     rank: Map<string, number>
     constructor(ids: string[]) {
       this.parent = new Map(ids.map(id => [id, id]))
       this.rank = new Map(ids.map(id => [id, 0]))
     }
     find(x: string): string {
       // 路径压缩
       while (this.parent.get(x) !== x) {
         this.parent.set(x, this.parent.get(this.parent.get(x)!)!)
         x = this.parent.get(x)!
       }
       return x
     }
     union(x: string, y: string): void {
       const px = this.find(x), py = this.find(y)
       if (px === py) return
       const rx = this.rank.get(px)!, ry = this.rank.get(py)!
       if (rx < ry) this.parent.set(px, py)
       else if (rx > ry) this.parent.set(py, px)
       else { this.parent.set(py, px); this.rank.set(px, rx + 1) }
     }
     getComponents(): string[][] {
       const groups = new Map<string, string[]>()
       this.parent.forEach((parent, id) => {
         const root = this.find(id)
         groups.get(root)?.push(id) || groups.set(root, [id])
       })
       return Array.from(groups.values())
     }
   }
   ```

3. **相邻判断：三层容错**
   ```typescript
   import { booleanIntersects, booleanTouches, buffer } from '@turf/turf'
   
   const TINY_BUFFER_KM = 0.005  // 5 米，仅用于容错微小缝隙
   
   function areTerritoriesAdjacent(
     geoA: GeoJSON.Feature<GeoJSON.Polygon>,
     geoB: GeoJSON.Feature<GeoJSON.Polygon>
   ): boolean {
     // 第 2 层：直接判断
     if (booleanIntersects(geoA, geoB) || booleanTouches(geoA, geoB)) {
       return true
     }
     // 第 3 层（可选容错）：微小 buffer 后再次判断
     try {
       const bufferedA = buffer(geoA, TINY_BUFFER_KM, { units: 'kilometers' })
       if (bufferedA && booleanIntersects(bufferedA, geoB)) {
         return true
       }
     } catch {
       // buffer 失败时忽略，不阻断流程
     }
     return false
   }
   ```

4. **BBox 预筛选优化**
   ```typescript
   function getBBox(geojson: GeoJSON.Feature<GeoJSON.Polygon>): [number, number, number, number] {
     const coords = geojson.geometry.coordinates[0]
     let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
     for (const [lng, lat] of coords) {
       if (lng < minLng) minLng = lng
       if (lat < minLat) minLat = lat
       if (lng > maxLng) maxLng = lng
       if (lat > maxLat) maxLat = lat
     }
     return [minLng, minLat, maxLng, maxLat]
   }
   
   function bboxesIntersect(
     a: [number, number, number, number],
     b: [number, number, number, number]
   ): boolean {
     return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
   }
   ```

5. **完整流程**
   ```typescript
   export function groupClubTerritoriesByConnectedComponents(
     territories: { id: string; ownerClubId: string; geojson_json: string }[]
   ): Map<string, string[][]> {
     const result = new Map<string, string[][]>()
     
     // 1. 按俱乐部分组
     const clubGroups = new Map<string, typeof territories>()
     territories.forEach(t => {
       if (t.ownerClubId) {
         clubGroups.get(t.ownerClubId)?.push(t) || clubGroups.set(t.ownerClubId, [t])
       }
     })
     
     // 2. 对每个俱乐部计算连通分量
     for (const [clubId, clubTerritories] of clubGroups) {
       if (clubTerritories.length === 0) continue
       
       const uf = new UnionFind(clubTerritories.map(t => t.id))
       
       // 预计算 BBox 和 GeoJSON Feature
       const features = clubTerritories.map(t => ({
         id: t.id,
         bbox: getBBox(JSON.parse(t.geojson_json)),
         feature: JSON.parse(t.geojson_json)
       }))
       
       // 3. 两两判断相邻
       for (let i = 0; i < features.length; i++) {
         for (let j = i + 1; j < features.length; j++) {
           // BBox 预筛选
           if (!bboxesIntersect(features[i].bbox, features[j].bbox)) continue
           // 相邻判断
           if (areTerritoriesAdjacent(features[i].feature, features[j].feature)) {
             uf.union(features[i].id, features[j].id)
           }
         }
       }
       
       result.set(clubId, uf.getComponents())
     }
     
     return result
   }
   ```

**性能考虑：**
- 时间复杂度：O(n²) 对每对领地，但 BBox 预筛选可大幅减少实际调用 `booleanIntersects` 的次数
- 同俱乐部领地数量通常 < 50，O(n²) 可接受
- 使用 `useMemo` 缓存结果，依赖项为 `territories` + `mapDisplayMode`
- 如果领地数量 > 200，考虑分帧计算或 Web Worker

### 8.2 Selected Group Highlight

**逻辑：**
- 用户点击领地 A
- 找到 A 所在的 connected component
- 只对该 component 绘制描边（颜色 = A 的 `ownerFillColor`）
- 其他 component 保持普通填充状态

**实现：**
```typescript
const selectedComponent = useMemo(() => {
  if (!selectedTerritoryId) return null
  const clubId = selectedTerritory.ownerClubId
  const components = connectedComponents.get(clubId)
  return components?.find(comp => comp.includes(selectedTerritoryId)) || null
}, [selectedTerritoryId, connectedComponents])
```

### 8.3 头像纹理复用

- 每个 connected component 独立创建 `createPattern`
- 头像图片从俱乐部 `avatar_url` 获取
- 平铺尺寸保持现有逻辑（60/80/120/160 四档）

---

## 9. Acceptance Criteria

### 必须满足：

1. [ ] Club Mode 下同俱乐部但不相邻的领地不再错误合并
2. [ ] 点击某一块俱乐部领地，只高亮它所在的相邻连通区域
3. [ ] 描边颜色符合所点击领地颜色（`ownerFillColor`）
4. [ ] TerritoryDetailSheet 显示领主头像、昵称、俱乐部名称、占领时间、位置
5. [ ] 背景图使用 `owner.backgroundUrl`，空值有 fallback
6. [ ] "View Club" 打开 compact Club Profile
7. [ ] Club Profile 显示头像、名称、总面积、成员数、全国排名、省内排名
8. [ ] Top 5 Territories 显示前 5 名成员/跑者占领面积，或 API 未实现时显示明确空态
9. [ ] Club Mode 下顶部横条显示俱乐部名称 + 总面积
10. [ ] 个人模式现有领地霸主不受影响
11. [ ] 阵营模式不受影响
12. [ ] 原有血量/护盾/积分等游戏信息未被删除，保留在"更多详情"区域

---

## 10. Test Plan

### 10.1 单元测试

| 测试项 | 文件 | 内容 | 所属 PR |
|--------|------|------|--------|
| Union-Find 算法 | `territory-adjacency.test.ts` | 测试 union、find、getComponents | PR 2 |
| BBox 预筛选 | `territory-adjacency.test.ts` | 测试 BBox 相交/分离判断 | PR 2 |
| 相邻判断 | `territory-adjacency.test.ts` | 测试相交、相切、分离、微小缝隙 | PR 2 |
| 多岛屿场景 | `territory-adjacency.test.ts` | 一个俱乐部 3 块不连续领地 → 3 个 component | PR 2 |
| 链式相邻 | `territory-adjacency.test.ts` | A-B-C 链式，A 和 C 不相邻 → 1 个 component | PR 2 |
| API Route: territory detail | `territory-detail.test.ts` | 验证 `owner.backgroundUrl` 字段 | PR 1 |
| API Route: club public profile | `club-public-profile.test.ts` | 验证返回字段和 Top 5 数量 | PR 1 |

### 10.2 组件测试

| 测试项 | 文件 | 内容 | 所属 PR |
|--------|------|------|--------|
| ClubInfoBar 渲染 | `ClubInfoBar.test.tsx` | 测试俱乐部名称、面积显示 | PR 3 |
| ClubProfileCompactView 渲染 | `ClubProfileCompactView.test.tsx` | 测试核心信息、Top 5 列表 | PR 3 |
| TerritoryDetailSheet Club Mode | `TerritoryDetailSheet.test.tsx` | 测试 compact 内容、背景图、游戏信息折叠 | PR 3 |

### 10.3 手动测试

| 测试场景 | 步骤 | 预期结果 | 所属 PR |
|---------|------|---------|--------|
| 俱乐部模式切换 | 点击右侧 Club Mode 按钮 | 地图显示俱乐部头像纹理，顶部出现 ClubInfoBar | PR 2+3 |
| 点击相邻领地 | 点击某块俱乐部领地 | 相邻连通区域出现描边，底部弹出 TerritoryDetailSheet | PR 2 |
| 点击不相邻领地 | 点击另一块不相邻的同俱乐部领地 | 只高亮该领地所在连通区域，其他区域不受影响 | PR 2 |
| 查看俱乐部 | 点击 TerritoryDetailSheet 的"查看俱乐部" | 弹出 ClubProfileCompactView，显示核心信息 + Top 5 | PR 3 |
| 背景图显示 | 领地所有者的 `backgroundUrl` 非空 | TerritoryDetailSheet 顶部显示用户设置的背景图 | PR 3 |
| 未加入俱乐部 | 用户未加入任何俱乐部，切换到 Club Mode | ClubInfoBar 隐藏，地图正常显示 | PR 3 |
| 个人模式回归 | 切换到 Single Player 模式 | KingAreaBanner 显示领地霸主，功能正常 | PR 2+3 |
| 阵营模式回归 | 切换到 Faction 模式 | 阵营色块正常显示 | PR 2+3 |

### 10.4 API Mock 测试

| 测试项 | Mock 数据 | 预期结果 | 所属 PR |
|--------|----------|---------|--------|
| 领地详情 API | `owner.backgroundUrl = "https://..."` | TerritoryDetailSheet 显示背景图 | PR 1 |
| 领地详情 API | `owner.backgroundUrl = null` | TerritoryDetailSheet 使用默认渐变背景 | PR 1 |
| Club Public Profile API | `top_territories = []` | ClubProfileCompactView 显示空态 | PR 1 |
| Club Public Profile API | `top_territories` 有 5 条数据 | 正确显示 Top 5 列表 | PR 1 |
| Club Public Profile API | `top_territories` 有 3 条数据 | 显示 3 条，不报错 | PR 1 |

### 10.5 回归测试

| 测试项 | 内容 | 所属 PR |
|--------|------|--------|
| 个人模式领地渲染 | 领地色块、点击、详情弹窗正常 | PR 2+3 |
| 阵营模式领地渲染 | 阵营色块、点击、详情弹窗正常 | PR 2+3 |
| 完整俱乐部详情页 | 通过俱乐部列表页进入，聊天/动态/成员列表正常 | PR 3 |
| 领地霸主横条 | 个人模式下 KingAreaBanner 正常显示 | PR 2+3 |

---

## 11. PR Breakdown & Implementation Order

### PR 1 — API Data Layer

**范围：**
- 修改 `/api/v1/territory/detail`，补充 `owner.backgroundUrl`
- 新增 `/api/club/get-club-public-profile` API Route
- **不调用** 有风险的 `getClubPublicProfile()` action
- 使用 `getClubDetailsCached` + `getClubRankStats` + admin client 查询 Top 5 成员
- 不改前端 UI

**涉及文件：**
- `app/api/v1/territory/detail/route.ts`（修改，+5 行）
- `app/api/club/get-club-public-profile/route.ts`（新增，~40 行）

**验收：**
- [ ] territory detail 返回 `owner.backgroundUrl`
- [ ] club public profile 返回 club avatar/name/total_area/member_count/rank_national/rank_province/top_territories
- [ ] top_territories 最多 5 条
- [ ] API 缺数据时返回明确 empty 状态
- [ ] 不依赖缺失的 RPC 函数

**是否需要后端：** 是

---

### PR 2 — Club Mode Connected Components Rendering

**范围：**
- 新增 `territory-adjacency.ts`（Union-Find + 相邻判断 + BBox 预筛选 + 微小缝隙容错）
- 修改 `TerritoryLayer.tsx` 分组逻辑
- 只处理同俱乐部相邻领地分组、头像纹理和选中描边
- **不改** TerritoryDetailSheet
- **不改** ClubProfileSheet
- **不改** 个人模式/阵营模式

**涉及文件：**
- `city-lord-app/src/lib/citylord/territory-adjacency.ts`（新增，~120 行）
- `city-lord-app/src/components/map/TerritoryLayer.tsx`（修改，~50 行）
- `city-lord-app/src/lib/citylord/__tests__/territory-adjacency.test.ts`（新增，~80 行）

**验收：**
- [ ] 同俱乐部不相邻领地不再合并
- [ ] 点击一块领地只高亮其所在连通区域
- [ ] 多个不连续区域独立渲染
- [ ] 描边颜色取点击领地颜色
- [ ] 个人模式和阵营模式不受影响
- [ ] 单元测试覆盖：相邻、相切、分离、微小缝隙、多岛屿、链式相邻

**是否需要后端：** 否

---

### PR 3 — Compact UI Layer

**范围：**
- TerritoryDetailSheet Club Mode compact 首屏（游戏信息保留到"更多详情"区域，不删除）
- ClubProfileCompactView
- ClubProfileSheet 使用 compact view
- ClubInfoBar（数据来源：未点击时显示用户所属俱乐部，点击后显示被点击领地所属俱乐部）
- TerritoryMoreMenu 小菜单
- **不删除** 完整 ClubDetailView
- **不破坏** 聊天/动态/成员列表完整页面

**涉及文件：**
- `city-lord-app/src/components/citylord/territory/TerritoryDetailSheet.tsx`（修改，~40 行）
- `city-lord-app/src/components/citylord/territory/TerritoryMoreMenu.tsx`（修改，~15 行）
- `city-lord-app/src/components/citylord/territory/ClubProfileCompactView.tsx`（新增，~200 行）
- `city-lord-app/src/components/citylord/territory/ClubProfileSheet.tsx`（修改，~5 行）
- `city-lord-app/src/components/map/ClubInfoBar.tsx`（新增，~80 行）
- `city-lord-app/src/components/mode/ModeSwitcher.tsx`（修改，~10 行）

**验收：**
- [ ] Detail Sheet 显示领主头像、昵称、俱乐部名、时间、位置、核心跑步数据
- [ ] 背景图使用 `owner.backgroundUrl`，空值有 fallback
- [ ] 血量/护盾/积分等游戏信息保留在"更多详情"区域，未被删除
- [ ] View Club 打开 compact profile
- [ ] Compact profile 显示头像、名称、总面积、成员数、全国/省内排名、Top 5
- [ ] ClubInfoBar 显示俱乐部名称 + 总面积
- [ ] ClubInfoBar 数据来源规则：未点击时显示用户所属俱乐部，点击后显示被点击领地所属俱乐部
- [ ] 个人模式/阵营模式回归正常

**是否需要后端：** 否（依赖 PR 1 的 API）

---

### 实施顺序

```
PR 1 (API Data Layer)
  ↓ 无依赖，可独立实施和部署
PR 2 (Connected Components Rendering)
  ↓ 可与 PR 1 并行实施（不依赖 API）
PR 3 (Compact UI Layer)
  ↓ 依赖 PR 1（API 数据）+ PR 2（渲染基础）
```

**推荐：先实施 PR 1 + PR 2（可并行），再实施 PR 3。**

---

## 12. Risk & Mitigation

| 风险 | 影响 | 缓解措施 | 所属 PR |
|------|------|---------|--------|
| **地图性能** | 相邻判断计算量大，导致卡顿 | BBox 预筛选 + useMemo 缓存 + 限制同俱乐部领地数量 | PR 2 |
| **Turf.js 依赖大小** | 已引入，无额外风险 | 项目已依赖 `@turf/turf`，无需新增 | PR 2 |
| **不相邻区域错误合并** | 用户体验差，领地显示混乱 | 严格使用 `booleanIntersects` + `booleanTouches`，buffer 阈值 ≤ 5m，添加单元测试 | PR 2 |
| **API 数据缺失** | `backgroundUrl` 或 Top 5 数据为空 | 提供 fallback（默认背景、空态提示） | PR 1+3 |
| **ClubDetailView 过度复用** | 弹窗过重，加载慢 | 新建独立 `ClubProfileCompactView`，不复用 `ClubDetailView` | PR 3 |
| **背景图为空** | 弹窗顶部显示空白 | 使用默认渐变背景作为 fallback | PR 3 |
| **个人模式/阵营模式回归** | 改动影响其他模式 | 所有改动通过 `mapDisplayMode` 条件控制，添加回归测试 | PR 2+3 |
| **Union-Find 算法 bug** | 连通分量计算错误 | 编写单元测试覆盖边界情况（单领地、全相邻、全分离、链式、多岛屿） | PR 2 |
| **坐标系问题** | GCJ-02 vs WGS-84 导致相邻判断错误 | Turf.js 无坐标系概念，只要输入输出一致即可；项目统一使用 GCJ-02 | PR 2 |
| **`getClubPublicProfile` action 被误用** | 运行时崩溃 | 本阶段不调用该 action；如未来要保留，需单独补 migration 或重写 action | PR 1 |
| **`profiles.total_area` 数据不准确** | Top 5 排序错误 | MVP 阶段如数据为空显示明确空态，不阻塞上线 | PR 1+3 |

---

## 13. Final Recommendation

### 1. 是否建议实施？

**建议实施。**

理由：
- 当前代码基础架构已较完善，主要缺口集中在数据层（API 字段缺失）和渲染逻辑（相邻判断）
- 所有改动都是增量式的，不破坏现有功能
- 后端 action 已大部分实现，只需暴露 API Route（且已规避有风险的 action）
- 前端组件职责清晰，改动范围可控
- 分 3 个 PR 推进，每个 PR 改动量小，review 更容易

### 2. 哪些任务必须先做？

**必须先做：**
1. **PR 1（API Data Layer）**：`backgroundUrl` 和 Club Public Profile API 是后续所有功能的数据基础
2. **PR 2（Connected Components Rendering）**：这是俱乐部模式的核心体验，直接影响用户感知

PR 1 和 PR 2 可并行实施。

### 3. 哪些任务可以延后？

**可以延后（在 PR 3 中酌情处理）：**
1. **三点菜单改为先弹小窗口**：当前直接跳转也可用，体验优化可后续迭代
2. **位置信息格式优化**：当前显示 `cityName · ID` 也可用，改为自然地址格式是体验优化
3. **ClubInfoBar 完整样式打磨**：可先实现基础功能，后续优化视觉细节

### 4. 是否需要后端先行？

**是，PR 1 需后端先行。**

理由：
- `backgroundUrl` 字段缺失会导致 TerritoryDetailSheet 背景图无法显示
- Club Public Profile API 未暴露会导致 Top 5 Territories 无法获取
- PR 1 改动量小（约 45 行代码），可快速完成
- PR 2 不依赖 PR 1，可并行实施

### 5. 是否建议拆成多个 PR？

**已拆成 3 个 PR：**

| PR | 内容 | 依赖 | 是否需要后端 |
|----|------|------|------------|
| **PR 1: API Data Layer** | 补充 `backgroundUrl` + 新增 Club Public Profile API | 无 | **是** |
| **PR 2: Club Mode Rendering** | Connected Components 算法 + TerritoryLayer 修改 | 无（可与 PR 1 并行） | 否 |
| **PR 3: UI Components** | TerritoryDetailSheet compact + ClubProfileCompactView + ClubInfoBar | PR 1 + PR 2 | 否 |

**理由：**
- PR 1 纯后端改动，可独立 review 和部署
- PR 2 纯前端渲染逻辑，可独立测试，与 PR 1 并行
- PR 3 依赖前两个 PR 的数据和渲染基础
- 拆分后每个 PR 改动量小，review 更容易
- 如果某个 PR 有问题，可单独回滚

### 6. 是否建议进入代码实现？

**建议先批准 PR 1 进入代码实现。**

PR 1 改动量最小（约 45 行代码），风险最低，且是后续 PR 的数据基础。PR 2 可与 PR 1 并行实施。

---

## Appendix A: File Change Summary

| 文件 | 改动类型 | 改动量 | 所属 PR |
|------|---------|--------|--------|
| `app/api/v1/territory/detail/route.ts` | 修改 | +5 行 | PR 1 |
| `app/api/club/get-club-public-profile/route.ts` | 新增 | ~40 行 | PR 1 |
| `city-lord-app/src/lib/citylord/territory-adjacency.ts` | 新增 | ~120 行 | PR 2 |
| `city-lord-app/src/lib/citylord/__tests__/territory-adjacency.test.ts` | 新增 | ~80 行 | PR 2 |
| `city-lord-app/src/components/map/TerritoryLayer.tsx` | 修改 | ~50 行 | PR 2 |
| `city-lord-app/src/components/citylord/territory/TerritoryDetailSheet.tsx` | 修改 | ~40 行 | PR 3 |
| `city-lord-app/src/components/citylord/territory/TerritoryMoreMenu.tsx` | 修改 | ~15 行 | PR 3 |
| `city-lord-app/src/components/citylord/territory/ClubProfileCompactView.tsx` | 新增 | ~200 行 | PR 3 |
| `city-lord-app/src/components/citylord/territory/ClubProfileSheet.tsx` | 修改 | ~5 行 | PR 3 |
| `city-lord-app/src/components/map/ClubInfoBar.tsx` | 新增 | ~80 行 | PR 3 |
| `city-lord-app/src/components/mode/ModeSwitcher.tsx` | 修改 | ~10 行 | PR 3 |

**总计：** 新增 ~535 行，修改 ~120 行

---

## Appendix B: Supabase RPC Functions — 已确认不依赖

**审计结论：**

已在仓库所有 migration 文件中搜索 `get_club_total_area` 和 `get_club_rank`，**未发现**这两个 RPC 函数的定义。

因此：
- `getClubPublicProfile()` action 在当前环境中调用会运行时崩溃
- **本阶段不依赖这两个 RPC 函数**
- 新增的 `/api/club/get-club-public-profile` API Route 使用 `getClubDetailsCached` + `getClubRankStats` + admin client 直接查询的组合方案，完全绕过这两个 RPC
- 如未来要保留或修复 `getClubPublicProfile` action，需要单独创建 migration 补充这两个 RPC 函数，或重写该 action 使用现有可用 API

---

**文档版本：** v3.0  
**创建日期：** 2026-06-27  
**状态：** 待审批（本轮仅批准 PR 1 — API Data Layer）
