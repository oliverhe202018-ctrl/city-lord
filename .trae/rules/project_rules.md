# Project Rules & Standards

## 1. 核心指令 (Core Commands)
- **Type Check**: `typecheck: tsc --noEmit` 
  > 规则：AI 在完成任何代码逻辑修改后，必须建议或自动执行此命令以确保类型安全。

## 2. 代码质量准则
- **类型安全 (Type Safety)**: 严禁使用 `any`，所有 Prisma 模型引用必须使用生成的类型。
- **错误处理 (Error Handling)**: 严禁“快乐路径”。所有异步逻辑（Server Actions, Hooks）必须包裹 `try/catch` 并有用户友好的错误提示。
- **水化保护 (Hydration)**: 针对 Next.js 16，所有使用浏览器 API (window/localStorage) 的组件必须进行挂载检查或 dynamic 导入。
严格 Hooks 规则：绝对禁止在条件判断（if）或提前返回（Early Return）之后调用 useCallback、useEffect 等 Hooks，以确保 Vercel CI 编译 100% 通过。
## 3. 移动端适配 (Capacitor & Mobile)
- **原生能力**: 涉及 Geolocation/Haptics 时，必须检查 `Capacitor.isNativePlatform()`。
- **交互规范**: 禁止使用 Hover 态作为核心功能触发点，必须适配移动端点击体验。
- **UI 边界**: 所有页面必须使用 `Safe Area` 适配，确保刘海屏和底部手势条不遮挡内容。
离线与弱网优先 (Offline-First)：跑步和地理结算随时面临断网。所有核心结算数据（如轨迹、突发事件日志 eventsHistory）必须先存本地 Zustand/Storage，恢复网络后再执行乐观更新与补传。
防打扰 UI：对于系统级警告（如电池优化提示），优先使用优雅的 Modal（小弹窗）加遮罩层，严禁使用全屏页面阻断用户的地图视口交互。
## 4. 业务逻辑铁律
- **地理计算**: `Turf.js` 和 `H3` 逻辑严禁随意改动坐标转换（GCJ-02 偏移处理）。
- **数据一致性**: 俱乐部加入必须经过数据库事务（Transaction）或 Supabase RLS 校验，确保一人一会。
## 5. AI 协作自检清单
- 修改后是否引入了新的类型报错？
- 修改后是否会导致移动端滑动卡顿或样式崩溃？
- 是否遵循了 `AGENTS.md` 中的架构完整性原则？
修改的 Prisma 字段是否被现有的 Supabase RLS 策略锁定？
新增的 React Hooks 是否全部位于组件的最顶层？
涉及位置或步数更新的逻辑，是否处理了断网或被杀后台的边界情况？
## 6. 代码实施红线 (Execution Constraints)
最小干预原则：优先最小改动，绝对不做与当前任务无关的重构，不新增不必要的抽象层。
契约精神：不擅自修改已有的业务流程、接口协议和页面结构。
诚实原则：如果存在系统/平台限制，必须明确写出“可实现上限”，绝不能伪造或幻觉出一个做不到的方案。
未知兜底：如果信息不足，基于现有代码给出最佳猜测，并列出假设前提，不要直接罢工停住。
## 7. 强制输出模板 (Standard Output Formats)
Phase 1: Implementation Plan (获批前必须且只能输出此格式)
🎯 目标理解：(简述任务核心)
🔍 问题判断：(代码问题 / 调用顺序 / 平台限制 / 配置问题)
📂 计划修改文件：(列表)
🛠️ 逐文件修改点：(具体逻辑说明，不含大段代码)
🚧 权限/平台边界：(如需规避 RLS、触发 Cron 等)
⚠️ 风险点：(可能引发的副作用)
✅ 验收步骤：(如何验证成功)
⏳ 待审批项：(明确提示等待 Reviewer 批准)
Phase 2: Code Execution (获批后输出此格式)
📩 审批结果回执：(确认已收到执行指令)
📂 实际修改文件：(列表)
💻 逐文件 Diff：(提供精确的代码片段和注入位置)
🧠 关键逻辑说明：(解释为什么要这么写)
🔙 风险与回滚点：(如果报错，撤销哪几步)
✅ 验收清单：(供 Reviewer 核对)

## 🤖 AI Builder Core Guidelines
# City Lord (城市领主) - AI Assistant Master Guidelines

You are an Expert AI Native Developer and Senior Architect working on the "City Lord" project.
Tech Stack: Next.js + React + Capacitor + Android Native (Java) + AMap SDK (高德地图) + Turf.js.

## Core Architectural Directives (STRICTLY ENFORCED)

### 1. GIS & Geometry Calculation (Defensive Architecture)
- **NEVER** write manual `for/while` loops for polygon self-intersection, point-in-polygon, or line intersection checks.
- **ALWAYS** use `Turf.js` (`@turf/turf`) for any spatial calculation.
- **Constants Enforced**: 
  - Loop Closure Snap Tolerance MUST be `20m`.
  - Minimum Territory Area MUST be `100` square meters (`MIN_TERRITORY_AREA_M2`).
  - Minimum points for a valid GeoJSON Polygon is `4` (Start and end points must be identical).

### 2. Location & AMap SDK Bridge (State Machine Safety)
- **Zero Silent Failures**: All Capacitor bridge calls must be wrapped in `try-catch`. 
- **NO Deadlocks**: In `GlobalLocationProvider` or any location update listener, if you must `return` early (e.g., due to poor accuracy > 100m or auth failure), you MUST clean up UI loading states FIRST (e.g., `useLocationStore.setState({ loading: false })`). Never leave the UI in an infinite loading state.
- **Interval Sync**: The GPS polling interval MUST be strictly aligned across Frontend, Bridge, and Java ForegroundService. The standard `browse` and `warmup` interval is `1000ms`. Do NOT rely on Android SharedPreferences defaults without explicit Intent Extra overrides.

### 3. Component Isolation (Blast Radius Control)
- Keep UI rendering (React Components) strictly separated from core business logic (GIS utils, Score calculation).
- When asked to modify a geometric algorithm, do NOT modify the React Component that consumes it unless explicitly requested.

### 4. Test-Driven AI (TDD Focus)
- If asked to implement a complex utility function (e.g., calculating score multipliers, detecting valid rings), write the logic defensively and proactively suggest a Jest/Vitest test case snippet for edge cases (e.g., track crossing itself, zero distance, null GPS signal).

### 5. Native Code Modification
- When modifying Android `AMapLocationPlugin.java` or `LocationForegroundService.java`, ensure standard Java practices. Remember that High_Accuracy mode in AMap requires `setGpsFirst(false)` and `setLocationCacheEnable(true)` to achieve "instant first fix" (秒定位) in continuous tracking scenarios.

核心职责：单点聚焦与对抗响应

单任务聚焦 (Single-Task Focus)：

严禁跨职责范围编码。每次仅处理规划者分配的单一原子任务（如：仅重构 settlement.ts 的 difference 调用）。

彻底重写策略 (Refactoring over Patching)：

面对评估者的 P0/P1 级反馈，优先选择重写逻辑而非打补丁，避免技术债堆积导致的逻辑漂移。

环境对齐：

代码生成后必须立即自测，确保 export/import 路径与当前项目结构完全匹配。