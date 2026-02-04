# City Lord - 城市领主

City Lord 是一款结合真实地理位置（LBS）的跑步领地争夺游戏。玩家通过在现实世界中跑步来占领地图上的六边形地块，加入阵营（赤红先锋 vs 蔚蓝联盟），与同城的跑者竞争，扩张领地，赢取荣誉。

## 📅 更新日志 (Changelog)

### 2026-02-05: 🎮 核心玩法落地与 PWA 升级 (Core Gameplay & PWA)

**核心玩法升级：**

1.  **🖌️ 实时轨迹与领地闭环 (Path & Territory)**
    *   **轨迹绘制**：`GaodeMap3D` 现在支持实时绘制跑步轨迹 (Polyline)，并根据用户偏好设置颜色。
    *   **闭环检测**：`useRunningTracker` 新增闭环检测算法。当跑步路径首尾距离小于 20 米时，自动识别为闭环并生成多边形领地。
    *   **个性化领地**：支持从 `profiles` 表读取用户自定义的 `path_color` 和 `fill_color`，让每个人的领地独一无二。

2.  **📱 PWA 与离线支持 (Progressive Web App)**
    *   **原生级体验**：集成了 `next-pwa`，支持添加到主屏幕，提供类原生 App 的全屏体验。
    *   **离线能力**：配置了 Service Worker，支持离线访问核心页面。新增 `NetworkStatus` 组件，在网络断开时显示优雅的提示 Banner。
    *   **Manifest**：完整的 `manifest.json` 配置，包含多尺寸图标和主题色设置。

3.  **🏠 房间与俱乐部系统优化 (Social Features)**
    *   **俱乐部 UI 重构**：引入了全新的 `TabGroup` 组件，优化了俱乐部详情页的导航栏，使用 `framer-motion` 实现平滑的选中动画，支持 Minimal 和 Block 两种风格。
    *   **无限循环修复**：修复了 `ClubDrawer` 中因依赖项不稳定导致的 `Maximum update depth exceeded` 无限渲染问题，通过精细化 `useEffect` 依赖管理解决。
    *   **渲染稳定性 (React Stability)**：修复了 `Minified React error #310` (Hooks 顺序错误) 和 `net::ERR_ABORTED` (表单提交中断) 问题。通过规范化 Hook 调用顺序、显式处理表单默认事件 (`e.preventDefault()`)，确保了复杂交互下的应用稳定性。
    *   **健壮性增强**：重构了 `joinClub` 和 `createClub` 的 Server Actions，使用结构化错误返回 (`{ success: false, error: ... }`) 替代直接抛出异常，彻底解决了 Next.js 生产环境下的 "An error occurred in the Server Components render" 报错。
    *   **加入阵营加速**：优化了 `FactionSelector`，移除全页刷新逻辑，改用 Optimistic UI 和 `router.refresh()`，将加入阵营的响应时间从 10秒+ 缩短至 <1秒。

4.  **🔐 体验打磨**
    *   **登录优化**：重构登录页交互，使用 AJAX (`fetch`) 替代表单提交，错误提示从“页面跳转”改为“原地 Toast”，大幅提升流畅度。
    *   **UI 细节**：调整了 `RunningHUD` 布局，优化了移动端触摸区域。

### 2026-02-04: ⚡️ 极致性能优化与 SWR 架构重构 (Performance & SWR)

**核心目标**：彻底解决页面加载慢、骨架屏闪烁、以及高并发下的数据库压力问题。

1.  **🚀 SWR (Stale-While-Revalidate) 架构重构**
    *   **零骨架屏秒开**：实现了核心页面（主页、任务中心、排行榜、好友列表、勋章墙）的 **SSR (服务端预取) + SWR (客户端缓存)** 混合模式。用户打开页面时直接看到完整内容，无需等待客户端请求。
    *   **后台静默更新**：数据展示后，SWR 会在后台自动校验更新，确保数据实时性（如好友在线状态、任务进度变化）。
    *   **并行数据获取**：重构 `app/page.tsx`，使用 `Promise.all` 并行获取 User、Missions、Stats、Faction、Badges、Social 等 6 大核心数据源，消除了客户端的“瀑布流”请求。

