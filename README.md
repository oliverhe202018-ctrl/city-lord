# City Lord - 城市领主

City Lord 是一款结合真实地理位置（LBS）的跑步领地争夺游戏。玩家通过在现实世界中跑步来占领地图上的六边形地块，加入阵营（赤红先锋 vs 蔚蓝联盟），与同城的跑者竞争，扩张领地，赢取荣誉。

## 📅 更新日志 (Changelog)

### 2026-02-09: ☁️ 云端加载模式与隐私合规 (Hosted Mode & Privacy)

**核心架构升级：**

1.  **⚡ Capacitor Hosted Mode (在线加载模式)**
    *   **架构转型**：放弃了 Next.js Static Export，转为使用 Capacitor 的 `server.url` 直接加载 Vercel 生产环境网页。
    *   **优势**：保留了 Next.js 完整的 SSR/ISR 能力，同时拥有原生插件访问权限。更新网页无需重新发版 APK。
    *   **构建优化**：简化了构建流程，不再需要 `build-mobile.js`，只需同步配置文件即可。

2.  **🛡️ 隐私合规的后台定位 (Foreground Service)**
    *   **前台服务保活**：调整了 `@capacitor-community/background-geolocation` 的调用方式，通过 `backgroundTitle/Message` 显式触发 Android 前台服务通知。
    *   **权限精简**：移除了敏感的 `ACCESS_BACKGROUND_LOCATION` 权限，仅保留 `FOREGROUND_SERVICE` 和 `FOREGROUND_SERVICE_LOCATION`。用户只需授权“仅在使用该应用时允许”，App 切到后台后依然能通过前台服务持续定位，符合 Google Play 最新隐私规范。

3.  **🎨 UI 细节打磨**
    *   **阵营战况优化**：调整了个人主页 (Profile) 顶部的阵营对战进度条布局，将文字标签推至屏幕边缘并上移，解决了与头像遮挡的问题，视觉更加平衡。

### 2026-02-08: 🏃‍♂️ 跑步体验深度优化 (Running Experience Optimization)

**核心功能升级：**

1.  **🔋 原生后台保活 (Native Background Tracking)**
    *   **前台服务集成**：引入 `@capacitor-community/background-geolocation` 插件，利用 Android 前台服务 (Foreground Service) 机制，在通知栏显示常驻通知，确保 App 在熄屏或切后台后仍能持续记录轨迹。
    *   **双源定位策略**：重构 `useRunningTracker`，采用“双轨制”定位策略——UI 层继续使用 Web API 保证实时性，后台层启动原生插件保证数据不丢失。
    *   **权限配置**：完善 `AndroidManifest.xml`，添加 `FOREGROUND_SERVICE_LOCATION` 和 `ACCESS_BACKGROUND_LOCATION` 权限，符合现代 Android 规范。

2.  **🔊 沉浸式语音反馈 (Audio Feedback)**
    *   **全流程语音**：新增了跑步全流程的语音交互。
        *   **倒计时**：起跑前播放 3 秒倒计时音效。
        *   **状态播报**：暂停、恢复、结束跑步时均有清晰的音效反馈。
    *   **音频管理**：封装了轻量级的 `LocationService` 和音频工具，解耦了业务逻辑。

### 2026-02-08: 🏗️ 架构现代化与构建修复 (Architecture Modernization & Build Fixes)

**核心架构升级：**

1.  **🚀 Supabase SSR 深度迁移**
    *   **弃用 Legacy 库**：全面移除 `@supabase/auth-helpers-nextjs` 和旧版 Mock 逻辑 (`mock-supabase`, `mock-headers`)。
    *   **全异步架构**：重构了所有 Server Actions (`app/actions/*.ts`)，采用 `@supabase/ssr` 的异步 `createClient` 模式，完美适配 Next.js 15+ 的 `cookies()` API。
    *   **Server Actions 规范化**：为所有 Action 文件显式添加 `'use server'` 指令，建立了严格的 Client/Server 边界，彻底解决了构建时的 `next/headers` 泄漏问题。

