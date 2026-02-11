# Project Rules & Standards

## 1. 核心指令 (Core Commands)
- **Type Check**: `typecheck: tsc --noEmit` 
  > 规则：AI 在完成任何代码逻辑修改后，必须建议或自动执行此命令以确保类型安全。

## 2. 代码质量准则
- **类型安全 (Type Safety)**: 严禁使用 `any`，所有 Prisma 模型引用必须使用生成的类型。
- **错误处理 (Error Handling)**: 严禁“快乐路径”。所有异步逻辑（Server Actions, Hooks）必须包裹 `try/catch` 并有用户友好的错误提示。
- **水化保护 (Hydration)**: 针对 Next.js 16，所有使用浏览器 API (window/localStorage) 的组件必须进行挂载检查或 dynamic 导入。

## 3. 移动端适配 (Capacitor & Mobile)
- **原生能力**: 涉及 Geolocation/Haptics 时，必须检查 `Capacitor.isNativePlatform()`。
- **交互规范**: 禁止使用 Hover 态作为核心功能触发点，必须适配移动端点击体验。
- **UI 边界**: 所有页面必须使用 `Safe Area` 适配，确保刘海屏和底部手势条不遮挡内容。

## 4. 业务逻辑铁律
- **地理计算**: `Turf.js` 和 `H3` 逻辑严禁随意改动坐标转换（GCJ-02 偏移处理）。
- **数据一致性**: 俱乐部加入必须经过数据库事务（Transaction）或 Supabase RLS 校验，确保一人一会。

## 5. AI 协作自检清单
- 修改后是否引入了新的类型报错？
- 修改后是否会导致移动端滑动卡顿或样式崩溃？
- 是否遵循了 `AGENTS.md` 中的架构完整性原则？