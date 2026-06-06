# 前后端分离与纯静态架构迁移记录 (SPA Migration Log)

## 1. 背景与目标
由于之前使用了“壳子应用”架构（WebView 直接加载 Next.js 服务端页面），导致移动端无法进行离线缓存且原生硬件 API 融合存在严重障碍。本项目现已彻底重构为 **Vite + React Router 的纯原生单页应用 (SPA)**。

## 2. 核心挑战与解决：白屏故障 (TypeError: Illegal constructor)
**故障现象**：打包出静态资源并在本地或移动端运行时，App 启动直接白屏，并在控制台抛出 `TypeError: Illegal constructor`。
**根本原因深度剖析**：
- 在之前的重构中，部分 React 组件使用了 `import { type ComponentName } from '...'` 的语法。
- TypeScript / Vite 编译时，带有 `type` 关键字的导入会被完全擦除（Erasure）。
- 在 JSX 中调用 `<ComponentName />` 时，由于作用域内找不到该组件变量，React 会尝试沿着作用域链向上查找，最终退化为调用浏览器全局对象（即 `window.ComponentName`）。
- 例如：`import { type SyncManager } from './SyncManager'` 被擦除后，`<SyncManager />` 触发了对原生浏览器 API `window.SyncManager` (Background Sync API) 的调用。由于原生 DOM 对象无法作为 React 组件被实例化（不可作为函数调用），从而抛出 `Illegal constructor`。
- 其他类似的潜在全局污染对象包括 `Location` (`window.Location`)、`Image` (`window.Image`) 等。

**修复方案**：
- 编写了全局 AST 级别的修正脚本，遍历 `src/` 下所有 `.tsx` 与 `.ts` 文件。
- 将所有针对首字母大写组件的 `import { type X }` 强制降级替换为值导入 `import { X }`。
- 多次执行静态代码扫描与 Vite 打包验证 (`npm run build`)，精准剥离真正的 TypeScript Interface 与 React Component 的导入方式，消除了所有的构建报错和全局变量 fallback 隐患。

## 3. 被隔离组件的弥补策略 (Redis 与核心业务)
前端现已完全剥离所有 Node.js 依赖（如 Prisma、Redis、`fs` 等）。
**性能与功能弥补原则**：
- **Redis 缓存**：不再由前端代码直连，而是转移至 Next.js 服务端的 API 路由 (`api/`) 内执行。前端通过 `apiFetch` 获取数据，服务端在响应前利用 Redis 进行缓存优化与节流。
- **核心玩法（跑图、阵营、结算）**：前端纯粹负责数据的展现与高频次坐标采集（利用 Capacitor 插件），计算密集型与数据验证（防作弊）逻辑统一下沉至后端接口异步处理。

## 4. 后续指南
任何后续接入的 AI 工具在修改代码时，必须严格遵守 `AGENTS.md` 中的规范：
- 绝对禁止在 `city-lord-app` 内引入服务端特有依赖。
- 保证构建时 `import { type X }` 仅用于纯 TS 类型，React 组件必须使用值导入。