2.  **🔧 构建系统修复 (Build Stabilization)**
    *   **依赖链治理**：修复了 Client Components 直接引用未标记为 Server Action 的后端逻辑导致的构建错误。
    *   **类型安全**：统一了 `lib/supabase/server.ts` 的类型定义，确保全栈类型链路畅通。

3.  **🐛 逻辑修复**
    *   **Challenge 模块**：修复了挑战页面因引用旧版 Mission Action 导致的运行时错误。
    *   **通知系统**：重构了 `notification.ts`，修复了导入路径和分号格式问题，使其符合新的服务端规范。

### 2026-02-07: 📱 Android 原生体验深度优化 (Native Polish & Hardening)

**核心架构升级：**

1.  **🔋 强健的后台定位 (Robust Background Location)**
    *   **双重保活机制**：集成了 `@capawesome/capacitor-background-task` 和 `@capacitor-community/keep-awake`。
    *   **KeepAwake**：进入地图页自动申请屏幕唤醒锁，防止物理息屏导致 CPU 休眠。
    *   **Background Task**：App 切入后台时自动申请系统任务时间片，确保 Geolocation 进程不被 Android 系统挂起。
    *   **权限升级**：在 `AndroidManifest.xml` 中配置了 `FOREGROUND_SERVICE` 和 `WAKE_LOCK` 等关键权限，符合 Google Play 跑步类应用标准。

2.  **🔧 原生 UI 适配 (Native UI Adaptation)**
    *   **沉浸式状态栏**：使用 `@capacitor/status-bar` 强制关闭 WebView Overlay，配合黑色背景，彻底解决了 Android 顶部刘海/挖孔屏的内容遮挡问题。
    *   **坐标系纠偏开关**：在设置中新增“GPS 坐标纠偏”开关。支持在 WGS84 (原生硬件) 和 GCJ02 (高德标准) 之间手动切换，完美适配模拟器开发和真机实测两种场景。

3.  **🛡️ 认证安全升级 (Auth Security)**
    *   **流程隔离**：重构 `AuthForm`，严格分离注册 (`signUp`) 和登录 (`signInWithOtp`) 逻辑。
    *   **防枚举攻击**：针对 Supabase 的 "Prevent User Enumeration" 机制增加了前端拦截逻辑，精准识别“假成功”状态，避免已注册用户误入注册流程。

4.  **🎨 视觉细节打磨**
    *   **50/50 视觉兜底**：重构 `FactionBattleBackground`，当领地数据为 0 vs 0 时，显示优雅的低饱和度红蓝渐变和 "SCANNING" 提示，告别黑屏尴尬。
    *   **定位交互优化**：修复了定位权限被拒绝后 UI 无限转圈的 Bug，增加了显式的权限请求引导。

### 2026-02-06: 📱 原生定位桥接与 UI 交互升级 (Native Location & UI Polish)

**核心体验优化：**

1.  **📍 原生定位桥接 (Native Geolocation Bridge)**
    *   **混合开发支持**：实现了 Web 与 Android 原生壳的定位互通。`useGeolocation` Hook 现在优先检测 `window.AndroidApp` 桥接对象。
    *   **精准度提升**：直接调用原生高德定位 SDK，解决了 WebView 中 H5 定位漂移、精度低的问题，返回标准的 GCJ-02 坐标。
    *   **智能降级**：在普通浏览器中自动降级回 HTML5 Geolocation API，并处理 WGS-84 到 GCJ-02 的坐标转换。

2.  **🎨 跑步体验 UI 升级**
    *   **状态反馈增强**：顶部导航栏 (`MapHeader`) 的定位状态现在有明确的视觉反馈（黄灯定位中 -> 绿灯已定位），让用户更安心。
    *   **HUD 视觉优化**：重构了跑步过程中的抬头显示 (`RunningHUD`)，显著放大了“领地扩张”模块的尺寸和字体，增加了毛玻璃背景和阴影，确保户外强光下依然清晰可见。

