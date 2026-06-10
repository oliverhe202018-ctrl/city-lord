<div align="center">
  <h1>🏃‍♂️ City Lord - 城市领主</h1>
  <p><b>基于 LBS 与真实地理位置的跑步领地争夺与社交网络游戏</b></p>
</div>

<br/>

City Lord 是一款结合真实地理位置（LBS）的跑步领地争夺游戏。玩家通过在现实世界中跑步来占领地图上的六边形地块，加入阵营（赤红先锋 vs 蔚蓝联盟），与同城的跑者竞争，扩张领地，赢取荣誉。平台不仅提供硬核的运动数据记录，更构建了丰富同城运动社交圈层。

---

## ✨ 核心特性 (Features)

### 🌍 LBS 领地争夺
*   **实时地理位置追踪**: 基于高德地图与 GPS，精准追踪用户跑步闭环路径。
*   **领地机制**: 在地图上绘制闭环多边形来占领领地，基于 Turf.js 与 PostGIS 的空间算子完成面积、重叠与对抗判定。
*   **阵营对抗**: 玩家需加入「赤红先锋」或「蔚蓝联盟」，参与城市级别的跨阵营据点实时争夺战。

### 💬 运动社交网络 (Social Hub)
*   **动态圈 (Feed)**: 分享跑步记录、带图动态，支持点赞、评论与违规举报。
*   **实时聊天 (Real-time Chat)**: 原生级体验的 1v1 私聊及俱乐部群聊。支持文本、图片、以及**高清语音对讲**，并实现平滑的滚动与安全边界限制。
*   **俱乐部系统**: 组建本地跑团！创建或加入俱乐部，与伙伴共同开黑，参与俱乐部排行榜结算。

### 🛡️ 硬核跑步系统
*   **沉浸式运动模式**: 专为高频奔跑设计的 UI 链路；实时展示配速、距离、时间及卡路里消耗。
*   **反作弊与容灾断线重连**: 严格的后台停跑防误触逻辑，并配置了数据本地暂存重试（Recovery Flow），即使在网络死角也能保障跑者数据不丢失。
*   **智能路径规划**: 支持预先制图、路线打点和手绘模式，并支持计算闭环预估面积。

### ⚙️ 后台管理 (Admin Panel)
*   **全栈管理控制台**: 高级后台授权隔离（基于 WebCrypto 强签名 Token），一键管理积分商城物资、全局地图背景。
*   **双源举报聚合系统**: 将普通建议反馈与动态圈违规举报进行安全聚合，附带证据链追踪，支持运营执行「确认违规」或「驳回误报」等一键状态流转操作。

### 📶 架构与性能
*   **离线优先 (PWA / Capacitor)**: 极速加载，原生外壳（iOS/Android），支持离线访问与状态管理。
*   **全系统推送**: 深度集成极光推送 (Aurora Push)，实现离线应用拉起与实时消息触达。
*   **架构稳固化 (Reliability)**: 
    *   **Server Component 架构**: 根布局静态化，提升 SEO 与首屏注入可靠性。
    *   **水化防御 (Hydration Guard)**: Zustand 存储层内置崩溃自愈机制，拦截非法缓存。
    *   **几何安全判定**: 后端结算内置 Turf.js 拓扑校验，自动修复非法闭环路径。

---

## 💻 技术栈 (Tech Stack)

*   **前端框架**: Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript
*   **地图与算法**: 高德地图 JS API, Turf.js, PostGIS
*   **原生容器层**: Capacitor 6 (构建 iOS & Android 原生 App)
*   **后端 & 数据库**: Supabase (PostgreSQL, Auth, Storage, Realtime)
*   **ORM 工具**: Prisma
*   **状态与数据流**: Zustand, TanStack Query (SWR)
*   **UI / 特效组件**: Shadcn UI, Framer Motion, Lucide Icons

---

## 🚀 本地开发 (Getting Started)

**环境要求:**
*   Node.js >= 20.x
*   pnpm (推荐) 或 npm/yarn

### 1. 安装与启动
```bash
git clone <repository-url>
cd city-lord-game-interface
npm install
```

### 2. 环境变量配置
复制 `.env.example` 文件并重命名为 `.env.local`。填入以下核心密钥：
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Supabase Auth Secret (用于后台身份签名校验)
ADMIN_SESSION_SECRET=YOUR_COMPLEX_SECRET_STRING

