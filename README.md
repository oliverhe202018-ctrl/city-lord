# City Lord - 城市领主

City Lord 是一款结合真实地理位置（LBS）的跑步领地争夺游戏。玩家通过在现实世界中跑步来占领地图上的六边形地块，加入阵营（赤红先锋 vs 蔚蓝联盟），与同城的跑者竞争，扩张领地，赢取荣誉。

## 📅 更新日志 (Changelog)

### 2026-02-13: 🏃‍♂️ 跑步模式重构与体验优化 (Running Mode & UX Polish)

**核心体验升级：**

1.  **🗺️ 沉浸式跑步模式 (Immersive Running Mode)**
    *   **独立渲染**: 重构了跑步模式的地图渲染逻辑，进入跑步状态时自动卸载主地图，彻底解决了“双重标记”和性能损耗问题。
    *   **操作优化**: 新增“双击暂停/结束”快捷操作，提升运动中的交互效率。
    *   **视觉降噪**: 移除了 GPS 信号图标的呼吸动画，保持界面清爽专注。
    *   **定位修复**: 修复了手动/自动定位同步逻辑，解决了进入跑步模式后地图中心不跟随的问题。

2.  **📍 地图状态记忆 (Map State Persistence)**
    *   **位置缓存**: 实现了“最后已知位置”缓存功能。App 启动时优先加载上一次的地图中心点和缩放级别，告别了每次启动都先跳回北京再定位的突兀体验。
    *   **智能初始化**: 仅在无缓存或首次安装时使用默认坐标，大幅提升冷启动流畅度。

3.  **🛡️ 系统稳定性 (Stability)**
    *   **Auth 容错**: 增强了 Supabase 客户端初始化逻辑，增加了环境变量完整性校验和 Key 格式检查。
    *   **网络鲁棒性**: 为 Auth Hook 添加了全局错误捕获，在网络波动或配置错误时提供友好的控制台提示，防止应用白屏。

### 2026-02-13: 🛠️ 数据库架构优化与性能修复 (Database Optimization)

**核心架构升级：**

1.  **🚀 性能飞跃 (Performance Boost)**
    *   **缓存优先策略**: 重构 `getFactionStats` 接口，引入“快照优先 + 3秒熔断”机制。优先读取 `DailyStat` 快照表，仅在快照缺失时降级为实时计算，并自动回写快照，彻底解决了阵营战况加载超时（10s+）的问题。
    *   **Prisma 权限隔离**: 重写 `schema.prisma`，移除所有对 Supabase 系统表（`auth.users`）的直接关联，改为松耦合的 ID 引用，消除了 `EPERM` 和跨 Schema 权限校验错误。

2.  **🎨 UI/UX 优化**
    *   **战况展示**: 优化了个人主页的阵营战况卡片，移除冗余的“昨日战况”独立模块，将昨日数据智能整合进主卡片标题栏，界面更清爽。
    *   **数据可视化**: 优化了进度条与数字展示逻辑，确保在极端数据（如 0 vs 0）下 UI 依然优雅。

3.  **🔧 构建与部署 (Build & Deploy)**
    *   **Android 适配**: 完善了 `capacitor.config.ts` 配置，确保 Android Scheme 正确指向 HTTPS，为打包发布做好准备。
    *   **依赖清理**: 清理了不必要的 Prisma 生成文件，修复了 Windows 环境下的文件占用锁死问题。

### 2026-02-12: 🏢 俱乐部系统全面重构 (Club System Overhaul)

**核心架构升级：**

1.  **🚀 性能飞跃 (Performance Boost)**
    *   **服务端缓存**: 引入 Next.js `unstable_cache`，将俱乐部详情查询（`getClubDetailsCached`）缓存 1 小时，配合 Tag Revalidation 实现“秒开”体验。
    *   **SQL 视图优化**: 创建 `v_clubs_summary` 数据库视图，预聚合成员数、总面积等高频字段，彻底告别实时遍历计算，查询延迟从 5s+ 降至 50ms。
    *   **前端 SWR 集成**: 详情页采用 `useSWR` + Server Action 混合模式，利用客户端缓存实现无感加载与自动更新。

2.  **🔗 智能路由与状态管理 (Smart Routing & State)**
    *   **自动跳转逻辑**: 完善了“加入俱乐部”全流程。申请成功后，系统自动更新 Zustand 全局状态并无缝跳转至俱乐部详情页。
    *   **路由守卫**: 重构 `/club` 路由入口，智能判断用户状态（Pending/Active/None），自动分流至详情页或发现列表，并具备自动修复数据一致性（Self-healing）能力。
    *   **数据库触发器**: 部署 PostgreSQL 触发器，在 `club_members` 状态变更时自动同步 `profiles.club_id`，从数据库层面保障数据绝对一致。

