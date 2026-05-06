# City Lord (城市领主) - Code Wiki

> 最后更新：2026-05-06
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
| **框架** | Next.js | 16.1.2 |
| **UI 库** | React | 19.2.1 |
| **样式** | Tailwind CSS | 4.x |
| **移动端容器** | Capacitor | 6.2.0 |
| **地图 SDK** | @amap/amap-jsapi-loader | 1.0.1 |
| **GIS 计算** | @turf/turf | 7.2.0 |
| **数据库 ORM** | Prisma | 5.22.0 |
| **数据库** | PostgreSQL (Supabase) | - |
| **认证** | Supabase Auth | v2 |
| **状态管理** | Zustand | 5.0.8 |
| **动画** | framer-motion | 12.23.11 |
| **后端任务队列** | Trigger.dev | v3 |
| **表单验证** | Zod | 3.25.61 |
| **H3 六边形索引** | h3-js | 4.1.0 |

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
Frontend Hook (useRunActivity)
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
d:\projects\city-lord\city-lord\
├── app/                          # Next.js App Router 路由与页面
│   ├── (auth)/                   # 认证路由组 (登录/注册/手机验证码)
│   ├── admin/                    # 后台管理面板
│   ├── actions/                  # Server Actions (业务逻辑)
│   ├── api/                      # API Routes (Edge/Middleware/健康检查)
│   ├── (game)/                   # 游戏核心路由组
│   │   ├── city/[cityId]/        # 城市领地页
│   │   ├── club/                 # 俱乐部页
│   │   ├── dashboard/            # 仪表盘
│   │   └── run/                  # 跑步页
│   ├── map/                      # 地图主页面
│   ├── profile/                  # 个人资料页
│   ├── social/                   # 社交功能页
│   ├── layout.tsx                # 根布局 (Providers/SafeArea)
│   └── page.tsx                  # 首页重定向
│
├── components/                   # React 组件
│   ├── citylord/                 # 业务核心组件
│   │   ├── run/                  # 跑步相关组件
│   │   ├── club/                 # 俱乐部组件
│   │   ├── notifications/        # 通知组件
│   │   └── social/               # 社交组件
│   ├── game/                     # 游戏 UI 组件
│   ├── map/                      # 地图渲染组件
│   ├── providers/                # Context Providers
│   │   ├── global-location.provider.tsx  # GPS 全局定位 Provider
│   │   └── auth-provider.tsx     # 认证 Provider
│   ├── shared/                   # 通用组件 (Button/Card/Modal)
│   ├── ui/                       # UI 基础组件 (Radix/UI)
│   └── auth/                     # 认证 UI
│
├── hooks/                        # 自定义 React Hooks
│   ├── useRun.ts                 # 跑步核心 Hook
│   ├── useMissions.ts            # 任务系统 Hook
│   ├── useRewardSettlement.ts    # 奖励结算 Hook
│   ├── useUserTerritorySummary.ts# 领地汇总 Hook
│   └── ... (40+ 自定义 Hooks)
│
├── lib/                          # 核心工具库与业务逻辑
│   ├── anti-cheat/               # 反作弊系统
│   │   ├── mvp-rules.ts          # 核心规则 (速度/步幅/瞬移检测)
│   │   ├── rate-limiter.ts       # 频率限制
│   │   ├── territory-builder.ts  # 轨迹重建与风险评估
│   │   └── validator.ts          # 元数据校验
│   ├── audio/                    # 音频处理
│   │   ├── AudioPlayer.ts        # 播放管理
│   │   ├── AudioPermissionManager.ts
│   │   ├── AudioStreamManager.ts
│   │   ├── AudioUploader.ts
│   │   └── VoiceMessageService.ts
│   ├── cache/                    # 服务端缓存
│   ├── constants/                # 常量定义
│   ├── game/                     # 游戏引擎
│   │   ├── achievement-engine.ts # 成就引擎
│   │   ├── leveling-system.ts    # 升级系统
│   │   ├── multiplier-engine.ts  # 倍率计算
│   │   ├── stamina-engine.ts     # 体力系统
│   │   ├── task-engine.ts        # 任务引擎
│   │   └── territory-engine.ts   # 领地引擎
│   ├── gis/                      # GIS 计算
│   │   ├── geometry-cleaner.ts   # 几何清理 (自交/碎片/降噪)
│   │   └── h3-calculator.ts      # H3 六边形索引
│   ├── services/                 # 服务层
│   │   ├── pushNotificationService.ts
│   │   └── territory-service.ts
│   ├── supabase/                 # Supabase 客户端
│   │   ├── client.ts             # 客户端实例 (带重试)
│   │   ├── server.ts             # 服务端实例 (带 Cookie 管理)
│   │   ├── admin.ts              # 管理员实例 (Service Role)
│   │   └── middleware.ts         # Supabase 中间件
│   ├── territory/                # 领地系统
│   │   ├── settlement.ts         # 领地结算引擎
│   │   └── shield-engine.ts      # 护盾系统
│   ├── utils/                    # 通用工具函数
│   │   ├── coord-transform.ts    # 坐标转换 (WGS-84 ↔ GCJ-02)
│   │   └── ...
│   ├── validators/               # 数据验证
│   │   ├── run-validator.ts      # 跑步数据验证
│   │   └── profile-schema.ts
│   ├── admin/                    # 后台管理模块
│   │   └── auth.ts               # 管理员认证
│   ├── map/                      # 地图工具
│   │   └── server-geocode.ts     # 服务端逆地理编码
│   ├── amap-location-bridge.ts   # 高德定位桥接层
│   ├── sms.ts                    # 短信服务
│   ├── constants.ts              # 全局常量
│   └── prisma.ts                 # Prisma 客户端
│
├── store/                        # Zustand 状态管理
│   ├── useGameStore.ts           # 游戏状态 (XP/Coin/任务)
│   ├── useLocationStore.ts       # 定位状态 (GPS/轨迹/后台状态)
│   ├── useMessageStore.ts        # 消息状态 (聊天/未读数)
│   ├── useNotificationStore.ts   # 通知状态
│   └── useProfileStore.ts        # 用户资料状态
│
├── prisma/                       # Prisma ORM
│   ├── schema.prisma             # 数据库 Schema 定义
│   ├── migrations/               # 数据库迁移文件
│   └── seed.ts                   # 种子数据
│
├── supabase/                     # Supabase 配置
│   ├── migrations/               # SQL 迁移
│   └── functions/                # Supabase Edge Functions
│       └── battle-notify/        # 战斗通知函数
│
├── trigger/                      # Trigger.dev 后台任务
│   └── tasks/
│       ├── settlement.ts         # 领地结算任务
│       └── club-decay.ts         # 俱乐部领地衰减任务
│
├── test/                         # 测试文件
│   └── anti-cheat-validation.test.ts
│
├── public/                       # 静态资源
│   └── assets/                   # 图片/音频等
│
├── types/                        # TypeScript 类型定义
│   ├── global.d.ts               # 全局类型声明
│   ├── run-sync.ts               # 跑步同步类型
│   ├── supabase.ts               # Supabase 数据库类型
│   ├── index.ts                  # 导出聚合
│   └── ...
│
├── capacitor.config.ts           # Capacitor 配置
├── trigger.config.ts             # Trigger.dev 配置
├── vitest.config.ts              # Vitest 测试配置
├── middleware.ts                 # Next.js 中间件
├── tailwind.config.js            # Tailwind 配置
├── next.config.ts                # Next.js 配置
├── package.json                  # 依赖与脚本
└── tsconfig.json                 # TypeScript 配置
```

---

## 4. 核心模块详解

### 4.1 领地结算系统 (Territory Settlement)

**核心文件：**
- [settlement.ts](file:///d:/projects/city-lord/city-lord/lib/territory/settlement.ts)
- [geometry-cleaner.ts](file:///d:/projects/city-lord/city-lord/lib/gis/geometry-cleaner.ts)
- [run-service.ts](file:///d:/projects/city-lord/city-lord/app/actions/run-service.ts)
- [settlement.ts (Trigger)](file:///d:/projects/city-lord/city-lord/trigger/tasks/settlement.ts)

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
| `MIN_TERRITORY_AREA_M2` | 50 m² | 最小有效领地面积 |
| `MAX_TERRITORY_AREA_M2` | 200,000 m² | 最大领地面积 |
| `MIN_ISO_RATIO` | 0.003 | 最小等周率（排除 L/U 形伪多边形） |
| `MIN_CONVEXITY_RATIO` | 0.55 | 最小凸包面积比 |

### 4.2 GPS定位与追踪系统 (GPS Location & Tracking)

**核心文件：**
- [useLocationStore.ts](file:///d:/projects/city-lord/city-lord/store/useLocationStore.ts)
- [global-location.provider.tsx](file:///d:/projects/city-lord/city-lord/components/providers/global-location.provider.tsx)
- [amap-location-bridge.ts](file:///d:/projects/city-lord/city-lord/lib/amap-location-bridge.ts)

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
| `handleBackgroundState()` | 后台模式处理 |

### 4.3 游戏化系统 (Gamification System)

**核心文件：**
- [useGameStore.ts](file:///d:/projects/city-lord/city-lord/store/useGameStore.ts)
- [task-engine.ts](file:///d:/projects/city-lord/city-lord/lib/game/task-engine.ts)
- [leveling-system.ts](file:///d:/projects/city-lord/city-lord/lib/game/leveling-system.ts)
- [achievement-engine.ts](file:///d:/projects/city-lord/city-lord/lib/game/achievement-engine.ts)
- [stamina-engine.ts](file:///d:/projects/city-lord/city-lord/lib/game/stamina-engine.ts)

**任务引擎 (`task-engine.ts`)：**

支持三种任务类型：
- `daily`：每日任务（如跑步1公里、占领3块领地）
- `weekly`：每周任务
- `achievement`：成就任务（一次性）

**升级系统 (`leveling-system.ts`)：**

- 升级公式：`nextLevelXP = currentMaxXP × 1.5`
- 支持连续升级
- 初始 XP 需求：50

**体力系统 (`stamina-engine.ts`)：**

- 体力用于特定操作消耗
- 通过突发事件奖励、每日恢复等途径补充

**倍率系统 (`multiplier-engine.ts`)：**

- 领地倍率计算
- 连续跑步倍率加成
- 俱乐部倍率加成

### 4.4 社交系统 (Social System)

**核心文件：**
- [useMessageStore.ts](file:///d:/projects/city-lord/city-lord/store/useMessageStore.ts)
- [message.ts](file:///d:/projects/city-lord/city-lord/app/actions/message.ts)
- [social.ts](file:///d:/projects/city-lord/city-lord/app/actions/social.ts)

**功能：**

- 私信系统（一对一聊天）
- 俱乐部群聊
- 消息实时订阅（Supabase Realtime）
- 未读消息统计
- 在线状态追踪

### 4.5 俱乐部系统 (Club System)

**核心文件：**
- [club.ts](file:///d:/projects/city-lord/city-lord/app/actions/club.ts)
- [club-service.ts](file:///d:/projects/city-lord/city-lord/app/actions/club-service.ts)
- [club-decay.ts](file:///d:/projects/city-lord/city-lord/trigger/tasks/club-decay.ts)

**俱乐部生命周期：**

1. **创建** → 状态 `pending`（待审核）
2. **审核** → Admin 批准 → 状态 `active`
3. **成员管理**：加入/退出/踢出/角色变更
4. **领地聚合**：成员领地合并为俱乐部总领地
5. **领地衰减**：定时任务执行 `club-decay`

**角色层级：**
`owner` > `vice_president` > `admin` > `elite` > `member`

**核心规则：**
- 一人一会（通过 `profiles.club_id` 约束）
- 退出/踢出时自动解绑俱乐部领地 (`detach_club_territories`)
- 会长无法直接退出（需转让或解散）

### 4.6 任务与成就系统 (Missions & Achievements)

**核心文件：**
- [useMissions.ts](file:///d:/projects/city-lord/city-lord/hooks/useMissions.ts)
- [achievement-engine.ts](file:///d:/projects/city-lord/city-lord/lib/game/achievement-engine.ts)
- [check-achievements.ts](file:///d:/projects/city-lord/city-lord/app/actions/check-achievements.ts)

**成就引擎机制：**

- `checkAndGrantAchievements()` 扫描所有已定义成就
- 使用 `Validated UserTaskLog` 进行幂等校验
- 成就奖励包括金币 (coins) 和经验值 (xp)

### 4.7 反作弊系统 (Anti-Cheat System)

**核心文件：**
- [mvp-rules.ts](file:///d:/projects/city-lord/city-lord/lib/anti-cheat/mvp-rules.ts)
- [run-validator.ts](file:///d:/projects/city-lord/city-lord/lib/validators/run-validator.ts)
- [territory-builder.ts](file:///d:/projects/city-lord/city-lord/lib/anti-cheat/territory-builder.ts)
- [rate-limiter.ts](file:///d:/projects/city-lord/city-lord/lib/anti-cheat/rate-limiter.ts)
- [validator.ts](file:///d:/projects/city-lord/city-lord/lib/anti-cheat/validator.ts)

**四层防线：**

| 防线 | 模块 | 检测项 |
|------|------|--------|
| 1 | `validateRunLegitimacy` | 速度 > 16.67m/s、平均速度 > 5m/s、步幅 > 3m |
| 2 | `validateRunData` | 步数 vs 距离校验、瞬移检测 |
| 3 | `validateRunAndRebuildTerritories` | 路径分析、虚拟定位检测 |
| 4 | 计步器校验 | 步数 < 100 拦截、步幅 > 1.5m 拦截 |

**Tester 白名单：**
通过 `isTester(userId)` 检查，白名单用户可绕过所有反作弊检测（用于开发测试）

**风险等级：**
- `LOW`：正常通过
- `MEDIUM`：多边形置空，不结算领地
- `HIGH`：拦截结算，记录审计日志

### 4.8 后台管理系统 (Admin Panel)

**核心文件：**
- `app/admin/` 页面路由
- [admin.ts](file:///d:/projects/city-lord/city-lord/app/actions/admin.ts)
- [admin-auth.ts](file:///d:/projects/city-lord/city-lord/app/actions/admin-auth.ts)
- [auth.ts](file:///d:/projects/city-lord/city-lord/lib/admin/auth.ts)

**功能：**
- 俱乐部审核（批准/拒绝）
- 用户管理
- 数据统计与报表
- 系统配置

### 4.9 推送系统 (Push Notification System)

**核心文件：**
- [pushNotificationService.ts](file:///d:/projects/city-lord/city-lord/lib/services/pushNotificationService.ts)
- [battle-notify](file:///d:/projects/city-lord/city-lord/supabase/functions/battle-notify/index.ts) (Supabase Edge Function)
- [notification-center.tsx](file:///d:/projects/city-lord/city-lord/components/citylord/notifications/notification-center.tsx)

**推送通道：**
- **FCM (Firebase Cloud Messaging)**：Android 推送
- **APNs (Apple Push Notification Service)**：iOS 推送
- **Supabase Notifications 表**：应用内通知
- **设备令牌管理**：`device_tokens` 表存储推送令牌

---

## 5. 数据库架构

### 5.1 核心数据表

#### profiles (用户资料)
```sql
profiles (
    id UUID PRIMARY KEY,              -- Supabase Auth UUID
    nickname VARCHAR,                  -- 昵称
    avatar_url TEXT,                   -- 头像 URL
    level INTEGER DEFAULT 1,           -- 等级
    xp INTEGER DEFAULT 0,              -- 经验值
    coins INTEGER DEFAULT 0,           -- 金币
    stamina INTEGER DEFAULT 100,       -- 体力
    total_distance_km DECIMAL,         -- 总跑步距离
    total_area DECIMAL,                -- 总领地面积
    total_runs_count INTEGER,          -- 总跑步次数
    faction_id UUID REFERENCES factions, -- 所属阵营
    club_id UUID REFERENCES clubs,     -- 所属俱乐部
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

#### runs (跑步记录)
```sql
runs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles,
    club_id UUID REFERENCES clubs,
    distance INTEGER,                  -- 跑步距离 (m)
    duration INTEGER,                  -- 持续时间 (s)
    area DECIMAL,                      -- 领地面积 (m²)
    path JSONB,                        -- 轨迹点数组
    polygons JSONB,                    -- 领地多边形
    status VARCHAR,                    -- settling/completed/flagged
    risk_score INTEGER,                -- 反作弊风险评分
    risk_level VARCHAR,                -- LOW/MEDIUM/HIGH
    cheat_flags JSONB,                 -- 作弊标记
    client_distance INTEGER,           -- 客户端报告距离
    is_flagged BOOLEAN,                -- 是否标记为异常
    flag_reason VARCHAR,               -- 拦截原因
    eventsLog JSONB,                   -- 突发事件日志
    totalSteps INTEGER,                -- 总步数
    isValid BOOLEAN,                   -- 是否有效
    antiCheatLog VARCHAR,              -- 反作弊日志
    new_territories_count INTEGER,     -- 新增领地数
    reinforced_territories_count INTEGER, -- 强化领地数
    ai_summary TEXT,                   -- AI 总结
    idempotency_key VARCHAR UNIQUE,    -- 幂等键
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

#### territories (领地)
```sql
territories (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles,
    club_id UUID REFERENCES clubs,
    city_id UUID REFERENCES cities,
    province VARCHAR,
    location GEOGRAPHY(POLYGON, 4326), -- PostGIS 几何
    polygon JSONB,                     -- 多边形坐标
    area DECIMAL,                      -- 面积 (m²)
    status VARCHAR,                    -- ACTIVE/DECAYING/LOST
    shield_expires_at TIMESTAMPTZ,     -- 护盾到期时间
    owner_faction_id UUID REFERENCES factions,
    source_run_id UUID REFERENCES runs,
    first_claimed_at TIMESTAMPTZ,
    last_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
```

#### clubs (俱乐部)
```sql
clubs (
    id UUID PRIMARY KEY,
    name VARCHAR UNIQUE,
    description TEXT,
    owner_id UUID REFERENCES profiles,
    avatar_url TEXT,
    level VARCHAR,                     -- 俱乐部等级
    rating DECIMAL,                    -- 评分
    member_count INTEGER,
    territory VARCHAR,                 -- 领地描述
    total_area DECIMAL,                -- 总面积
    status VARCHAR,                    -- pending/active/rejected
    audit_reason TEXT,                 -- 审核原因
    province VARCHAR,                  -- 省份
    is_public BOOLEAN DEFAULT true,    -- 是否公开
    created_at TIMESTAMPTZ
)
```

#### club_members (俱乐部成员)
```sql
club_members (
    club_id UUID REFERENCES clubs,
    user_id UUID REFERENCES profiles,
    role VARCHAR,                      -- owner/vice_president/admin/elite/member
    status VARCHAR,                    -- pending/active
    joined_at TIMESTAMPTZ,
    PRIMARY KEY (club_id, user_id)
)
```

#### user_task_logs (用户任务日志)
```sql
user_task_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles,
    run_id UUID REFERENCES runs,
    task_id VARCHAR,
    type VARCHAR,                      -- daily/weekly/achievement
    period_key VARCHAR,                -- 周期标识
    reward_coins INTEGER,
    reward_xp INTEGER,
    completed_at TIMESTAMPTZ
)
```

#### anti_cheat_audit_logs (反作弊审计日志)
```sql
anti_cheat_audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles,
    run_id UUID REFERENCES runs,
    risk_score INTEGER,
    cheat_flags JSONB,
    raw_payload JSONB,
    action_taken VARCHAR,
    created_at TIMESTAMPTZ
)
```

#### messages (消息)
```sql
messages (
    id UUID PRIMARY KEY,
    sender_id UUID REFERENCES profiles,
    user_id UUID REFERENCES profiles,
    type VARCHAR,                      -- dm/group/system
    content TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMPTZ
)
```

#### notifications (通知)
```sql
notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles,
    title VARCHAR,
    body TEXT,
    message TEXT,
    type VARCHAR,                      -- system/battle/club
    is_read BOOLEAN,
    created_at TIMESTAMPTZ
)
```

#### cities (城市)
```sql
cities (
    id UUID PRIMARY KEY,
    name VARCHAR UNIQUE,
    pinyin VARCHAR,
    adcode VARCHAR,
    center_lng DOUBLE PRECISION,
    center_lat DOUBLE PRECISION,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

#### user_city_progress (用户城市进度)
```sql
user_city_progress (
    user_id UUID REFERENCES profiles,
    city_id UUID REFERENCES cities,
    area_controlled DECIMAL,
    tiles_captured INTEGER,
    last_active_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, city_id)
)
```

### 5.2 枚举类型

| 枚举 | 值 |
|------|-----|
| `task_type` | `daily`, `weekly`, `achievement` |
| `risk_level` | `LOW`, `MEDIUM`, `HIGH` |
| `run_status` | `settling`, `completed`, `flagged` |
| `territory_status` | `ACTIVE`, `DECAYING`, `LOST` |
| `club_status` | `pending`, `active`, `rejected` |
| `member_role` | `owner`, `vice_president`, `admin`, `elite`, `member` |
| `member_status` | `pending`, `active` |
| `faction_id` | `f1`, `f2`, `f3` (三大阵营) |

### 5.3 核心关系说明

```
profiles ──┬── 1:N ── runs
           ├── 1:N ── territories
           ├── 1:1 ── user_city_progress
           ├── M:N ── club_members ── clubs
           └── N:1 ── factions

runs ──────┬── N:1 ── profiles (user_id)
           ├── N:1 ── clubs (club_id)
           └── 1:N ── territories (source_run_id)

territories ── N:1 ── profiles (user_id)
             ── N:1 ── clubs (club_id)
             ── N:1 ── cities (city_id)

club_members ── N:1 ── clubs (club_id)
              ── N:1 ── profiles (user_id)
```

---

## 6. 状态管理

### 6.1 Zustand Store 结构

#### useGameStore ([useGameStore.ts](file:///d:/projects/city-lord/city-lord/store/useGameStore.ts))

```typescript
interface GameStore {
    // 用户资料
    userProfile: {
        id: string
        nickname: string
        avatar_url: string
        level: number
        xp: number
        coins: number
        stamina: number
        total_distance_km: number
        total_runs_count: number
        faction_id: string
        club_id: string | null
    } | null

    // 任务系统
    availableTasks: { id: string; name: string; type: string; ... }[]
    availableAchievements: Achievement[]

    // 核心方法
    setUserProfile(profile)
    addCoins(amount)
    addXp(amount)
    addStamina(amount)
    setTasks(tasks)
}
```

#### useLocationStore ([useLocationStore.ts](file:///d:/projects/city-lord/city-lord/store/useLocationStore.ts))

```typescript
interface LocationStore {
    // 定位状态
    location: { lat: number; lng: number } | null
    accuracy: number | null
    speed: number | null

    // 追踪状态
    isTracking: boolean
    isRunActive: boolean
    isInBackground: boolean
    loading: boolean

    // 轨迹与数据
    currentRunDistance: number
    currentRunDuration: number
    locationHistory: Array<{lat: number; lng: number; timestamp: number}>
    lastUpdate: number

    // 高德 SDK
    amapInstance: any
    trackingMarker: any

    // 核心方法
    setLocation({lat, lng})
    startTracking()
    stopTracking()
    startRun()
    stopRun()
    addLocationToHistory(point)
    setAmamapInstance(map)
    handleBackgroundState()
    setTrackingError(error)
    warmupGPS()
}
```

#### useMessageStore ([useMessageStore.ts](file:///d:/projects/city-lord/city-lord/store/useMessageStore.ts))

```typescript
interface MessageStore {
    conversations: Map<string, Message[]>
    unreadCounts: Map<string, number>
    isTyping: Map<string, boolean>

    sendMessage(conversationId, content, type)
    receiveMessage(conversationId, message)
    markAsRead(conversationId)
    setTypingStatus(conversationId, isTyping)
    loadConversation(conversationId, messages)
}
```

#### useNotificationStore ([useNotificationStore.ts](file:///d:/projects/city-lord/city-lord/store/useNotificationStore.ts))

```typescript
interface NotificationStore {
    notifications: Notification[]
    unreadCount: number

    addNotification(notification)
    markAsRead(id)
    markAllAsRead()
    removeNotification(id)
    fetchNotifications(userId)
}
```

#### useProfileStore ([useProfileStore.ts](file:///d:/projects/city-lord/city-lord/store/useProfileStore.ts))

```typescript
interface ProfileStore {
    userProfile: UserProfile | null
    isLoading: boolean
    error: string | null

    fetchProfile(userId)
    updateProfile(data)
    clearProfile()
}
```

### 6.2 数据同步协议

- **离线优先**：GPS 轨迹和突发事件日志 (`eventsHistory`) 先在本地 Zustand/Storage 缓存
- **乐观更新**：跑步结束后立即显示奖励结果，后台异步验证
- **Revalidation**：Server Action 完成后调用 `revalidatePath` 和 `revalidateTag`
- **Trigger.dev 异步**：耗时操作（领地结算）通过后台任务解耦
- **幂等保证**：`idempotency_key` 防止重复提交

---

## 7. 自定义 Hooks

### 核心 Hooks 列表

| Hook | 文件路径 | 用途 |
|------|---------|------|
| `useRun` | `hooks/useRun.ts` | 跑步核心逻辑（开始/停止/轨迹记录） |
| `useMissions` | `hooks/useMissions.ts` | 任务获取与奖励处理 |
| `useRewardSettlement` | `hooks/useRewardSettlement.ts` | 奖励结算 UI 动画与弹窗 |
| `useUserTerritorySummary` | `hooks/useUserTerritorySummary.ts` | 用户领地统计汇总 |
| `useTerritorySettlement` | `hooks/useTerritorySettlement.ts` | 领地结算轮询 |
| `useStaminaTimer` | `hooks/useStaminaTimer.ts` | 体力倒计时 |
| `useCountdown` | `hooks/useCountdown.ts` | 通用倒计时 |
| `useRunHistory` | `hooks/useRunHistory.ts` | 跑步历史获取 |
| `useClub` | `hooks/useClub.ts` | 俱乐部数据获取 |
| `useClubChat` | `hooks/useClubChat.ts` | 俱乐部聊天 |
| `useUser` | `hooks/useUser.ts` | 用户信息 |
| `useAuth` | `hooks/useAuth.ts` | 认证状态 |
| `useGeolocation` | `hooks/useGeolocation.ts` | 定位获取 |
| `useMapSoundEffects` | `hooks/useMapSoundEffects.ts` | 地图音效播放 |
| `usePedometer` | `hooks/usePedometer.ts` | 计步器集成 |
| `useAppleWatchSync` | `hooks/useAppleWatchSync.ts` | Apple Watch 同步 |
| `useShareManager` | `hooks/useShareManager.ts` | 分享管理 |
| `useDynamicTheme` | `hooks/useDynamicTheme.ts` | 动态主题 |
| `useSafeArea` | `hooks/useSafeArea.ts` | 安全区域适配 |
| `useMobileCheck` | `hooks/useMobileCheck.ts` | 移动端检测 |

### Hook 详细说明

#### `useMissions`

```typescript
interface UseMissionsReturn {
    tasks: Task[]
    loading: boolean
    error: string | null
    hasClaimed: boolean
    rewardModalData: RewardModalData | null
    fetchTasks: () => Promise<void>
    processRewards: (tasks: Task[]) => Promise<void>
    setRewardModalData: (data: RewardModalData | null) => void
}
```

#### `useRewardSettlement`

```typescript
interface UseRewardSettlementReturn {
    isSettling: boolean
    settlementData: SettlementData | null
    hasSettled: boolean
    startSettlement: (runData) => void
    completeSettlement: () => void
}
```

---

## 8. Server Actions & API 路由

### 8.1 Server Actions 分组

| 分组 | 文件 | 主要功能 |
|------|------|---------|
| **认证** | [auth.ts](file:///d:/projects/city-lord/city-lord/app/actions/auth.ts), [sms-auth.ts](file:///d:/projects/city-lord/city-lord/app/actions/sms-auth.ts) | 登录/注册/手机验证码 |
| **跑步** | [run-service.ts](file:///d:/projects/city-lord/city-lord/app/actions/run-service.ts) | `saveRunActivity`, `getRunSettlementStatus`, `getTerritoriesByRunId` |
| **用户** | [user.ts](file:///d:/projects/city-lord/city-lord/app/actions/user.ts), [profile.ts](file:///d:/projects/city-lord/city-lord/app/actions/profile.ts) | 用户资料 CRUD |
| **俱乐部** | [club.ts](file:///d:/projects/city-lord/city-lord/app/actions/club.ts) | 创建/审核/加入/退出/管理 |
| **消息** | [message.ts](file:///d:/projects/city-lord/city-lord/app/actions/message.ts) | 私信发送/接收 |
| **社交** | [social.ts](file:///d:/projects/city-lord/city-lord/app/actions/social.ts), [social-service.ts](file:///d:/projects/city-lord/city-lord/app/actions/social-service.ts) | 社交互动 |
| **任务** | [task.ts](file:///d:/projects/city-lord/city-lord/app/actions/task.ts), [mission.ts](file:///d:/projects/city-lord/city-lord/app/actions/mission.ts) | 任务获取与奖励 |
| **成就** | [achievement.ts](file:///d:/projects/city-lord/city-lord/app/actions/achievement.ts), [check-achievements.ts](file:///d:/projects/city-lord/city-lord/app/actions/check-achievements.ts) | 成就检查与授予 |
| **领地** | [territory-report.ts](file:///d:/projects/city-lord/city-lord/app/actions/territory-report.ts), [territory-detail.ts](file:///d:/projects/city-lord/city-lord/app/actions/territory-detail.ts) | 领地统计与详情 |
| **城市** | [city.ts](file:///d:/projects/city-lord/city-lord/app/actions/city.ts) | 城市数据与排行榜 |
| **排行榜** | [leaderboard.ts](file:///d:/projects/city-lord/city-lord/app/actions/leaderboard.ts) | 城市/俱乐部排行 |
| **阵营** | [faction.ts](file:///d:/projects/city-lord/city-lord/app/actions/faction.ts) | 阵营加入/统计 |
| **徽章** | [badge.ts](file:///d:/projects/city-lord/city-lord/app/actions/badge.ts), [badge.actions.ts](file:///d:/projects/city-lord/city-lord/app/actions/badge.actions.ts) | 徽章系统 |
| **通知** | [notification.ts](file:///d:/projects/city-lord/city-lord/app/actions/notification.ts) | 通知管理 |
| **后台** | [admin.ts](file:///d:/projects/city-lord/city-lord/app/actions/admin.ts), [admin-auth.ts](file:///d:/projects/city-lord/city-lord/app/actions/admin-auth.ts) | 管理面板操作 |
| **账户** | [account.ts](file:///d:/projects/city-lord/city-lord/app/actions/account.ts) | 账户设置 |
| **手表** | [watch-sync.ts](file:///d:/projects/city-lord/city-lord/app/actions/watch-sync.ts) | Apple Watch 同步 |

### 8.2 主要 API 路由

| 路径 | 方法 | 功能 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/middleware` | ALL | Next.js 中间件 |
| `/api/auth/callback` | GET | Supabase 认证回调 |
| `/api/revalidate` | POST | 手动触发缓存刷新 |

---

## 9. 关键算法与工具函数

### 9.1 GIS 计算

#### Turf.js 使用场景

| 函数 | 用途 |
|------|------|
| `turf.area()` | 计算多边形面积 (m²) |
| `turf.length()` | 计算线长度 (km) |
| `turf.booleanPointInPolygon()` | 点是否在多边形内 |
| `turf.intersect()` | 多边形相交检测 |
| `turf.union()` | 多边形合并 |
| `turf.difference()` | 多边形差集 |
| `turf.unkinkPolygon()` | 解结（处理自交多边形） |
| `turf.convex()` | 凸包计算 |
| `turf.kinks()` | 检测自交点 |
| `turf.simplify()` | 简化几何 |
| `turf.buffer()` | 缓冲区 |
| `turf.bbox()` | 边界框 |

#### PostGIS 使用场景

- 存储空间几何数据 (`GEOGRAPHY(POLYGON, 4326)`)
- 空间查询与索引
- Haversine 距离计算（城市最近邻查询）

### 9.2 坐标转换

**文件：** [coord-transform.ts](file:///d:/projects/city-lord/city-lord/lib/utils/coord-transform.ts)

```typescript
// WGS-84 → GCJ-02 (高德坐标系)
function wgs84ToGcj02(lat: number, lng: number): [number, number]

// GCJ-02 → WGS-84 (GPS 坐标系)
function gcj02ToWgs84(lat: number, lng: number): [number, number]

// 批量转换
function convertLocations(locations: Location[]): Location[]
```

**常量：**
- 地球长半轴 `a = 6378245.0`
- 偏心率平方 `ee = 0.00669342162296594323`

### 9.3 几何清理

**文件：** [geometry-cleaner.ts](file:///d:/projects/city-lord/city-lord/lib/gis/geometry-cleaner.ts)

**cleanAndSplitTrajectory() 流程：**

1. 输入采样点坐标
2. 计算相邻点距离，标记跳跃点 (> 500m 视为异常)
3. 按跳跃点分割轨迹片段
4. 对每个片段执行闭环检测
5. 过滤无效多边形 (面积 < 50m² 或点数 < 4)

### 9.4 闭环检测

**文件：** [geometry-utils.ts](file:///d:/projects/city-lord/city-lord/lib/geometry-utils.ts)

**两种闭环策略：**

1. **首尾闭合**：起点与终点距离 ≤ 20m
2. **线段交叉闭合**：轨迹末端与路径中某线段距离 ≤ 15m（支持 P 形）

### 9.5 音频处理

**模块：** `lib/audio/`

| 文件 | 功能 |
|------|------|
| `AudioPlayer.ts` | 音频播放控制（播放/暂停/停止/音量） |
| `AudioPermissionManager.ts` | 音频权限管理 |
| `AudioStreamManager.ts` | 音频流管理 |
| `AudioUploader.ts` | 音频上传（用于语音消息） |
| `VoiceMessageService.ts` | 语音消息服务 |

---

## 10. 原生集成

### 10.1 Capacitor 插件体系

| 插件 | 用途 |
|------|------|
| `@capacitor/geolocation` | Web/原生 GPS 定位 |
| `@capacitor/haptics` | 触觉反馈 |
| `@capacitor/keyboard` | 键盘管理 |
| `@capacitor/status-bar` | 状态栏控制 |
| `@capacitor/app` | 应用生命周期 |
| `@capacitor/preferences` | 本地持久化存储 |
| `@capacitor/share` | 系统分享 |
| `cap-plugin-pedometer` | 计步器 |
| `@capacitor/health` | 健康数据 (iOS HealthKit) |
| `@capawesome/capacitor-health-connect` | Android Health Connect |
| `@capacitor-firebase/messaging` | Firebase 推送 |
| `@capacitor-community/native-audio` | 原生音频 |
| `capacitor-native-settings` | 系统设置跳转 |
| `capacitor-app-rate` | 应用评分 |
| `@capgo/foreground` | Android 前台服务 |
| `@capacitor-community/keep-awake` | 屏幕常亮 |

### 10.2 Android 特定集成

**自定义插件：** `android/app/src/main/java/com/citylord/app/AMapLocationPlugin.java`

- 高德 AMap 定位 SDK 桥接
- 支持高精度定位模式
- 后台位置权限处理

**前台服务：** `android/app/src/main/java/com/citylord/app/LocationForegroundService.java`

- 跑步期间保持后台定位
- 通知栏常驻提醒
- 电池优化处理

**关键配置：**
- `setGpsFirst(false)` — 避免 GPS 优先导致的延迟
- `setLocationCacheEnable(true)` — 启用缓存实现秒定位
- 定位间隔对齐：`1000ms` (browse/warmup 模式)

### 10.3 iOS 特定集成

- **HealthKit**：通过 `@capacitor/health` 插件获取步数、运动数据
- **APNs**：通过 Firebase Cloud Messaging 桥接推送
- **后台模式**：`UIBackgroundModes` 配置 location 和 fetch

### 10.4 健康数据集成

| 平台 | 插件 | 数据 |
|------|------|------|
| iOS | `@capacitor/health` | HealthKit (步数/卡路里/运动距离) |
| Android | `@capawesome/capacitor-health-connect` | Health Connect (步数/运动数据) |
| Web | 不可用 | 降级到计步器或手动输入 |

---

## 11. 测试策略

### 11.1 测试框架与配置

**框架：** Vitest + jsdom

**配置文件：** [vitest.config.ts](file:///d:/projects/city-lord/city-lord/vitest.config.ts)

```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
})
```

### 11.2 已有测试文件

| 文件 | 测试内容 |
|------|---------|
| [anti-cheat-validation.test.ts](file:///d:/projects/city-lord/city-lord/test/anti-cheat-validation.test.ts) | 反作弊校验逻辑 |

### 11.3 如何运行测试

```bash
# 运行所有测试
npm test

# 运行测试（Watch 模式）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

---

## 12. 项目运行与部署

### 12.1 本地开发环境搭建

**前置要求：**
- Node.js >= 20
- npm/pnpm
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

# 4. 数据库迁移
npx prisma migrate dev

# 5. 启动开发服务器
npm run dev

# 6. (可选) 构建 Capacitor 应用
npm run build
npx cap sync
```

### 12.2 常用脚本命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 (port 3000) |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查 (`tsc --noEmit`) |
| `npm run prisma:generate` | 生成 Prisma 客户端 |
| `npm run prisma:migrate` | 运行数据库迁移 |
| `npm run test` | 运行 Vitest 测试 |
| `npm run cap:sync` | Capacitor 同步 |
| `npm run cap:android` | 打开 Android Studio |
| `npm run cap:ios` | 打开 Xcode |
| `npm run cap:open:android` | 打开 Android 项目 |

### 12.3 环境变量说明

**核心变量：**

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |
| `NEXT_PUBLIC_AMAP_KEY` | 高德地图 Web API Key |
| `AMAP_KEY` | 高德地图服务端 API Key |
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `DIRECT_URL` | 直连数据库 URL (Prisma Migrate) |
| `NEXT_PUBLIC_AMAP_SECURITY_CODE` | 高德安全码 |
| `NEXT_PUBLIC_TRIGGER_PUBLIC_KEY` | Trigger.dev 公钥 |
| `TRIGGER_SECRET_KEY` | Trigger.dev 密钥 |

### 12.4 Vercel 部署说明

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 构建配置：
   - Build Command: `next build`
   - Output Directory: `.next`
4. 部署后自动配置 HTTPS 和 CDN

### 12.5 Capacitor 构建说明

```bash
# 1. 构建 Next.js
npm run build

# 2. 同步到原生项目
npx cap sync

# 3. 打开 Android Studio
npx cap open android

# 4. 打开 Xcode (macOS)
npx cap open ios

# 5. 在原生 IDE 中构建并运行
```

---

## 13. 安全与性能

### 13.1 认证与授权

- **Supabase Auth**：基于 JWT 的认证
- **Middleware 保护**：[middleware.ts](file:///d:/projects/city-lord/city-lord/middleware.ts) 拦截未认证请求
- **Server Actions 鉴权**：每个 Server Action 内部调用 `getUser()` 验证身份
- **管理员认证**：[auth.ts](file:///d:/projects/city-lord/city-lord/lib/admin/auth.ts) - 独立的 Admin 权限检查

### 13.2 RLS 策略 (Row Level Security)

- Supabase PostgreSQL 启用 RLS
- `profiles` 表：用户只能查看和修改自己的资料
- `runs` 表：用户只能查看自己的跑步记录
- `territories` 表：领地可见性策略
- 管理员使用 Service Role Key 绕过 RLS

### 13.3 性能优化措施

| 优化 | 实现 |
|------|------|
| **轨迹降维** | Ramer-Douglas-Peucker 算法，500+ 点自动压缩 |
| **BBox 加速** | 领地包含检测使用边界框快速拒绝 |
| **服务端缓存** | `unstable_cache` + `cachedFetch` 缓存俱乐部详情等 |
| **Revalidation Tags** | `revalidateTag` 精确失效 |
| **异步结算** | Trigger.dev 解耦长耗时领地结算 |
| **离线优先** | Zustand 本地缓存，网络恢复后同步 |
| **图片优化** | Next.js Image 组件 + Supabase CDN |

### 13.4 离线优先策略

- **GPS 轨迹**：本地 `locationHistory` 数组存储
- **突发事件**：`eventsHistory` 本地缓存
- **乐观更新**：跑步完成立即显示奖励
- **断网处理**：核心数据先存本地，恢复网络后补传
- **防打扰 UI**：使用 Modal 而非全屏阻断

---

## 14. 依赖关系图

### 14.1 核心依赖及其用途

```
city-lord
├── next (16.1.2)                    # Web 框架
├── react (19.2.1)                   # UI 库
├── @capacitor/core (6.2.0)          # 移动端容器
├── @prisma/client (5.22.0)          # 数据库 ORM
├── @supabase/supabase-js (2.48.1)   # Supabase SDK
├── @turf/turf (7.2.0)               # GIS 计算
├── zustand (5.0.8)                  # 状态管理
├── framer-motion (12.23.11)         # 动画
├── h3-js (4.1.0)                    # H3 六边形索引
├── @trigger.dev/sdk (3.3.16)        # 后台任务
├── zod (3.25.61)                    # 数据验证
├── tailwindcss (4.0.7)              # CSS 框架
├── lucide-react (0.475.0)           # 图标库
├── recharts (2.15.1)                # 图表库
├── axios (1.13.0)                   # HTTP 客户端
├── date-fns (4.1.0)                 # 日期处理
└── sonner (2.0.2)                   # Toast 通知
```

### 14.2 原生依赖

| 依赖 | 用途 |
|------|------|
| `@amap/amap-jsapi-loader` | 高德地图 Web SDK |
| `cap-plugin-pedometer` | 计步器 |
| `@capacitor-firebase/messaging` | 推送通知 |
| `@capgo/foreground` | Android 前台服务 |
| `@capawesome/capacitor-health-connect` | Android 健康数据 |
| `@capacitor/health` | iOS HealthKit |
| `@capacitor-community/native-audio` | 原生音频 |

---

## 15. 开发规范

### 15.1 代码规范

- **TypeScript 严格模式**：`strict: true`，禁止使用 `any`
- **Prisma 类型**：所有模型引用必须使用生成的 Prisma 类型
- **错误处理**：所有异步逻辑必须包裹 `try/catch`，提供用户友好的错误提示
- **水化保护**：涉及浏览器 API 的组件必须挂载检查或 dynamic import
- **Hooks 规则**：绝对禁止在条件语句或提前返回后调用 Hooks

### 15.2 Git 工作流

- **分支策略**：`main` (生产) → `develop` (开发) → `feature/*` (功能)
- **提交信息**：使用 Conventional Commits 格式
- **PR 要求**：每个 PR 需通过 typecheck 和 lint 检查

### 15.3 AI 协作规范

**强制输出模板：**

**Phase 1: Implementation Plan (获批前)**
- 🎯 目标理解
- 🔍 问题判断
- 📂 计划修改文件
- 🛠️ 逐文件修改点
- 🚧 权限/平台边界
- ⚠️ 风险点
- ✅ 验收步骤
- ⏳ 待审批项

**Phase 2: Code Execution (获批后)**
- 📩 审批结果回执
- 📂 实际修改文件
- 💻 逐文件 Diff
- 🧠 关键逻辑说明
- 🔙 风险与回滚点
- ✅ 验收清单

**AI 自检清单：**
1. 修改后是否引入新的类型报错？
2. 修改后是否会导致移动端滑动卡顿或样式崩溃？
3. 是否遵循了架构完整性原则？
4. 涉及的 Prisma 字段是否被 RLS 策略锁定？
5. 新增的 React Hooks 是否位于组件最顶层？
6. 涉及位置或步数更新的逻辑，是否处理了断网/杀后台场景？

### 15.4 地理计算铁律

- **禁止手动循环**：永远不要使用 `for/while` 进行多边形自交/点是否在多边形内的计算
- **必须使用 Turf.js**：所有空间计算统一使用 `@turf/turf`
- **坐标转换**：GCJ-02 与 WGS-84 转换逻辑严禁随意改动
- **闭环吸附容差**：固定 `20m`
- **最小领地面积**：固定 `100 m²`（实际代码使用 50m² 作为过滤阈值）
- **GeoJSON 多边形**：最小点数为 4（起点和终点必须相同）

### 15.5 移动端适配

- **Safe Area**：所有页面必须适配刘海屏和底部手势条
- **无 Hover 依赖**：禁止使用 Hover 态作为核心功能触发点
- **离线优先**：跑步和地理结算随时可能断网
- **防打扰 UI**：使用 Modal 而非全屏阻断

---

*本文档基于实际代码库生成，建议随项目演进定期更新。*