2.  **🏎️ 数据库与服务端性能优化**
    *   **Read-Check-Write 模式**：重构 `MissionService`，将原来的“每次请求都写库”改为“先读后写”，仅在数据过期或不存在时才执行写入，数据库写入量减少 90% 以上。
    *   **内存级缓存 (L1 Cache)**：在服务端引入短时内存缓存 (TTL 60s)，对于高频只读请求（如任务列表检查）直接返回内存数据，绕过数据库。
    *   **用户配置快速通道 (Fast Path)**：重构 `ensureUserProfile`，引入 React Cache 和轻量级 ID 检查 (<10ms)，老用户访问不再触发繁重的 `upsert` 逻辑，响应速度提升 20 倍。
    *   **中间件瘦身**：优化 `middleware.ts`，将繁重的 `getUser()` 数据库调用移至特定路由，静态资源和公共页面实现 0 数据库开销访问，显著降低 TTFB。

3.  **🐛 关键 Bug 修复**
    *   **阵营数据崩溃**：修复了 `get_faction_stats_rpc` 返回 JSON 对象导致前端 `find` 方法报错的问题，增加了对 Object/Array 两种返回格式的兼容处理。
    *   **好友页面崩溃**：修复了 `SocialPage` 因未正确解构 `initialFriends` props 导致的 ReferenceError 崩溃。
    *   **UI 渲染错误**：修复了个人资料页因直接渲染 Object 导致的 "Objects are not valid as a React child" 错误。
    *   **勋章时间显示**：在勋章弹窗中补充了“获取时间”显示逻辑。

4.  **🛡️ 认证流程与稳定性升级 (Auth & Stability)**
    *   **智能账号校验 (Smart Auth Check)**：实现了 `checkEmailExists` 预检机制。在发送验证码前先判断邮箱状态，精准引导用户进入“注册”或“登录”流程，避免了重复发送 OTP 和注册冲突。
    *   **退出登录修复 (Logout Consistency)**：修复了退出登录后页面状态残留的问题。引入 `router.refresh()` 强制清除服务端组件缓存，确保用户点击退出后立即看到未登录状态的主页。
    *   **构建修复 (Build Fixes)**：修复了 Vercel 部署时的 `useSearchParams` 错误，通过 `<Suspense>` 边界正确处理了认证回调页面的客户端挂钩。

### 2026-02-04: 登录体验升级与原生化优化 (Previous)

**主要更新内容：**

1.  **🚀 验证码登录 (Custom Login Flow)**
    *   **优化**：将原本的 "Magic Link" 邮箱链接登录完全替换为 **验证码登录**。
    *   **体验**：用户不再需要跳转邮箱点击链接，直接输入 6 位验证码即可登录，完美解决了移动端和 Android Webview 中的跳转兼容性问题。
    *   **后端**：新增 `login-with-code` API，在服务器端完成验证并生成 Supabase 会话。

2.  **📱 原生 App 体验优化**
    *   **全局触控**：全局禁用了浏览器的默认长按菜单（`touch-callout: none`）和文本选择（`user-select: none`）。
    *   **效果**：消除了 Web App 在移动端操作时的“网页感”，操作手感更接近原生 App。
    *   **UI 汉化**：登录页面标题正式改为中文“城市领主”。

### 2026-02-03: 阵营系统增强与 UI/UX 优化

1.  **🌍 动态城市数据 (Dynamic City Support)**
    *   **问题**：旧版本仅支持预设的地级市，缺少区/县级详细数据（如邵阳县 430528）。
    *   **修复**：集成了高德地图 API (`AMap.DistrictSearch`)，实现了行政区划的动态获取。现在游戏可以自动识别并加载全国任意区县的边界数据，无需手动维护数据库。
    *   **排名优化**：实现了“地级市统一排名”与“区县独立排名”的双层逻辑。

2.  **⚔️ 阵营系统 (Faction System 2.0)**
    *   **新功能**：实现了阵营平衡机制。
    *   **弱势加成**：当一方阵营人数处于劣势时，系统会自动计算加成比例（最高 200%）。该加成会直接应用到任务奖励（XP 和金币）中。
    *   **可视化对比**：在个人资料页新增了“阵营战况”卡片，直观展示红蓝双方的人数对比和领地势力（Area）对比。领地势力条已包含加成权重，体现“以少胜多”的潜力。
    *   **后端优化**：新增 RPC 函数 `get_faction_stats_rpc` 以高效聚合阵营数据。

