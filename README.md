# City Lord - 城市领主

City Lord 是一款结合真实地理位置（LBS）的跑步领地争夺游戏。玩家通过在现实世界中跑步来占领地图上的六边形地块，加入阵营（赤红先锋 vs 蔚蓝联盟），与同城的跑者竞争，扩张领地，赢取荣誉。

## ✨ 功能特性 (Features)

*   **实时地理位置追踪**: 使用高德地图与 GPS，精准追踪用户跑步路径。
*   **领地争夺**: 在地图上绘制闭环路径以占领六边形地块，扩大你的领地。
*   **阵营对抗**: 加入两大阵营之一，参与城市级别的领地争夺战。
*   **俱乐部系统**: 创建或加入俱乐部，与伙伴共同战斗，参与俱乐部排名。
*   **沉浸式跑步模式**: 专为跑步设计的 UI，实时显示速度、距离、卡路里等数据。
*   **智能路径规划器**: 预先规划跑步路线，支持打点和手绘模式，并能预估占领面积。
*   **离线优先架构 (PWA)**: 极速加载，支持离线使用，网络恢复后自动同步数据。
*   **成就与排行榜**: 解锁各种成就，在个人、俱乐部和省级排行榜上争夺荣耀。

## 💻 技术栈 (Tech Stack)

*   **前端**: Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript
*   **地图**: 高德地图 JS API, Turf.js, H3.js
*   **原生容器**: Capacitor 6 (iOS & Android)
*   **后端 & 数据库**: Supabase (PostgreSQL, Auth, Realtime)
*   **状态管理**: Zustand, TanStack Query (SWR)
*   **UI 组件**: Shadcn UI

## 🚀 本地开发 (Getting Started)

**环境要求:**
*   Node.js >= 20.x
*   pnpm (推荐)

**安装与启动:**

1.  **克隆仓库**
    ```bash
    git clone <repository-url>
    cd city-lord-game-interface
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **配置环境变量**
    *   复制 `.env.example` 文件为 `.env.local`。
    *   填入你的 Supabase 项目 URL, anon key, 以及高德地图 API Key。
    ```env
    # Supabase
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

    # Database URLs (for Prisma)
    DATABASE_URL="postgresql://..."
    DIRECT_URL="postgresql://..."

    # Gaode Maps API Key
    NEXT_PUBLIC_AMAP_KEY=YOUR_AMAP_KEY
    ```

4.  **生成 Prisma Client**
    *   每次修改 `prisma/schema.prisma` 后都需要执行此命令。
    ```bash
    npx prisma generate
    ```

5.  **启动开发服务器**
    ```bash
    npm run dev
    ```
    应用将运行在 `http://localhost:3000`。

## 部署 (Deployment)

项目已配置为可以部署到 Vercel 或其他支持 Next.js 的平台。

1.  **构建项目**
    ```bash
    npm run build
    ```
2.  确保所有环境变量都已在部署平台上正确配置。

## 📂 项目结构 (Project Structure)

```
/
├── app/                # Next.js App Router - 页面和路由
│   ├── (main)/         # 主应用页面
│   ├── api/            # API 路由 (Serverless Functions)
│   └── admin/          # 后台管理页面
├── components/         # React 组件
│   ├── ui/             # Shadcn UI 组件
│   ├── map/            # 地图相关组件
│   └── citylord/       # 核心游戏逻辑组件
├── hooks/              # 自定义 React Hooks
├── lib/                # 库函数和工具函数
├── prisma/             # Prisma schema 和 migrations
├── public/             # 静态资源
├── scripts/            # 辅助脚本
└── android/            # Capacitor Android 项目
```

## 📜 可用脚本 (Available Scripts)

在 `package.json` 中，你可以找到以下常用脚本：

- `npm run dev`: 启动开发服务器。
- `npm run build`: 构建生产版本。
- `npm run start`: 启动生产服务器。
- `npm run typecheck`: 运行 TypeScript 类型检查。
- `npm run lint`: 使用 ESLint 检查代码。
- `npm run android`: 为 Android 平台构建 Web 资源。

## 🤝 贡献指南 (Contributing)

我们欢迎任何形式的贡献！请遵循以下步骤：

1.  **Fork** 本仓库。
2.  创建你的特性分支 (`git checkout -b feature/AmazingFeature`)。
3.  提交你的更改 (`git commit -m 'Add some AmazingFeature'`)。
4.  推送到分支 (`git push origin feature/AmazingFeature`)。
5.  打开一个 **Pull Request**。

请确保你的代码通过了 `lint` 和 `typecheck` 检查。

---

## 📅 更新日志 (Changelog)

### 2026-02-23: 🛠️ 稳定性修复与社交功能优化

**核心更新:**

1.  **社交中心增强**:
    *   **未读提醒优化**: 将底栏未读消息计数的获取方式从客户端 `fetch` 升级为 `Server Action`，彻底解决了由远程 API 服务器跨域 (CORS) 或响应异常引起的 "Failed to fetch" 错误弹窗。
    *   **动态流稳定性**: 修复了好友动态内容在页面切换时偶尔消失的问题，实现了更稳定的数据加载与状态同步逻辑。
2.  **运行时错误修复**:
    *   **DNS 模块冲突解决**: 针对 Node 18+ 环境下 Next.js 客户端打包器尝试打包 Node 内置 `dns` 模块导致的 `Module not found` 错误，采用了动态 `eval("require")` 的绕过方案，确保了客户端构建的兼容性。
3.  **App 架构升级**:
    *   **移动端 Shell 改版**: 实现了 "远程加载 + 本地兜底" 方案。移除了强制的 `output: 'export'`，使应用能同时支持 Server Actions 和 APK 离线兜底，极大提升了混合开发的灵活性。
4.  **构建与部署优化**:
    *   **静态导出兼容性**: 优化了 `/profile/[userId]` 等多处动态路由，增加了 `Suspense` 包裹，确保项目在启用交互式 SSR 功能的同时依然兼容全静态生产构建。

---

### 2026-02-15: 🚀 性能重构与部署准备

**核心优化:**

1.  **React 性能优化**:
    *   对核心组件 `game-page-content.tsx` 进行了全面的性能重构。
    *   通过 `React.memo` 包裹所有主要子组件，并使用 `useCallback` 稳定事件处理函数，有效阻止了由高频 GPS 更新引起的非必要重渲染，确保 UI 流畅。
2.  **构建与类型修复**:
    *   解决了大量 TypeScript 类型错误，包括 `room_messages`、`user_missions` 等模型的类型推断问题。
    *   通过添加类型声明文件 (`capacitor-modules.d.ts`) 解决了 Capacitor 插件 `@capacitor/sensors` 和 `@capacitor/sound` 缺失模块的报错。
    *   修复了 `lord-center` 页面的 React Hook 条件渲染错误，确保了组件渲染的稳定性。
    *   修复了 `RankItem.tsx` 中 `User` 组件未定义的构建错误。

3.  **部署验证**:
    *   成功执行 `npm run build`，验证项目已具备部署条件。
    *   清理了 Prisma 缓存并重新生成了 Prisma Client，解决了 `EPERM` 文件权限问题。

---
*之前的更新日志...*
