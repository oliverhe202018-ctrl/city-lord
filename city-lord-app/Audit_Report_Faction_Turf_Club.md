# System Audit Report: Faction Turf Map & Club View Baseline

## 🔍 审查任务 1：当前领地渲染机制 (Turf Rendering Logic)

**1. 当前领地多边形（Polygon）的颜色的决定机制**
- **非硬编码**：领地颜色目前并非完全硬编码，而是由一套分层的状态与样式映射引擎决定的。主要逻辑在 `src/components/map/TerritoryLayer.tsx` 中的 `buildPolygonPresentation` 方法里。
- **状态映射**：
  - **俱乐部模式 (`mapDisplayMode === 'club'`)**：基于 `ownerClubId` 与当前用户的 `clubId` 进行比对。若是 `self`，则使用 `#3b82f6`（蓝色系）；若是 `enemy`，则使用 `#ef4444`（红色系）；若是 `neutral`，则使用 `#64748b`（灰色系）。低生命值（<50）会被强制覆盖为黄色警告色 `#facc15`。
  - **阵营模式 (`mapDisplayMode === 'faction'`)**：颜色由 `ownerFaction` 决定，如果数据中包含了 `ownerFactionColor` 则优先使用。底层还通过 `resolveFactionColor` 进行了硬编码回退（例如 Red -> `#ef4444`, Blue -> `#3b82f6`）。
  - **个人模式 (`mapDisplayMode === 'individual'`)**：如果领地是自己的，会优先读取 `territoryAppearance.fillColor`（用户自定义颜色）。如果不是，则回退到领地自带的 `ownerFillColor` / `ownerPathColor` 或通过 `generateTerritoryStyle` 进行样式计算，最终回退色为 `#FF6B35` (橙色)。
  - **健康度视觉计算**：通过 `calculateHealthVisuals` 进行基于 `health`（生命值）的透明度与色彩微调。

**2. 当前数据接口对阵营/俱乐部的支持**
- **充分支持**：底层调用的 `/api/v1/territories` 返回了 `ExtTerritory` 类型，里面已经包含了非常丰富的从属关系字段，包括：
  - `ownerClubId` (所属俱乐部)
  - `ownerFaction` (所属阵营)
  - `ownerId` (占领者)
  - `clubName` / `clubAvatarUrl` / `ownerFactionColor` (其他扩展显示字段)
- **结论**：数据结构已准备就绪，不需要为基本的区分再额外联表，目前可以完全依靠现有的 `ExtTerritory` 字段进行聚类渲染。

**3. 统一的颜色映射表与工具**
- **内部封装**：存在局部常量 `CLUB_COLORS` 以及 `resolveFactionColor` 函数，但目前它们只散落在 `TerritoryLayer.tsx` 中。
- **外部工具支持**：有部分逻辑封装在 `@/lib/citylord/territory-renderer` 的 `calculateHealthVisuals` 和 `generateTerritoryStyle` 函数中，但专门针对“阵营”或“俱乐部全量调色板”的全局通用工具较少。如果需要进一步给**不同的俱乐部**（而不是简单的自我/敌人）上不同的颜色，我们缺乏一个将 `clubId` 映射到全局确定性颜色值的统一 Hash/Palette 函数。

---

## 🔍 审查任务 2：俱乐部数据与入口 (Club Data Flow & Entry Points)

**1. 俱乐部详情数据中是否包含领地中心坐标**
- **缺失核心坐标数据**：在 `fetchClubDetailsCached` 和当前 SWR 绑定的 `ClubDetailInfo` 结构中，仅包含 `id`, `name`, `description`, `avatarUrl`, `memberCount`, `province`, `totalArea`。
- **缺失 territoryIds**：API 并未返回该俱乐部占领的所有 `territoryIds`。
- **现状结论**：要在进入俱乐部详情时实现“视察俱乐部大本营（最大领地）”，我们**缺少该俱乐部最大领地（或核心领地）的坐标 (lat, lng)**。当前的方案中只对**具体成员**开放了 `member-territories` API（含 `center` 坐标），但未对俱乐部级别提供全局核心坐标返回。需要在获取详情的 API `/api/club/get-club-details-cached` 补充 `coreTerritoryCenter: [number, number]` 字段。

**2. “视察领地”按钮的最合适 UI 位置**
根据对 `src/components/citylord/club/ClubDetailView.tsx` 的结构分析，有两个位置最为合理，且不会破坏现有布局：
- **方案 A (非成员 & 成员可见 - 推荐)**：在头部 `MapTopBar` 下方，俱乐部名字与简介处的 `Inline Stats Row`（总面积与总人数展示区）。可以在 `Footprints` (总面积) 旁边增加一个 `MapPin` (定位) 按钮，或者增加一个第三项 `<div className="flex items-center gap-1 cursor-pointer"> <MapPin/> 视察领地 </div>`。
- **方案 B (已加入成员可见)**：在下方的 `Quick-action row` (4列 Grid 结构)。目前已经有了 `invite`, `achievements`, `leaderboard`, `territory`（领地争夺）。由于当前是 `grid-cols-4`，如果强行加入第五个按钮会破坏均分排版。如果要放这里，需要将其改为两排，或者替换其中某一项。由于 `territory` (领地争夺) 是一个独立的页面功能，不适合直接做“飞跃视察”，所以方案 A 是 UI 侵入最小且逻辑最通顺的选择。

**3. 全局 `FLY_TO` 机制的安全调用**
- **完全支持且安全**：在 `ClubDetailView.tsx` 内部的 `member-territories` 子视图中，我们已经有一套非常稳定和安全的 `FLY_TO` 实践模式，代码如下：
  ```typescript
  // 1. 设置相机聚焦状态
  useMapInteractionStore.getState().setPendingCameraFocus({ ... });
  // 2. 关闭可能存在的底层抽屉（安全卸载）
  useGameStore.getState().closeDrawer();
  // 3. 跨上下文 Tab 切换，不会引发内存泄露
  window.dispatchEvent(new CustomEvent("citylord:switch-tab", { detail: { tab: "play" } }));
  ```
- **结论**：这套联合机制已被证明是安全的。我们在新开发的“俱乐部一键视察”功能中完全可以复用这套三步走的调用逻辑，无需担心卸载导致的异常。

---

## 🚀 下一步开发行动建议

基于上述审查，建议下一步按照以下两点作为前置条件推进：
1. **API 层扩充**：修改后端的获取俱乐部详情接口，附加俱乐部最大面积的领地的 `center_lng`, `center_lat` 和 `territory_id` 供前端读取。
2. **调色板工具建立**：在前端抽离一个稳定的 `getClubColor(clubId: string)` 哈希函数至 `@/lib/citylord/territory-renderer` 中，用于接下来的全局俱乐部色彩涂装。