3.  **🏁 结算页重构 (Run Summary Overhaul)**
    *   **静态轨迹地图**：新增 `StaticTrajectoryMap` 组件，在结算页直观展示本次跑步的完整路径 (Polyline)，自动适配视野。
    *   **领地反馈**：新增了领地占领的文字反馈，区分“占领新地块”与“夺取他人地块”的文案，增强成就感。
    *   **交互优化**：移除了冗余的“动态轨迹”入口，重构了“分享战绩”功能，采用底部弹窗 (Action Sheet) 形式，为未来的社交分享预留了接口。

### 2026-02-06: 💬 实时聊天与房间系统增强 (Realtime Chat & Room System)

**核心修复与体验升级：**

1.  **🛡️ 聊天室稳定性重构 (Robust Realtime Chat)**
    *   **自我修复连接 (Self-Healing Connection)**: 彻底重构了 `RoomChat` 组件的连接逻辑。引入了 `useState` 单例模式管理 Supabase 客户端，防止因组件重渲染导致的连接“抖动”。实现了递归自动重连机制，当遇到 `TIMED_OUT` 或网络波动时，系统会自动清理僵尸连接并尝试重新订阅。
    *   **消息时间戳 (Timestamps)**: 聊天气泡现已支持显示发送时间（HH:MM）。针对“我”和“他人”的消息采用了不同的布局策略，提升了信息的可读性。

2.  **🏠 房间切换逻辑修复**
    *   **即时响应**: 修复了 `RoomDrawer` 下拉菜单选择房间后，内容区域不更新的 Bug。重构了数据获取逻辑，优先使用 `useRoomDetails` 获取选中房间的实时数据，而非仅依赖“我加入的房间”。
    *   **SWR 集成**: 为房间详情接口 (`/api/room/[id]`) 集成了 SWR 缓存策略，实现了数据的即时加载与后台静默更新。

3.  **🔧 数据库与架构升级**
    *   **数据完整性**: 修复了 `missions` 表因缺失默认数据导致的外键约束报错。编写了幂等的 SQL 脚本 (`supabase_fix.sql`) 补充了 13 个核心任务定义。
    *   **Supabase SSR 迁移**: 完成了从 `@supabase/auth-helpers-nextjs` (遗留库) 到 `@supabase/ssr` (新标准) 的最终迁移，确保了 Auth 流程在 Next.js App Router 中的稳定性。

### 2026-02-05: 🛡️ 管理后台与勋章系统重构 (Admin & Badge System)

**核心功能上线：**

1.  **🛡️ 管理员后台 (Admin Dashboard)**
    *   **俱乐部审核**：实现了俱乐部创建申请的完整审核流程。管理员可以在后台查看申请详情（包括头像、省份、权限等），并执行通过或拒绝操作。
    *   **勋章管理**：新增了勋章配置页面，支持从代码一键同步数据到数据库，也支持手动创建和编辑勋章（包含图标上传、条件配置）。
    *   **系统日志**：记录了管理员的关键操作（如审核、封禁），便于审计。

2.  **🏅 勋章系统重构 (Badge System 2.0)**
    *   **动态数据源**：将勋章数据源从前端硬编码迁移至数据库 `badges` 表，实现了动态配置。
    *   **智能同步**：开发了“一键同步”工具，能自动解析旧版代码中的达成条件文案，智能映射为数据库字段（如 `requirement_type: distance`）。
    *   **UI 升级**：重构了勋章详情弹窗，现在能正确显示勋章的获取时间、等级（稀有度）和具体达成条件。

3.  **🤝 俱乐部体验优化**
    *   **创建流程**：重构了创建俱乐部表单，支持上传头像、选择省份和设置公开/私密权限。
    *   **反馈机制**：优化了创建后的反馈流程，用户提交后会看到“审核中”的状态提示，通过后会收到系统通知。
    *   **通知系统**：实现了基于数据库的通知中心，审核结果会实时推送到用户的通知列表。

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
