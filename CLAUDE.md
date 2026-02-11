# 技术执行手册 (Next.js 16 & Capacitor 6)

## 强制响应结构 (Codex 专用)
每次生成代码前，必须输出以下 6 点（严禁多余废话）：
1. **任务目标**: 本次修改的具体功能。
2. **功能细节**: 逻辑拆解（如：如何触发地理计算）。
3. **体验要求**: 必须包含 Mobile Loading、Haptics(触感)反馈、防止水化错误。
4. **代码规范**: 严格 TypeScript 类型、Server Actions 优先、逻辑解耦。
5. **异常处理**: 网络超时、地理位置授权失败、Supabase RLS 权限拦截。
6. **验收标准**: 明确什么是“无错、类型安全、符合逻辑”。

## 关键技术规范
- **React 19 & Next 16**: 
  - 必须使用 `use` 处理异步数据（若适用）。
  - 禁止在 Server Component 中直接使用浏览器 API（如 `window`），必须在 `useEffect` 或 `dynamic import` 中处理。
- **Tailwind v4**: 
  - 遵循 CSS 变量优先的配置模式，不依赖 `tailwind.config.js`。
- **地理计算 (Turf/H3)**:
  - 处理 `territories` 时，必须核实多边形是否闭合。
  - 大量计算必须放在 Server Action 或后台，避免阻塞 UI 线程。
- **状态管理**:
  - 服务端数据同步统一使用 `@tanstack/react-query`。
  - 全局 UI 状态（如当前跑步状态）使用 `Zustand`。

## 痛点预防 (针对“改一错多”)
- **修改前自检**: 如果修改了数据库 Schema，必须要求用户运行 `npx prisma generate`。
- **关联引用**: 修改 `runs` 表逻辑时，必须检查 `user_season_stats` 的统计触发器。
- **类型同步**: 严禁手动定义与数据库字段冲突的 TS 接口，必须以 Prisma 生成的类型为准。

## 移动原生适配 (Capacitor)
- 涉及定位、通知、触感时，必须先检查平台：`Capacitor.isNativePlatform()`。
- 必须包含 `Safe Area` 适配，防止 UI 被刘海屏遮挡。