# Database URLs (for Prisma)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# 高德地图 API Key
NEXT_PUBLIC_AMAP_KEY=YOUR_AMAP_KEY

# 极光推送 Aurora / JPush (如需测试推送)
JPUSH_APP_KEY=YOUR_JPUSH_KEY
JPUSH_MASTER_SECRET=YOUR_JPUSH_SECRET
```

### 3. Prisma 与 数据库初始化
每次更新 `prisma/schema.prisma` 后需执行：
```bash
npx prisma generate
```
> **⚠️ 重点注意**: 本项目采用了高性能的偏函数索引 (Partial Indexes) 优化信息流查询。新建环境时必须手动执行补充 SQL：
> `npx prisma db execute --file prisma/migrations/add_posts_friends_feed_index.sql --url <YOUR_DIRECT_URL>`

### 4. 运行
```bash
npm run dev
# 服务将运行于 http://localhost:3000
```

### 5. 常用质量校验命令
```bash
# 类型检查
npm run type-check

# ESLint 检查
npm run lint

# 全量质量校验（类型、Lint、标志位与 ts-expect-error 预算）
npm run verify:quality

# 单元测试
npm test
```

---

## 📂 项目结构 (Project Structure)

```text
/
├── app/                  # Next.js App Router (前后端路由与 Server Actions)
│   ├── (main)/           # C端：地图、聊天、排行榜、个人中心
│   ├── admin/            # B端：高权限管理员后台面板
│   └── api/              # Serverless API 路由
├── components/           # React 业务与原子组件库
│   ├── ui/               # Shadcn 基础 UI 库
│   ├── map/              # 高德地图与地理圈地计算组件
│   └── chat/             # 实时通讯（语音、输入法约束、消息气泡）组件
├── lib/                  # 核心工具 (Prisma 实例, Supabase 客户端, Auth 签名算法)
├── prisma/               # 数据库 Schema 与迁移脚本
├── public/               # PWA 清单与静态图片/音效资源
└── scripts/              # 辅助自动化脚本
```

---

## 📅 近期更新日志 (Changelog)

### 2026-06-10: 🛡️ P0-P2 架构重构与高危漏洞修复 (Retrospective Review Fixes)

针对核心系统的安全性、性能表现及防作弊结算，执行了全面的架构重构和代码修复：

- **P0 级安全漏洞与越权防护 (Security & Auth)**:
  - **防止 `x-user-id` 伪造**: 在 [middleware.ts](file:///d:/project/city-lord/middleware.ts) 入口处无条件清空外部请求携带的 `x-user-id`，仅在 Supabase JWT 解析成功后于服务端内部可信写入该 header，彻底防御假冒他人 ID 越权的风险。
  - **未授权状态码对齐**: 在 [with-handler.ts](file:///d:/project/city-lord/lib/api/with-handler.ts) 中，将缺失认证头错误明确绑定为 `AUTH_TOKEN_MISSING` (401)，确保前端 SWR 拦截器能精确执行登出逻辑。
- **P0 级防作弊审计与事务防崩 (Prisma Transactions)**:
  - **审计记录延迟外键绑定**: 重构 [anti-cheat-pipeline.ts](file:///d:/project/city-lord/lib/anti-cheat/pipeline/anti-cheat-pipeline.ts) 和 [run-service.ts](file:///d:/project/city-lord/app/actions/run-service.ts)，流水线不再同步直接创建 `anti_cheat_audit_logs` 记录。而是将违规日志暂存于上下文，待 `runs` 记录在 Prisma 事务中顺利生成并获取到 `run_id` 后再执行批量创建，保证外键物理关联。
  - **致命拦截事务隔离**: 对触发致命红线的作弊拦截（会回滚结算事务），审计记录通过 catch 块改由独立后台异步任务（fire-and-forget）写入，确保审计日志写入波动不引发整体结算管道返回 500 异常。
- **P1 级性能与 React 引用污染修复 (Performance & SWR)**:
  - **防作弊坐标字段浅拷贝**: 优化 [case-converter.ts](file:///d:/project/city-lord/city-lord-app/src/lib/case-converter.ts)，对 `skipKeys` (如 `coordinates`/`path`) 在转换时执行浅拷贝，防止地图组件等局部原地修改污染 React 状态或 SWR 缓存，杜绝状态污染。
  - **响应拦截 FormData 兼容与 403 降维攻击防御**: 优化 [fetch-shim.ts](file:///d:/project/city-lord/city-lord-app/src/lib/fetch-shim.ts)，只对 Content-Type 为 `application/json` 且非 FormData 的响应体执行大小写转换，避免流式数据或多媒体上传崩溃；对老版本 WebView 的空 403 异常，提供防御式 JSON 兜底，防止前端反序列化报错。
- **P2 级防作弊与 EventLoop 线程优化 (EventLoop & GIS)**:
  - **防作弊 Turf.js 计算让出 EventLoop**: 重构 [polygon.validator.ts](file:///d:/project/city-lord/lib/anti-cheat/pipeline/validators/polygon.validator.ts)，使用 `async` 并在重度数学运算（如 unkink）前调用 `setImmediate` 让出 Node 事件循环，避免大批结算涌入时发生高 CPU 线程阻塞。
  - **Convex Fallback 凸包面积虚增限制**: 限制凸包兜底计算，当自交退化的多边形转为 Convex Hull 后，若膨胀面积比例超过 `10%` (`areaInflationRatio > 1.10`)，立即视作非法并清空多边形，杜绝利用自交漏洞刷取领地面积的作弊手段。
- **状态码规范性升级**: 精确划分 `ERROR_HTTP_STATUS`，将俱乐部人数满 (`BIZ_CLUB_FULL`) 和金币不足 (`BIZ_INSUFFICIENT_COINS`) 映射至 409 Conflict 状态码。

### 2026-05-29: ⚙️ 全局计划任务（Cron Jobs）重构与 VPS 自动部署加固

- **高频调度升级（VPS解禁）**: 随着项目向自托管 VPS 环境迁移，全面释放原有受免费平台额度限制的计划任务执行频率，显著提升核心玩法与数据的实时性：
  - `stamina-recovery`（体力自动恢复）：从每日低频调用升级为每 5 分钟自动恢复 10 点（`*/5 * * * *`）。
  - `update-faction-stats`（阵营总面积快照缓存）：从每日夜间更新优化为每 5 分钟计算一次。
  - `territory-stats-worker`（领地事件消息队列消费）：调整为高频每 1 分钟消费一次（`* * * * *`）。
  - `update-province`（省市层级排行聚合）：从每日零点聚合提速为每小时自动汇总计算（`0 * * * *`）。
  - `npc-invasion`（幽灵NPC暗影入侵）：从每日一次提升为每 12 小时高频清洗未维护地块（`0 */12 * * *`）。
- **PostgreSQL 咨询锁安全防护**: 针对高频的队列消费 Worker（`territory-stats-worker`），在 `TerritoryStatsAggregatorService.processNextBatch()` 内部引入了 PostgreSQL 的**独占式咨询锁机制（Advisory Lock ID: 10088）**。确保在高频并发或多实例重启场景下，同一个队列游标不会被并发执行，从根本上杜绝了排行榜总瓦片数和面积在数据库 Upsert 中被重复相加的并发双刷风险。
- **自动构建部署流集成（SSH & PM2）**: 重构并扩展了 [deploy-to-vps.js](file:///d:/project/city-lord/scripts/deploy-to-vps.js) 自动化部署流水线，加入了 `Step 6.5` 自动挂载机制。在推送代码并由 PM2 载入后，服务器会自动运行一键挂载脚本。
- **VPS 级原生 Crontab 部署脚本**: 新增了自研 Linux-native 部署工具 [deploy-crons.sh](file:///d:/project/city-lord/deploy-crons.sh)。支持传入自定义 `CRON_SECRET`（已设置为强密钥 `aaa021300`）和 `APP_URL`，具备标签清除、软隔离、安全日志归档（重定向到 `~/.citylord/logs/crons.log`）等工业级部署防护能力。
- **Windows 本地 Cron 守护模拟器**: 新增 [run-local-crons.ps1](file:///d:/project/city-lord/run-local-crons.ps1) 终端守护脚本。以 PowerShell 无限循环机制在本地开发机完美仿真 VPS Crontab 的多频触发效果，免去配置 Windows 任务计划程序的繁琐，极大地改善了本地 LBS 数据的调试体验。

### 2026-05-09: 🏷️ 领地默认命名规范化重构

- **View 层格式化模块**: 新增 `lib/territory-display.ts`，实现 `getTerritoryDisplayName()` 统一工具函数，封装四级展示名称 Fallback 链：`customName(10字符)` → `clubName(8字符)` → `ownerNickname(6字符)+'的领地'` → `领地_XXXXX`（哈希短码兜底）。
- **哈希短码算法**: 基于领地 CUID 生成确定性 5 位十进制短码（`00000–99999`），无数据库迁移成本，局部唯一性满足地图展示需求。
- **社交属性保留**: 重构保留了玩家归属的直观标识（俱乐部名、昵称），仅在匿名领地下回退至冷静短码，兼顾 UI 整洁与社交可见性。
- **类型安全加固**: `TerritoryDisplayContext.customName` 改为必传字段（移除 `?` 修饰符），在 TypeScript 层强制调用侧显式传值，防止静默跳过第一级 Fallback。
- **零 DB 迁移**: `custom_name` 字段保持 `String?`（nullable），与 `territory-rename.ts` 的重置逻辑完全兼容，无需 Schema 变更。

### 2026-05-08: 🔐 领地重命名功能全面重构

- **P0 运行时崩溃修复**: 将 `cookies()` 改为顶层静态 `import { cookies } from 'next/headers'`，修复 Next.js 15 动态 import 导致的 `cookies() was called outside a request scope` 崩溃。
- **事务防竞态 (P1)**: 将 `findUnique` + `update` 封装进 `prisma.$transaction`，消除高并发下 TOCTOU 时间窗口，杜绝冷却期被并发绕过的风险。
- **同名幂等短路 (P1)**: 新增同名检测逻辑，名称未变更时直接返回 `{ success: true, isIdempotent: true }`，不消耗冷却次数。
- **重置为默认名**: 支持传入空字符串清除自定义名称（写入 `null`），配合幂等校验一并处理，回退逻辑与 `territory-display.ts` 无缝衔接。
- **敏感词防御性校验 (P1)**: 为 `mint-filter.verify()` 添加可选链判断（`result?.words`），防止边缘输入下 TypeError 被全局 catch 吞掉。
- **精准缓存失效 (P4)**: 新增 `revalidateTag(`territory-${territoryId}`)` 按领地 ID 精准失效，保留 `revalidatePath('/map')` 全局刷新。
- **常量集中管理 (P5)**: 提取 `RENAME_CONFIG = { MAX_LENGTH: 10, COOLDOWN_DAYS: 7 } as const`，支持未来差异化扩展（如 VIP 冷却期）。

### 2026-05-08: ⚡ 时钟漂移防御与结算状态修复

- **时钟漂移修复**: 修复结算时序中因服务器与客户端时钟偏差导致的时间轴位移问题，确保跑步时间戳在极端网络环境下的准确性。
- **SettlementRecord 严格联合类型**: 将 `SettlementRecord` 从宽松类型收窄为严格 Union，消除结算管道中的类型不一致隐患。
- **FIFO 限流器注释补全**: 补全原生层 FIFO 坐标缓冲区的核心注释，明确最大容量与淘汰策略，提升代码可维护性。

### 2026-05-08: 🛡️ 安全红队审计漏洞修补 (P0/P1/P2)

- **P0 安全加固**: 修补红队审计发现的高危漏洞，涵盖身份验证、越权访问及数据注入防护。
- **P1/P2 修复**: 完善接口层幂等性校验、鉴权中间件边界覆盖，关闭多个潜在的权限提升路径。

### 2026-05-08: 🏆 成就系统服务端校验与弱网离线队列

- **成就服务端校验**: 将成就解锁校验从纯客户端迁移至 Server Action，防止客户端篡改成就状态；新增服务端幂等写入保障，避免重复解锁。
- **离线成就同步组件**: 新增 `OfflineAchievementSync` 组件，消费 `pending_offline_runs` 队列，弱网环境下跑步数据恢复上线后自动补发成就判定。
- **TDZ 错误修复**: 修复成就分享处理器中的 Temporal Dead Zone 引用错误，确保分享回调在组件挂载后的合法调用时序。
- **P0/P1 幂等与鉴权**: 修复离线队列重放时的重复提交问题；加固认证令牌在后台状态恢复场景下的有效性校验。
- **时钟漂移容灾**: 离线队列回放时引入客户端-服务端时间戳偏差容忍窗口，防止因手机时钟偏移导致的结算拒绝。

### 2026-05-08: 📐 跨页面 Safe-Area 统一治理

- **Safe-Area 消费对齐**: 统一社交页与个人中心页的安全区 CSS 消费方式，消除不同设备（尤其是异形屏）上的底部内容被 TabBar 遮挡问题。

### 2026-05-08: 🤖 Android 依赖版本锁定

- **androidx.core 降级**: 将 `androidx.core` 从不稳定版本降级至 `1.15.0`，并在 Gradle 中配置强制版本解析策略（`resolutionStrategy.force`），解决高版本 core 库与 Capacitor 6 的兼容性冲突。

### 2026-05-07: 🛡️ 全局 Safe-Area 系统重构

- **@capacitor-community/safe-area 接入**: 引入官方社区插件实现全局安全区 CSS 变量注入（`--safe-area-inset-*`），替换原有分散的硬编码 padding 方案，统一 iOS 刘海屏与 Android 打孔屏适配。
- **三阶段 Safe-Area 降级链**: 建立 `Capacitor 插件值 → env() 系统值 → 固定兜底值` 的三级 CSS 降级策略，保障各端一致渲染。
- **录音竞态修复**: 修复音频录制启动与权限授予之间的 React 异步状态竞态，实现授权后毫秒级录制响应。
- **Pointer Event 统一**: 将地图交互层的 `onTouchStart/onMouseDown` 统一迁移至 `onPointerDown`，消除移动端事件穿透导致的双触发问题。
- **聊天安全区重叠修复**: 修复聊天页输入法弹起时底部输入框被 Safe-Area 二次偏移遮挡的问题；修复语音录制按钮长按的无限 toast 循环 Bug。
- **GPS 标记点抖动修复**: 对 GPS 实时定位 Marker 引入坐标平滑算法，解决信号波动时标记点在地图上的视觉抖动问题。
- **状态栏 Overlay 修复**: 解决 Android 沉浸式状态栏与页面顶部内容重叠的视觉缺陷。

### 2026-05-07: 🌐 GIS 空间算法关键 Bug 修复

- **多边形污染根治**: 修复因领地多边形坐标精度问题导致的"幽灵重叠"——相邻领地间存在微小面积的错误重叠判定，现通过拓扑清洗前置处理彻底消除。
- **GIS 黑洞修复**: 修复在极端凹多边形场景下 `ST_Contains` 判定异常导致的"结算黑洞"（领地被错误吞噬），引入 `ST_IsValid` 前置校验与自动修复。
- **结算状态机终态**: 修复结算流水线在网络超时后状态停留在 `PENDING` 的僵死问题，新增超时自动转 `FAILED` 兜底机制。
- **伤害引擎精度修复**: 修正领地 HP 伤害计算在浮点边界的精度丢失，统一使用整数运算避免 0.1 伤害被舍入为 0。

### 2026-05-07: ⚙️ 体力系统、阵营排行榜与 GiST 索引

- **体力系统引擎**: 新增玩家体力（Stamina）机制，每次圈地消耗体力值，体力耗尽无法发起新占领；支持按时间自动恢复与道具即时补充。
- **阵营排行榜**: 新增城市级别的赤红先锋 vs 蔚蓝联盟实时积分榜，按领地总面积与占领数双维排序，每日定时结算。
- **领地 GiST 空间索引**: 为 `territories.geojson` 列建立 PostgreSQL GiST 索引，大幅提升地图瓦片加载时的空间范围查询（`ST_Intersects`）性能，在千级领地规模下查询耗时降低约 80%。
- **多项功能优化**: 完善领地详情面板数据展示；优化跑步结算任务队列的并发控制逻辑。
  
### 2026-04-08: 🛡️ 系统稳态加固与类型债清理 (Final Stabilization)
*   **根布局重构 (BUG-01)**: 彻底解耦 `app/layout.tsx`，将其重构为纯 Server Component，恢复 Header 静态元数据注入；引入 `ClientShell` 统一管理客户端 Provider。
- **水化崩溃防御 (BUG-02)**: 在 `useGameStore` 持久化层引入类型校验与防御性 reviver，根治因 LocalStorage 损坏导致的 App 启动白屏问题。
- **UI 适配深度治理 (RISK-01/05)**: 建立三阶段 CSS 安全区降级链；实现 `StatusBar` 实时高度注入，解决 Android 状态栏 Overlay 视觉缺陷。
- **结算流水线闭环 (RISK-02/03)**: 在 Trigger.dev 任务中实现 `runs` 状态自动回写及 Turf.js 顶点数前置校验，确保数据一致性。
- **全速类型化 (Type Safety)**: 同步 Prisma Client 类型后，清除了结算逻辑中所有的 `as any` 型断言，建立严格的 `RunPoint` 与 `TerritoryRow` 接口体系。

### 2026-04-04: 🛰️ 原生锁屏追帧机制与异常防崩重构
*   **原生黑匣子引擎**: Java 层引入 `LocationBuffer` 本地高密度坐标内存池；内置 2 米精度防抖与最大 10,000 容量的 FIFO 规则，保障长线锁屏进程的数据稳态。
*   **切前台苏醒补齐**: 前端打通 Capacitor `appStateChange` 底层监听。苏醒刹那基于时间戳对撞去重后，触发原生通讯实现毫秒级“落漏点平滑追帧注入”，根治系统休眠丢失造成的跳段或错误大面积直连圈地结算。
*   **错误边界软着陆**: 组件级剔除 ErrorBoundary 的粗暴重载并剥掉 "UNKNOWN ERROR" 面具。全页级透传前层 stack 给联调支持，同时使用 `useGameStore` 实现奔溃后的游戏状态级安全回退护航。

### 2026-04-01: 🎨 SPA 导航收口与浅色模式可访问性修复
*   **地图头部可读性修复**: `MapHeader` 左上角区县名与下拉箭头统一改为浅色模式深字、深色模式白字，解决白字贴浅底导致的识别困难。
*   **首页起跑流转重构**: 首页「开始圈地跑」主 CTA 统一收口到 `activeTab='start'` 的准备页，由用户在准备页确认后再正式起跑，避免误触直接开跑。
*   **准备页返回防重载**: `StartRunPageClient` 返回按钮严格只调用父层 `onBack` 回流到首页，并为关键按钮显式补充 `type="button"`，彻底规避原生 submit / 浏览器级刷新风险。
*   **首页模块精简**: 暂时隐藏「附近可行动目标」模块，仅保留业务代码与数据流，避免当前版本展示无完整闭环的入口。
*   **地图 FAB 双入口重构**: 废弃地图页旧路线规划浮钮，改为左侧任务入口、右侧社交入口，并统一使用 `bottom-[calc(env(safe-area-inset-bottom)+7rem)]` 规避底部 TabBar 遮挡。
*   **排行榜浅色模式修复**: 首页「查看排行」标题补齐高对比主题色适配，保证浅色 / 深色模式下均清晰可见。

### 2026-03-31: 🏰 领地生命值、风化与低血量告警
*   **领地生命值系统**: 将 `territories.health` 统一收敛为 100 上限语义；跑步结算中新增“领主回满 / 同阵营巡逻 +50 / 敌对入侵 -20”的关系判定矩阵。
*   **每日风化 Cron**: 新增 `GET /api/cron/territory-decay`，按 Vercel Cron + `CRON_SECRET` 执行地块生命值衰减，并在生命值归零后自动清空归属。
*   **社交通知告警**: 当领地生命值首次跌破 50 时，自动写入系统通知，展示在社交页「系统通知」栏目，引导同阵营玩家及时巡逻修复。
*   **地图视觉反馈**: 低血量领地在地图上切换为黄色警示描边并降低填充透明度，便于快速识别待维护区域。

### 2026-03-16: 🛡️ 核心故障修复与系统加固 (v4 灰度版)
*   **Android 前台服务 (P0)**: 深度适配 Android 14+；实现 `FOREGROUND_SERVICE_TYPE_LOCATION` 强制声明；重构 `onStartCommand` 为“先恢复状态、后启动通知”的严谨时序，支持 `START_STICKY` 后的 `null intent` 状态自愈。
*   **Session 崩溃恢复 (P0)**: 升级至 Recovery 2.0 机制；补全 `isRunning`、`status`、`sessionVersion` 等 7 项快照字段；引入版本硬分叉校验与 24h 失效强制清理逻辑，杜绝误恢复与循环弹窗。
*   **SQL 与领地可见性 (P1)**: 修复 `settlement.ts` 中 Join 查询产生的字段歧义故障 (SQL Ambiguity)；补齐 `city.ts` 领地流接口中缺失的 `geojson_json` 字段，确保占领地在全网立即同步可见。
*   **全链路观测系统**: 建立全系统统一命名埋点体系 (如 `fgs_start_success`, `run_session_restore_failed`)，覆盖 Native 启动、Session 状态机、地图重试及语音竞态等 11 类核心监控位。
*   **录音竞态修复**: 解决麦克风权限授予与 MediaRecorder 启动间的 React 异步状态竞态，实现“授权即刻录制”的毫秒级响应。

### 2026-03-15: ⚡ 包含区域暴击逻辑与面积排除
*   **暴击机制**: 实现新领地完全包围旧领地时触发 3 倍伤害结算；同步记录 `CRIT_ATTACKED` 事件。
*   **判定算法**: 引入 PostGIS `ST_Contains` 精确判定包围关系，并通过 `turf.difference` 在新领地中自动形成“洞”，实现被包围面积的自动排除。
*   **UI 战报**: 结算面板新增红色加粗的暴击伤害文案，并适配电击脉冲（Zap Pulse）动画增强视觉反馈。

### 2026-03-15: 🎙️ 麦克风权限流优化 (四态状态机)
*   **权限规范化**: 补全 `AndroidManifest.xml` 录音权限，重构 `useAudioRecorder` 状态机。
*   **体验改进**: 实现“首次触发录音直请”及“永久拒绝自定义引导”。
*   **跳转与兜底**: iOS 实现应用设置页直跳；Android 侧通过应用状态监测实现 Failback 文字引导闭环。
*   **验收结论**: 有条件通过（Android 一键直达设置页待增强）。

### 2026-03-15: 📍 常驻定位、UI 治理与数据链闭环
*   **常驻定位 (Android)**: 完成 `START_STICKY` 服务守护、Native 缓存及确定性每日一语轮换逻辑。
*   **UI Portal 化**: 将 `TerritoryInfoBar` 挂载至顶层 Portal，解决 zIndex 遮挡并适配 `safe-area`。
*   **数据链集成**: 补全领地 HP、积分比重、类型字段，确立服务端为单一事实来源。
*   **跨平台持久化**: `AMapLocationBridge` 引入 `localStorage` 持久化，优化首屏冷启动秒开体验。

### 2026-03-10: 🛡️ Admin 鉴权重构与举报反馈治理
*   **鉴权升级**: 重写后台 Admin Auth 逻辑，抛弃前端直接读取明文 Cookie 的脆弱模式；接入 Web Crypto JWT 式安全签名 Session，严格防护敏感 Server Action。
*   **举报中台**: 后台新增“双源汇聚反馈中心”。精准关联 Prisma 外键将普通 Bug 建议反馈及动态圈内的违规图文举报融为一体，赋予管理员「一键查证 / 确认违规 / 驳回」的可视化处理面板，并修补了直接改库的安全漏洞。

### 2026-03-09: 💬 社交 UI 层大改版与性能优化
*   完成了类微信 1v1 私聊的右侧/左侧气泡分离重构。
*   优化了 iOS Safari 与移动端输入法弹起时的 Safe Area 兼容与 Bottom 视口跳动。
*   精准修复了朋友圈/动态流中缺失的距离格式化精度。

### 2026-02-23: 🛠️ 稳定性修复与功能补齐
*   将提醒查询逻辑迁移至 Server Action，免除跨域失败的困扰并优化离线兜底。
*   修复了 Node 18+ 环境下 Next.js 的内置 dns 模块冲突导致的构建失败。

### 2026-02-15: 🚀 GPS 性能重构
*   通过 `React.memo` 与深度 Hook 改造削减了 GPS 坐标高频触发造成的全局不必要渲染，极大节约了移动端功耗。

---

*City Lord - Run the City, Own the World.*
