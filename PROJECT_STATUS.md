# City Lord - 项目现状说明文档

**文档生成时间**: 2026-02-01  
**项目版本**: v0.1.0 (Alpha)

## 1. 项目概况 (Overview)

**City Lord** 是一款结合 **LBS (地理位置服务)** 与 **Gamification (游戏化)** 的跑步社交应用。用户通过在现实世界中移动来占领虚拟地图上的六边形地块 (Hexagons)，通过积累地块面积、提升等级、完成任务和收集勋章来建立自己的“城市领地”。

### 核心价值主张
- **运动游戏化**: 将枯燥的跑步转化为领地扩张游戏。
- **社交互动**: 实时查看好友在线状态、领地动态，支持组队与挑战。
- **成就系统**: 通过丰富的勋章和任务体系激励用户持续运动。

---

## 2. 技术架构 (Technical Architecture)

### 前端 (Frontend)
- **框架**: [Next.js 14+ (App Router)](https://nextjs.org/) - 利用 Server Components 和 Server Actions 实现高效的数据交互。
- **UI 库**: React 19, [Tailwind CSS v4](https://tailwindcss.com/), Shadcn/UI (基于 Radix UI)。
- **地理空间算法**: [H3-js](https://github.com/uber/h3-js) - Uber 开源的六边形分层索引系统，用于处理地图网格。
- **地图渲染**: AMap (高德地图) / 自定义 SVG / Canvas 混合渲染。
- **状态管理**: 
  - 全局: React Context (`CityContext`, `AuthContext`).
  - 局部/轻量: `useState`, `useReducer`.
  - 持久化: `zustand` (用于游戏设置等).
- **交互与动画**: Framer Motion (页面过渡与微交互), Sonner (Toast 通知).

### 后端 (Backend) & 数据库 (Database)
- **BaaS**: [Supabase](https://supabase.com/)
  - **Auth**: 处理用户注册、登录、Session 管理。
  - **Database**: PostgreSQL，存储用户数据、地理信息、社交关系。
  - **Realtime**: (计划中) 用于实时位置共享和领地变更推送。
  - **Edge Functions / RPC**: 处理复杂的数据库事务（如用户初始化、领地结算）。

---

## 3. 功能模块进度 (Feature Status)

### ✅ 已完成 (Completed)

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

### 🚧 进行中 (In Progress)
- [ ] **任务系统自动化**: 虽然数据结构已就绪，但每日/每周任务的自动重置和进度检查尚未完全闭环。
- [ ] **排行榜**: 基础 UI 已有，需完善基于 `user_city_progress` 的实时排序逻辑。
- [ ] **地图性能优化**: 大量六边形渲染时的性能调优。

### 📅 待开发 (Planned)
- [ ] **俱乐部/工会系统**: 创建、加入、公会领地战。
- [ ] **实时对战**: 抢夺他人领地时的实时通知与反击机制。
- [ ] **商城系统**: 消耗金币购买道具（如：迷雾驱散卡、双倍经验卡）。

---

## 4. 数据库架构概览

主要表结构 (`public` schema):

| 表名 | 描述 | 关键字段 |
| :--- | :--- | :--- |
| `profiles` | 用户基础信息 | `id`, `nickname`, `level`, `current_exp`, `total_area` |
| `territories` | 领地数据 | `id` (H3 Index), `owner_id`, `city_id` |
| `user_city_progress` | 用户在特定城市的进度 | `user_id`, `city_id`, `tiles_captured`, `area_controlled` |
| `badges` | 勋章定义 | `code`, `condition_value`, `category`, `icon_name` |
| `user_badges` | 用户获得的勋章 | `user_id`, `badge_id`, `earned_at` |
| `missions` | 任务定义 | `type`, `target`, `frequency`, `reward_coins` |
| `user_missions` | 用户任务进度 | `status`, `progress`, `claimed_at` |

---

## 5. 当前关键问题与解决方案

| 问题描述 | 状态 | 解决方案 |
| :--- | :--- | :--- |
| **Supabase 类型推断错误** | ✅ 已解决 | 手动在 `types/supabase.ts` 中补全 `Relationships` 定义，修复 Join 查询时的 `never` 类型问题。 |
| **GPS 信号漂移导致重复占领** | ✅ 已解决 | 前端引入 `lastClaimedHex` 状态，并在后端 `claimTerritory` 中做幂等性检查 (Upsert)。 |
| **勋章图标缺失** | ✅ 已解决 | 创建 `BadgeIcon` 映射组件，将数据库中的字符串标识符转换为 React 组件。 |
| **新用户无初始数据** | ✅ 已解决 | 实现 `init_user_game_data` RPC，并在 Auth Callback 中自动调用，确保新用户有初始任务和属性。 |

---

## 6. 下一步开发建议

1.  **完善任务检查器 (Mission Checker)**:
    *   目前勋章检查已集成，建议将任务进度检查 (`checkMissionProgress`) 也集成到 `claimTerritory` 和 `stopRunning` 动作中。
2.  **增强地图交互**:
    *   添加“长按查看领地详情”功能。
    *   实现“迷雾系统”，未探索区域显示为迷雾。
3.  **部署准备**:
    *   配置 Vercel 环境变量。
    *   运行完整的 E2E 测试流程。