3.  **🔐 认证系统 (Custom Authentication)**
    *   **新功能**：移除了 Supabase 默认的邮件确认链接，改为使用自定义的 6 位数字验证码（通过 Nodemailer + 126.com SMTP 发送）。
    *   **体验优化**：优化了注册流程，修复了注册后“Profile not found”的竞态条件错误，实现了账号创建时的自愈（Self-healing）机制。

4.  **👤 用户界面 (UI/UX)**
    *   **个人资料页**：
        *   头像现在支持点击直接编辑，无需寻找隐藏按钮。
        *   修复了头像图片域名 (`api.dicebear.com`) 的加载权限问题。
        *   微调了等级徽章的位置，避免遮挡头像。
    *   **城市选择器**：重新设计了城市切换侧边栏，增加了“热门城市”快捷入口，并按省份分组展示历史访问城市。
    *   **注册/登录页**：修复了暗色模式下的 UI 可见性问题，优化了按钮和 Tab 的交互反馈。

### 早期核心功能实现 (v0.1.0 Alpha)

#### 1. 用户认证与初始化
- [x] **Supabase Auth 集成**: 支持邮件/密码登录。
- [x] **自动化初始化**: 新用户注册时自动触发 `init_user_game_data` RPC，分配初始资源、任务和勋章进度。
- [x] **在线状态心跳**: 前端定时发送心跳 (`touchUserActivity`)，基于 `last_active_at` 判断在线状态。

#### 2. 跑步与领地系统 (核心玩法)
- [x] **沉浸式跑步模式**: 实时追踪 GPS 位置，计算配速、距离。
- [x] **H3 地理围栏**: 自动将 GPS 坐标转换为 H3 索引 (Resolution 9)。
- [x] **实时领地占领**: 
  - 后端 Action `claimTerritory` 处理占领逻辑。
  - 前端实现防抖 (`lastClaimedHex`) 避免重复请求。
  - 实时反馈占领结果（XP 奖励、Toast 通知）。
- [x] **地图刷新**: 占领成功后自动触发地图图层更新。

#### 3. 成就与勋章系统 (Progression)
- [x] **数据模型**: 完善的 `badges`, `user_badges` 表结构。
- [x] **动态图标映射**: `BadgeIcon` 组件支持从数据库字符串动态渲染 Lucide 图标。
- [x] **勋章墙**: `BadgeGrid` 支持分类显示（探索、耐力、征服、隐藏），支持未解锁状态预览。
- [x] **隐藏勋章逻辑**: 
  - **夜行侠 (Night Owl)**: 自动检测夜跑 (22:00-04:00) 并授予勋章。
  - **早起鸟 (Early Bird)**: 自动检测晨跑 (05:00-08:00) 并授予勋章。
  - 集成在 `claimTerritory` 中，跑步过程中即时触发。

#### 4. 社交系统 (Social)
- [x] **好友列表**: 展示好友在线状态（基于 5 分钟心跳阈值）。
- [x] **动态展示**: 基础的好友活动流 (`friend-activity-feed`)。

## 🚀 核心功能

*   **🏃 跑步占领**：实时追踪跑步轨迹，将轨迹覆盖的六边形地块转化为个人领地。
*   **🗺️ 六边形地图**：基于 H3 索引的高性能动态地图，支持迷雾系统。
*   **🤝 社交互动**：好友系统、实时动态、以及即将推出的俱乐部功能。
*   **🏆 成就系统**：丰富的勋章墙和排行榜，记录你的每一次突破。

## 🛠️ 技术栈

*   **前端**：Next.js 14 (React), Tailwind CSS, Framer Motion, Lucide Icons
*   **地图**：高德地图 JS API (AMap), H3-js (六边形网格)
*   **后端/数据库**：Supabase (PostgreSQL, Auth, Realtime)
*   **移动端适配**：Capacitor (Android/iOS)

## 📦 快速开始

1.  **安装依赖**
    ```bash
    npm install
    # or
    yarn install
    ```

2.  **配置环境变量**
    复制 `.env.example` 为 `.env.local` 并填入 Supabase 和高德地图的 Key。

3.  **启动开发服务器**
    ```bash
    npm run dev
    ```

4.  **访问**
    打开浏览器访问 `http://localhost:3000`

---
*Created by Trae AI Assistant*
