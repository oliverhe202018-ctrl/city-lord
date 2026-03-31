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
*   **领地机制**: 在地图上绘制闭环以占领六边形地块 (基于 H3 算法)，占领城市、扩大势力范围。
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

---

## 💻 技术栈 (Tech Stack)

*   **前端框架**: Next.js (App Router), React 19, Tailwind CSS v4, TypeScript
*   **地图与算法**: 高德地图 JS API, Turf.js, H3.js (Uber六边形网格索引)
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