3.  **🐛 关键修复 (Critical Fixes)**
    *   **导航闭环**: 修复了“退出俱乐部后仍停留在详情页”及“关闭详情页后无法返回列表”的导航 Bug。
    *   **API 稳定性**: 解决了 Server Action 中 `cookies()` 调用与缓存上下文冲突的问题，改用 Service Role Client 确保后台任务稳定性。
    *   **地理编码容错**: 优化 `useReverseGeocode` Hook，优雅处理海洋等无地址区域（`no_data`），消除控制台红字报错。

### 2026-02-10: 🗺️ 智能路径规划器 (Smart Route Planner)

**核心功能上线：**

1.  **🧠 全屏沉浸式规划 (Immersive Planner)**
    *   **独立页面**: 全新的 `/game/planner` 全屏页面，提供更大的视野和更专业的操作空间。
    *   **自动定位**: 进入页面自动定位到用户当前位置，并切换至高精度地图模式。

2.  **✍️ 双模式绘图 (Dual-Mode Drawing)**
    *   **Waypoints (打点模式)**: 点击地图添加关键点，系统自动连线，适合长距离规划。
    *   **Freehand (手绘模式)**: 自由拖拽绘制复杂轨迹，松手自动切回打点模式，防止误操作。
    *   **手势防冲突**: 绘图模式下智能锁定地图拖拽，确保线条流畅。

3.  **⚡ 智能辅助 (Smart Assists)**
    *   **Snap to Road (路网吸附)**: (Beta) 支持将路径自动吸附至真实道路网。
    *   **Loop Closure (智能闭环)**: 当终点距离起点 <50m 时，自动识别闭环并高亮显示领地范围。
    *   **Real-time Stats (实时数据)**: 顶部 HUD 实时显示路径总里程 (km) 和预计占领面积 (ha)。

4.  **💾 路线管理闭环 (Save & Manage)**
    *   **保存与编辑**: 支持保存规划好的路线，自定义命名。
    *   **我的路线**: 侧边栏管理所有历史路线，支持预览、删除和**二次编辑**。
    *   **一键开跑**: 从列表直接加载路线并跳转至跑步模式 (Runner)。

5.  **🎓 新手引导 (Onboarding)**
    *   **聚光灯教程**: 首次进入自动触发分步引导，通过 Spotlight 效果高亮核心功能区。
    *   **交互式学习**: 引导用户亲自尝试打点、绘图和保存操作。

### 2026-02-10: 🚀 发布前终极体检与推送增强 (Pre-Release Health Check & Push Notification)

**核心系统加固：**

1.  **🔔 双轨制推送系统 (Hybrid Push Notification)**
    *   **China-Ready**: 针对中国大陆环境，实现了 FCM (OneSignal) 与 Supabase Realtime + Local Notifications 的双轨制推送。
    *   **机制**: 当 FCM 不可用时，App 自动监听数据库变化，并在本地触发原生通知，确保“被攻击”、“战斗结算”等关键信息必达。
    *   **容错**: OneSignal 初始化逻辑增加 `try-catch` 保护，防止在无 GMS 设备上闪退。

2.  **🛡️ 系统稳定性 (System Stability)**
    *   **防崩溃**: 全局扫描并修复了数组访问越界风险 (unsafe `.length` access)，彻底根除运行时白屏隐患。
    *   **交互安全**: 修复了“结束跑步”按钮在音频加载失败时无法响应的问题（改为非阻塞式调用）。
    *   **UI 适配**: 优化了俱乐部列表等页面的最小高度和图片适配，防止键盘遮挡和图片变形。

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

## 🚀 技术栈 (Tech Stack)

*   **Frontend**: Next.js 16 (React 19, Turbopack)
*   **Styling**: Tailwind CSS v4
*   **Mobile**: Capacitor 6 (Android)
*   **Database**: Supabase (PostgreSQL) + Prisma ORM
*   **Map**: AMap (高德地图) + Turf.js (Geospatial Analysis) + H3 (Hexagonal Grid)
*   **State Management**: Zustand + SWR
*   **Auth**: Supabase Auth (OAuth + Email)

## 🛠️ 本地开发 (Local Development)

### 1. 环境准备
确保已安装 Node.js 18+ 和 pnpm。

### 2. 环境变量
复制 `.env.example` 为 `.env.local` 并填入 Supabase 和高德地图 API Key。

### 3. 安装依赖
```bash
pnpm install
```

### 4. 启动开发服务器
```bash
pnpm dev
```

## 📱 移动端构建 (Mobile Build)

本项目采用 **Hosted Mode** (在线加载模式)，核心业务逻辑运行在远程服务器上，本地 APK 仅作为壳容器提供原生能力。

### 1. 同步配置
确保 `capacitor.config.ts` 中的 `server.url` 指向你的生产环境地址。

```bash
npx cap sync android
```

### 2. 打开 Android Studio
```bash
npx cap open android
```

### 3. 打包 APK
在 Android Studio 中点击 `Build > Build Bundle(s) / APK(s) > Build APK(s)`。

---

> © 2026 City Lord Team. All rights reserved.
