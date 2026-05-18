# City Lord (城市领主) - Code Wiki

> 最后更新：2026-05-18
> 版本：v0.216.0
> 技术栈：Next.js 16 + React 19 + Capacitor 6 + AMap SDK + Turf.js + Supabase + PostgreSQL + Prisma

---

## 目录

1. [项目概述](#1-项目概述)
2. [整体架构](#2-整体架构)
3. [项目目录结构](#3-项目目录结构)
4. [核心模块详解](#4-核心模块详解)
5. [数据库架构](#5-数据库架构)
6. [状态管理](#6-状态管理)
7. [自定义 Hooks](#7-自定义-hooks)
8. [Server Actions & API 路由](#8-server-actions--api-路由)
9. [关键算法与工具函数](#9-关键算法与工具函数)
10. [原生集成](#10-原生集成)
11. [测试策略](#11-测试策略)
12. [项目运行与部署](#12-项目运行与部署)
13. [安全与性能](#13-安全与性能)
14. [依赖关系图](#14-依赖关系图)
15. [开发规范](#15-开发规范)

---

## 1. 项目概述

### 1.1 项目简介

**City Lord (城市领主)** 是一款基于地理位置的 LBS 游戏化移动应用，用户通过真实跑步/步行为游戏中的"领地"进行占领、扩张和战斗。核心玩法借鉴了"圈地游戏"概念：用户在地图上跑步，画出闭合路径后即可获得路径围合区域的领地。

### 1.2 核心价值主张

- **运动游戏化**：将跑步、步行等日常运动转化为游戏中的领地占领，激励用户保持运动习惯
- **社交竞争**：支持个人、俱乐部、阵营三级竞争体系
- **城市级排行榜**：按城市/省份聚合统计，鼓励跨地域竞技
- **离线优先**：所有核心数据（轨迹、步数、突发日志）本地缓存，恢复网络后乐观同步

### 1.3 主要特性

- 高德地图 SDK 实时定位与轨迹追踪
- 领地结算系统（闭合路径检测、GIS 几何清理、多边形面积计算）
- 步数同步与计步器校验（防作弊）
- 游戏任务引擎与成就系统
- 俱乐部系统（创建/审核/加入/管理）
- 社交聊天系统（私信/群聊）
- 阵营对抗系统（Factions）
- 后台管理系统（审核/数据统计）
- 健康数据集成（Apple HealthKit / Android Health Connect）
- Apple Watch 数据同步

### 1.4 技术栈列表

| 类别 | 技术 | 版本 |
|------|------|------|
| **框架** | Next.js | 15.5.12 |
| **UI 库** | React | 19.2.0 |
| **样式** | Tailwind CSS | 4.x |
| **移动端容器** | Capacitor | 6.2.1 |
| **地图 SDK** | @amap/amap-jsapi-loader | 1.0.1 |
| **GIS 计算** | @turf/turf | 7.3.3 |
| **数据库 ORM** | Prisma | 5.22.0 |
| **数据库** | PostgreSQL (Supabase) | - |
| **认证** | Supabase Auth | v2 |
| **状态管理** | Zustand | 5.0.10 |
| **动画** | framer-motion | 12.29.2 |
| **后端任务队列** | Trigger.dev | v4 |
| **表单验证** | Zod | 3.25.76 |

### 1.5 核心依赖（原生能力）

| 能力 | Web 降级 | Native API |
|------|---------|-----------|
| GPS 定位 | Web Geolocation API | 高德 AMap SDK (AMapLocationPlugin) |
| 计步器 | window.navigator | CapPedometer |
| 健康数据 | - | HealthKit (iOS) / Health Connect (Android) |
| 推送通知 | - | Firebase FCM + APNs |
| 后台服务 | - | Android ForegroundService |
| 音频 | Web Audio API | Capacitor Native Audio |

---

## 2. 整体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    用户设备 (Android/iOS)                  │
│                                                         │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────┐ │
│  │  React/Next.js│  │  Capacitor 6    │  │  Native    │ │
│  │  Frontend     │◄─┤  Bridge Layer   │◄─┤  Android   │ │
│  │  (App Router) │  │  (Plugins)      │  │  (Java)    │ │
│  └──────┬───────┘  └────────┬────────┘  └────────────┘ │
│         │                   │                           │
│         ▼                   ▼                           │
│  ┌──────────────┐  ┌─────────────────┐                  │
│  │  Zustand     │  │  AMapLocation   │                  │
│  │  Stores      │  │  Bridge         │                  │
│  └──────────────┘  └─────────────────┘                  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / WebSocket
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Vercel Edge / Cloud                   │
│                                                         │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │  Next.js Server       │  │  Trigger.dev         │    │
│  │  (Server Actions)     │  │  (Background Tasks)  │    │
│  │  - saveRunActivity    │  │  - settle-territories│    │
│  │  - club actions       │  │  - settlement.ts     │    │
│  │  - profile actions    │  │  - club-decay.ts     │    │
│  └──────────┬───────────┘  └──────────┬───────────┘    │
│             │                          │                │
│             ▼                          ▼                │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │  Prisma ORM          │  │  PostgreSQL (Supabase)│    │
│  │                      │  │  - profiles           │    │
│  │                      │  │  - territories        │    │
│  │                      │  │  - runs               │    │
│  │                      │  │  - clubs              │    │
│  └──────────────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流架构

**客户端 → Server Actions → Prisma → PostgreSQL/Supabase**

```
用户操作 (跑步结束)
  │
  ▼
Frontend Hook (useRunningTracker)
  │
  ▼
Zustand Store (useLocationStore / useGameStore)
  │
  ▼
Server Action (saveRunActivity)  ←  'use server'
  │
  ├── 验证 (validateRunLegitimacy / validateRunData)
  ├── 反作弊检查 (MVP Rules / Rate Limiter)
  ├── GIS 降维采样 (Ramer-Douglas-Peucker)
  ├── 闭合路径检测 (首尾吸附 / 线段交叉)
  ├── 多边形归一化 (unkink / convex fallback)
  │
  ▼
Prisma Transaction (prisma.$transaction)
  ├── 写入 runs 表
  ├── 写入 anti_cheat_audit_logs 表
  ├── 更新 profiles (coins, xp, stamina)
  └── 更新 user_city_progress
  │
  ▼
Trigger.dev 异步任务 (settle-territories)
  ├── processTerritorySettlement()
  ├── 创建 territories 表记录
  ├── 计算与更新领地衰减
  └── 更新 runs 表状态 (settling → completed)
  │
  ▼
前端轮询 (getRunSettlementStatus)
  │
  ▼
Revalidation (revalidatePath / revalidateTag)
```

### 2.3 关键技术决策

| 决策 | 方案 | 原因 |
|------|------|------|
| 框架 | Next.js 16 App Router + Server Actions | 统一的 React 全栈方案，SSR/SSG 支持 |
| 状态管理 | Zustand | 轻量、无 Provider 嵌套、移动端友好 |
| 地图 SDK | 高德 AMap (GCJ-02 坐标系) | 国内定位精度最优、POI 数据丰富 |
| GIS 计算 | Turf.js + 服务端 PostGIS | 客户端实时计算 + 服务端精确校验 |
| 数据库 | Supabase PostgreSQL + RLS | 行级安全策略 + 实时订阅 |
| 异步任务 | Trigger.dev | 长耗时领地结算不阻塞主流程 |
| 容器 | Capacitor 6 | 一套代码，iOS/Android/Web 三端部署 |

---

## 3. 项目目录结构

```
/workspace/
├── app/                          # Next.js App Router 路由与页面
│   ├── actions/                  # Server Actions (业务逻辑)
│   ├── admin/                    # 后台管理面板
│   ├── challenges/               # 挑战页面
│   ├── changelog/                # 更新日志页面
│   ├── feedback/                 # 反馈页面
│   ├── invite/                   # 邀请页面
│   ├── lord-center/              # 领主中心
│   ├── login/                    # 登录页面
│   ├── privacy/                  # 隐私政策
│   ├── referral/                 # 推荐页面
│   ├── reset-password/           # 重置密码
│   ├── route-planner/            # 路线规划
│   ├── start/                    # 开始页面
│   ├── tasks/                    # 任务页面
│   ├── terms/                    # 服务条款
│   ├── training/                 # 训练页面
│   ├── watch-sync/               # 手表同步页面
│   ├── layout.tsx                # 根布局
│   └── page.tsx                  # 首页
│
├── components/                   # React 组件
│   ├── Faction/                  # 阵营组件
│   ├── achievements/             # 成就组件
│   ├── admin/                    # 管理员组件
│   ├── auth/                     # 认证组件
│   ├── challenges/               # 挑战组件
│   ├── changelog/                # 更新日志组件
│   ├── chat/                     # 聊天组件
│   ├── city/                     # 城市组件
│   ├── citylord/                 # 业务核心组件
│   ├── game/                     # 游戏组件
│   ├── leaderboard/              # 排行榜组件
│   ├── map/                      # 地图渲染组件
│   ├── micro-interactions/       # 微交互组件
│   ├── mode/                     # 模式组件
│   ├── profile/                  # 个人资料组件
│   ├── report/                   # 报告组件
│   ├── room/                     # 房间组件
│   ├── running/                  # 跑步组件
│   ├── social/                   # 社交组件
│   ├── ui/                       # UI 基础组件 (Radix/UI)
│   ├── watch-sync/               # 手表同步组件
│   ├── ClientShell.tsx           # 客户端壳组件
│   ├── ErrorBoundary.tsx         # 错误边界
│   ├── GlobalLocationProvider.tsx # 全局定位 Provider
│   ├── Providers.tsx             # 全局 Providers
│   └── theme-provider.tsx        # 主题 Provider
│
├── hooks/                        # 自定义 React Hooks (40+ Hooks)
│   ├── useAMap.ts                # 高德地图 Hook
│   ├── useAudioPlayer.ts         # 音频播放器 Hook
│   ├── useAudioRecorder.ts       # 音频录制 Hook
│   ├── useAuth.ts                # 认证 Hook
│   ├── useBackgroundLocation.ts  # 后台定位 Hook
│   ├── useBattleCaster.ts        # 战斗广播 Hook
│   ├── useClubAudit.ts           # 俱乐部审核 Hook
│   ├── useGameData.ts            # 游戏数据 Hook
│   ├── useGeolocation.ts         # 地理定位 Hook
│   ├── useHealthKit.ts           # HealthKit Hook
│   ├── useHomeData.ts            # 首页数据 Hook
│   ├── useHydration.ts           # 水化 Hook
│   ├── useImmersiveMode.ts       # 沉浸模式 Hook
│   ├── useLocationStatus.ts      # 定位状态 Hook
│   ├── useMissions.ts            # 任务系统 Hook
│   ├── usePageBackNavigation.ts  # 页面返回导航 Hook
│   ├── useRandomEvents.ts        # 随机事件 Hook
│   ├── useReverseGeocode.ts      # 逆地理编码 Hook
│   ├── useRewardSettlement.ts    # 奖励结算 Hook
│   ├── useRunningLocation.ts     # 跑步定位 Hook
│   ├── useRunningTracker.ts      # 跑步追踪 Hook
│   ├── useSafeGeolocation.ts     # 安全地理定位 Hook
│   ├── useShareCard.ts           # 分享卡片 Hook
│   ├── useSmoothMapCamera.ts     # 平滑地图相机 Hook
│   └── useWaveform.ts            # 波形 Hook
│
├── lib/                          # 核心工具库与业务逻辑
│   ├── admin/                    # 后台管理模块
│   ├── anti-cheat/               # 反作弊系统
│   │   ├── mvp-rules.ts          # 核心规则 (速度/步幅/瞬移检测)
│   │   ├── rate-limiter.ts       # 频率限制
│   │   └── territory-builder.ts  # 轨迹重建与风险评估
│   ├── api/                      # API 客户端
│   ├── audio/                    # 音频处理
│   ├── cache/                    # 服务端缓存
│   ├── capacitor/                # Capacitor 安全插件
│   ├── citylord/                 # 城市领主工具
│   ├── client/                   # 客户端工具
│   ├── cocos/                    # Cocos 游戏引擎相关
│   ├── constants/                # 常量定义
│   ├── engine/                   # 游戏引擎
│   ├── format/                   # 格式化工具
│   ├── game/                     # 游戏逻辑
│   │   ├── gamification-dispatcher.ts
│   │   ├── leveling-system.ts    # 升级系统
│   ├── game-logic/               # 游戏核心逻辑
│   │   ├── achievement-core.ts   # 成就核心
│   │   ├── experience-service.ts # 经验服务
│   │   ├── faction-balance.ts    # 阵营平衡
│   │   ├── mission-service.ts    # 任务服务
│   │   └── reward-service.ts     # 奖励服务
│   ├── gamification/             # 游戏化系统
│   ├── geo/                      # 地理工具
│   ├── gis/                      # GIS 计算
│   │   └── geometry-cleaner.ts   # 几何清理
│   ├── location/                 # 定位工具
│   ├── map/                      # 地图工具
│   ├── missions/                 # 任务工具
│   ├── schemas/                  # 数据模式
│   ├── services/                 # 服务层
│   │   ├── BadgeService.ts
│   │   ├── activity-service.ts
│   │   ├── hotzone-service.ts
│   │   ├── territory-hp-service.ts
│   │   └── territory-service.ts
│   ├── supabase/                 # Supabase 客户端
│   ├── sync/                     # 同步管理
│   ├── territory/                # 领地系统
│   │   └── settlement.ts         # 领地结算引擎
│   ├── types/                    # 类型定义
│   ├── utils/                    # 通用工具函数
│   ├── validations/              # 数据验证
│   └── validators/               # 验证器
│
├── store/                        # Zustand 状态管理
│   ├── useGameStore.ts           # 游戏状态
│   ├── useLocationStore.ts       # 定位状态
│   ├── useMapDisplayStore.ts     # 地图显示状态
│   ├── useMapInteractionStore.ts # 地图交互状态
│   └── useMessageStore.ts        # 消息状态
│
├── prisma/                       # Prisma ORM
├── supabase/                     # Supabase 配置与迁移
├── src/trigger/                  # Trigger.dev 后台任务
├── test/                         # 测试文件
├── types/                        # TypeScript 类型定义
├── utils/                        # 工具函数
└── worker/                       # Web Worker
```

---

## 4. 核心模块详解

### 4.1 领地结算系统 (Territory Settlement)

**核心文件：**
- [settlement.ts](file:///workspace/lib/territory/settlement.ts)
- [geometry-cleaner.ts](file:///workspace/lib/gis/geometry-cleaner.ts)
- [run-service.ts](file:///workspace/app/actions/run-service.ts)

**结算流程：**

1. **轨迹提交**：用户完成跑步后，前端调用 `saveRunActivity()` Server Action
2. **降维采样**：如果轨迹点数 > 500，使用 Ramer-Douglas-Peucker 算法压缩
3. **反作弊校验**：
   - MVP 规则验证（速度 > 16.67m/s、步幅 > 3m 拦截）
   - 元数据验证（步数 vs 距离校验）
   - 路径分析（虚拟定位检测）
   - 频率限制（30秒窗口，最多3次提交）
4. **闭合路径检测**：
   - 规则一：首尾距离 ≤ 20m → 自动吸附闭合
   - 规则二：线段交叉检测（15m 阈值），支持 P 形路径
5. **多边形归一化**：
   - 尝试 Turf.js `unkinkPolygon()` 解结
   - 失败后回退到凸包 `convex()`
   - 面积膨胀率 > 1.35 时拦截
6. **大圈吞噬小圈**：使用 BBox 加速的空间包含检测（重叠 > 90% 视为包含）
7. **异步结算**：主事务完成后，通过 Trigger.dev 触发 `settle-territories` 任务
8. **前端轮询**：使用 `getRunSettlementStatus()` 轮询，直到 `status === 'completed'`

**领地常量：**

| 常量 | 值 | 说明 |
|------|-----|------|
| `LOOP_CLOSURE_THRESHOLD_M` | 20m | 闭环吸附阈值 |
| `SEGMENT_CROSS_THRESHOLD_M` | 15m | 线段交叉判定阈值 |
| `MIN_TERRITORY_AREA_M2` | 100 m² | 最小有效领地面积 |
| `MAX_TERRITORY_AREA_M2` | 200,000 m² | 最大领地面积 |
| `MIN_ISO_RATIO` | 0.003 | 最小等周率 |
| `MIN_CONVEXITY_RATIO` | 0.55 | 最小凸包面积比 |

### 4.2 GPS定位与追踪系统 (GPS Location & Tracking)

**核心文件：**
- [useLocationStore.ts](file:///workspace/store/useLocationStore.ts)
- [GlobalLocationProvider.tsx](file:///workspace/components/GlobalLocationProvider.tsx)
- [amap-location-bridge.ts](file:///workspace/lib/amap-location-bridge.ts)

**定位状态机：**

```
初始化 → 等待授权 → 定位中 → 跑步模式 ←→ 后台模式
  │          │          │         │            │
  ▼          ▼          ▼         ▼            ▼
loading   requesting  tracking  recording   background
```

**关键机制：**

- **Native/Web 自动降级**：通过 `Capacitor.isNativePlatform()` 判断，Web 使用 `navigator.geolocation`
- **高德秒定位**：`setGpsFirst(false)` + `setLocationCacheEnable(true)`
- **精度过滤**：丢弃精度 > 100m 的 GPS 点，防止漂移
- **后台追踪**：通过 Android ForegroundService 保持后台定位
- **坐标系**：高德 SDK 原生输出 GCJ-02 坐标系
- **轨迹回放**：`locationHistory` 数组存储历史轨迹点，支持离线缓存

**关键方法：**

| 方法 | 说明 |
|------|------|
| `startTracking()` | 开始定位追踪 |
| `stopTracking()` | 停止追踪，保存轨迹 |
| `startRun()` | 开始跑步模式（1s 高频采集） |
| `stopRun()` | 停止跑步，计算总距离 |
| `warmupGPS()` | GPS 预热（用于快速首定位） |

### 4.3 跑步追踪系统 (Running Tracker)

**核心文件：**
- [useRunningTracker.ts](file:///workspace/hooks/useRunningTracker.ts)

**核心职责：**
- 距离与时长追踪
- 多边形检测与面积计算
- 轨迹批量上传（离线优先）
- 崩溃恢复与断点续跑

**数据流保障：**
```
useSafeGeolocation (50m filter, Null Island check)
        |
        | location: GeoPoint
        |
        +----> MapRoot.userPath[] (for TrajectoryLayer polyline)
        |
        +----> useRunningTracker (for polygon detection)
```

### 4.4 游戏化系统 (Gamification System)

**核心文件：**
- [useGameStore.ts](file:///workspace/store/useGameStore.ts)
- [leveling-system.ts](file:///workspace/lib/game-logic/level-system.ts)
- [experience-service.ts](file:///workspace/lib/game-logic/experience-service.ts)

**升级系统：**
- 升级公式：`nextLevelXP = currentMaxXP × 1.5`
- 支持连续升级
- 初始 XP 需求：50

**体力系统：**
- 体力用于特定操作消耗
- 通过突发事件奖励、每日恢复等途径补充

### 4.5 反作弊系统 (Anti-Cheat System)

**核心文件：**
- [mvp-rules.ts](file:///workspace/lib/anti-cheat/mvp-rules.ts)
- [run-validator.ts](file:///workspace/lib/validators/run-validator.ts)

**四层防线：**

| 防线 | 检测项 |
|------|--------|
| 1 | 速度 > 16.67m/s、平均速度 > 5m/s、步幅 > 3m |
| 2 | 步数 vs 距离校验、瞬移检测 |
| 3 | 路径分析、虚拟定位检测 |
| 4 | 步数 < 100 拦截、步幅 > 1.5m 拦截 |

**风险等级：**
- `LOW`：正常通过
- `MEDIUM`：多边形置空，不结算领地
- `HIGH`：拦截结算，记录审计日志

### 4.6 GIS几何清理系统 (GIS Geometry Cleaner)

**核心文件：**
- [geometry-cleaner.ts](file:///workspace/lib/gis/geometry-cleaner.ts)

**cleanAndSplitTrajectory() 流程：**

1. 输入采样点坐标
2. 计算相邻点距离，标记跳跃点 (> 500m 视为异常)
3. 按跳跃点分割轨迹片段
4. 对每个片段执行闭环检测（首尾距离 ≤ 20m 且路径总长 ≥ 50m）
5. 过滤无效多边形 (面积 < 100m²)
6. 使用 Turf.js 进行几何清理（去噪、解结）

---

## 5. 数据库架构

### 5.1 核心数据表

#### profiles (用户资料)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| nickname | String | 昵称 |
| avatar_url | String | 头像 URL |
| level | Int | 等级 |
| xp | Int | 经验值 |
| coins | Int | 金币 |
| stamina | Int | 体力 |
| total_distance_km | Float | 总跑步距离 |
| total_area | Float | 总领地面积 |
| faction | String | 阵营 |
| club_id | UUID | 所属俱乐部 |

#### runs (跑步记录)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| distance | Float | 跑步距离 |
| duration | Int | 持续时间(秒) |
| area | Decimal | 领地面积 |
| path | JSON | 轨迹点数组 |
| status | String | settling/completed/flagged |
| risk_score | Int | 反作弊风险评分 |
| risk_level | String | LOW/MEDIUM/HIGH |

#### territories (领地)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| city_id | String | 城市 ID |
| owner_id | UUID | 所有者 ID |
| geojson | Geometry | PostGIS 几何数据 |
| current_hp | Int | 当前生命值 |
| max_hp | Int | 最大生命值 |
| owner_faction | String | 所有者阵营 |
| territory_type | String | 领地类型 |

#### clubs (俱乐部)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | String | 俱乐部名称 |
| owner_id | UUID | 所有者 ID |
| status | String | pending/active/rejected |
| total_area | Decimal | 总面积 |
| member_count | Int | 成员数 |

### 5.2 核心关系

```
profiles ──┬── 1:N ── runs
           ├── 1:N ── territories
           └── M:N ── club_members ── clubs

runs ──────┬── N:1 ── profiles
           └── 1:N ── territories

territories ── N:1 ── profiles
             ── N:1 ── clubs
```

---

## 6. 状态管理

### 6.1 Zustand Store 结构

#### useLocationStore

```typescript
interface LocationStoreState {
    location: GeoPoint | null;
    locationSource: 'gps' | 'amap-native' | 'web-fallback' | 'cache' | null;
    loading: boolean;
    status: LocationStatus;
    gpsSignalStrength: 'good' | 'weak' | 'none';
    warmupSamples: GeoPoint[];
    lastLocationTimestamp: number;
    currentRunId: string | null;
}
```

#### useGameStore

```typescript
interface GameStore {
    userProfile: UserProfile | null;
    availableTasks: Task[];
    availableAchievements: Achievement[];
    coins: number;
    xp: number;
    stamina: number;
}
```

### 6.2 数据同步协议

- **离线优先**：GPS 轨迹和突发事件日志先在本地 Zustand/Storage 缓存
- **乐观更新**：跑步结束后立即显示奖励结果，后台异步验证
- **Revalidation**：Server Action 完成后调用 `revalidatePath` 和 `revalidateTag`
- **Trigger.dev 异步**：耗时操作（领地结算）通过后台任务解耦
- **幂等保证**：`idempotency_key` 防止重复提交

---

## 7. 自定义 Hooks

### 核心 Hooks 列表

| Hook | 文件路径 | 用途 |
|------|---------|------|
| `useRunningTracker` | `hooks/useRunningTracker.ts` | 跑步核心逻辑 |
| `useMissions` | `hooks/useMissions.ts` | 任务获取与奖励处理 |
| `useRewardSettlement` | `hooks/useRewardSettlement.ts` | 奖励结算 UI |
| `useSafeGeolocation` | `hooks/useSafeGeolocation.ts` | 安全定位获取 |
| `useGameData` | `hooks/useGameData.ts` | 游戏数据获取 |
| `useRandomEvents` | `hooks/useRandomEvents.ts` | 随机事件处理 |
| `useAudioPlayer` | `hooks/useAudioPlayer.ts` | 音频播放 |
| `useAudioRecorder` | `hooks/useAudioRecorder.ts` | 音频录制 |
| `useHealthKit` | `hooks/useHealthKit.ts` | HealthKit 集成 |

---

## 8. Server Actions & API 路由

### 8.1 Server Actions 分组

| 分组 | 文件 | 主要功能 |
|------|------|---------|
| **跑步** | [run-service.ts](file:///workspace/app/actions/run-service.ts) | `saveRunActivity`, `getRunSettlementStatus` |
| **用户** | [user.ts](file:///workspace/app/actions/user.ts), [profile.ts](file:///workspace/app/actions/profile.ts) | 用户资料 CRUD |
| **俱乐部** | [club.ts](file:///workspace/app/actions/club.ts) | 创建/审核/加入/退出/管理 |
| **任务** | [mission.ts](file:///workspace/app/actions/mission.ts) | 任务获取与奖励 |
| **成就** | [achievement.ts](file:///workspace/app/actions/achievement.ts) | 成就检查与授予 |
| **领地** | [territory-detail.ts](file:///workspace/app/actions/territory-detail.ts) | 领地统计与详情 |
| **城市** | [city.ts](file:///workspace/app/actions/city.ts) | 城市数据与排行榜 |
| **阵营** | [faction.ts](file:///workspace/app/actions/faction.ts) | 阵营加入/统计 |
| **后台** | [admin.ts](file:///workspace/app/actions/admin.ts) | 管理面板操作 |

---

## 9. 关键算法与工具函数

### 9.1 GIS 计算

**Turf.js 使用场景：**

| 函数 | 用途 |
|------|------|
| `turf.area()` | 计算多边形面积 |
| `turf.length()` | 计算线长度 |
| `turf.booleanPointInPolygon()` | 点是否在多边形内 |
| `turf.intersect()` | 多边形相交检测 |
| `turf.union()` | 多边形合并 |
| `turf.difference()` | 多边形差集 |
| `turf.unkinkPolygon()` | 解结（处理自交多边形） |
| `turf.convex()` | 凸包计算 |
| `turf.simplify()` | 简化几何 |

### 9.2 坐标转换

**文件：** [coord-transform.ts](file:///workspace/lib/utils/coord-transform.ts)

```typescript
// WGS-84 → GCJ-02 (高德坐标系)
function wgs84ToGcj02(lat: number, lng: number): [number, number]

// GCJ-02 → WGS-84 (GPS 坐标系)
function gcj02ToWgs84(lat: number, lng: number): [number, number]
```

### 9.3 闭环检测

**两种闭环策略：**

1. **首尾闭合**：起点与终点距离 ≤ 20m
2. **线段交叉闭合**：轨迹末端与路径中某线段距离 ≤ 15m（支持 P 形）

---

## 10. 原生集成

### 10.1 Capacitor 插件体系

| 插件 | 用途 |
|------|------|
| `@capacitor/geolocation` | GPS 定位 |
| `@capacitor/haptics` | 触觉反馈 |
| `@capacitor/preferences` | 本地存储 |
| `@capgo/capacitor-pedometer` | 计步器 |
| `@capacitor/health` | iOS HealthKit |
| `capacitor-health-connect` | Android Health Connect |

### 10.2 Android 特定集成

**自定义插件：** `android/app/src/main/java/com/citylord/app/AMapLocationPlugin.java`

- 高德 AMap 定位 SDK 桥接
- 支持高精度定位模式
- 后台位置权限处理

**关键配置：**
- `setGpsFirst(false)` — 避免 GPS 优先导致的延迟
- `setLocationCacheEnable(true)` — 启用缓存实现秒定位

---

## 11. 测试策略

### 11.1 测试框架与配置

**框架：** Vitest + jsdom

**配置文件：** [vitest.config.ts](file:///workspace/vitest.config.ts)

### 11.2 已有测试文件

| 文件 | 测试内容 |
|------|---------|
| [anti-cheat-mvp.test.ts](file:///workspace/test/anti-cheat-mvp.test.ts) | 反作弊校验逻辑 |
| [run-validator.test.ts](file:///workspace/test/run-validator.test.ts) | 跑步数据验证 |
| [badge-integration.test.ts](file:///workspace/test/badge-integration.test.ts) | 徽章集成测试 |

### 11.3 运行测试

```bash
# 运行所有测试
npm test

# 生成覆盖率报告
npm run test:coverage
```

---

## 12. 项目运行与部署

### 12.1 本地开发环境搭建

**前置要求：**
- Node.js >= 20
- PostgreSQL (或使用 Supabase 云)
- 高德地图 API Key

**步骤：**

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 Supabase URL/Key、高德 Key 等

# 3. 生成 Prisma 客户端
npx prisma generate

# 4. 启动开发服务器
npm run dev
```

### 12.2 常用脚本命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint 检查 |
| `npm run type-check` | TypeScript 类型检查 |
| `npm test` | 运行测试 |
| `npx cap sync` | Capacitor 同步 |

---

## 13. 安全与性能

### 13.1 认证与授权

- **Supabase Auth**：基于 JWT 的认证
- **Middleware 保护**：拦截未认证请求
- **Server Actions 鉴权**：每个 Server Action 内部调用 `getUser()` 验证身份
- **RLS 策略**：行级安全策略，用户只能查看和修改自己的资料

### 13.2 性能优化措施

| 优化 | 实现 |
|------|------|
| **轨迹降维** | Ramer-Douglas-Peucker 算法 |
| **BBox 加速** | 领地包含检测使用边界框快速拒绝 |
| **服务端缓存** | `unstable_cache` + `cachedFetch` |
| **Revalidation Tags** | `revalidateTag` 精确失效 |
| **异步结算** | Trigger.dev 解耦长耗时领地结算 |

---

## 14. 依赖关系图

```
city-lord
├── next (15.5.12)                    # Web 框架
├── react (19.2.0)                   # UI 库
├── @capacitor/core (6.2.1)          # 移动端容器
├── @prisma/client (5.22.0)          # 数据库 ORM
├── @supabase/supabase-js (2.95.3)   # Supabase SDK
├── @turf/turf (7.3.3)               # GIS 计算
├── zustand (5.0.10)                 # 状态管理
├── framer-motion (12.29.2)          # 动画
├── @trigger.dev/sdk (4.4.4)         # 后台任务
├── zod (3.25.76)                    # 数据验证
├── tailwindcss (4.1.9)              # CSS 框架
└── lucide-react (0.454.0)           # 图标库
```

---

## 15. 开发规范

### 15.1 代码规范

- **TypeScript 严格模式**：`strict: true`，禁止使用 `any`
- **Prisma 类型**：所有模型引用必须使用生成的 Prisma 类型
- **错误处理**：所有异步逻辑必须包裹 `try/catch`
- **Hooks 规则**：Hooks 必须在组件顶层调用

### 15.2 移动端适配规范

- **原生能力检查**：涉及 Geolocation/Haptics 时，必须检查 `Capacitor.isNativePlatform()`
- **交互规范**：禁止使用 Hover 态作为核心功能触发点
- **安全区域 (Safe Area)**：所有页面必须适配刘海屏和底部手势条

### 15.3 Safe Area 实现规范

#### 工作原理

```typescript
// components/ClientShell.tsx#L29-54 - 注入 CSS 变量
document.documentElement.style.setProperty('--safe-top', `${topInset}px`);
document.documentElement.style.setProperty('--safe-bottom', `${bottomInset}px`);
```

#### 使用方式

| 场景 | 推荐写法 | 说明 |
|------|---------|------|
| 页面容器顶部 | `pt-[var(--safe-top,0px)]` | 适配刘海屏 |
| 固定头部 (sticky) | `top-[var(--safe-top,0px)]` | 导航栏适配 |
| 导航栏 + 间距 | `pt-[calc(var(--safe-top,0px)+8px)]` | 加额外间距 |
| 页面容器底部 | `pb-[calc(var(--safe-bottom,0px)+16px)]` | 适配底部手势条 |

#### 新页面模板

```tsx
export default function NewPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 固定导航栏 */}
      <div className="sticky top-[var(--safe-top,0px)] z-50 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
        {/* ... */}
      </div>

      {/* 主内容区域 */}
      <div className="pt-[var(--safe-top,0px)]">
        {/* ... */}
      </div>
    </div>
  )
}
```

#### 检查清单

- [ ] 页面顶部是否使用 `pt-[var(--safe-top,0px)]` 适配刘海屏
- [ ] 固定导航栏是否使用 `top-[var(--safe-top,0px)]`
- [ ] Admin 后台页面容器是否添加 `pt-[var(--safe-top,0px)]`
- [ ] 组件内部是否有独立的 sticky header 需要适配

### 15.4 地理计算规范

- **Turf.js 强制**：所有空间计算必须使用 Turf.js
- **常量约束**：
  - 闭环吸附阈值：20m
  - 最小领地面积：100 m²
  - 有效多边形最小点数：4