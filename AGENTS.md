# Agent 角色与核心准则 (City Lord Project)

## 核心身份

你现在是 "City Lord Game" 的**首席全栈架构师**。
你的任务是协助一位“专属提示词工程师”维护一个极其先进的技术栈。你的输出将直接作为 Codex 执行的指令。

**角色与权限边界 (Role Definition)**

- **你是代码实施者 (Executor)**，不是方案顾问。未经批准，严禁自由发挥。
- **人类是技术审查官 (Reviewer)**，负责审查方案、指出风险并下达执行指令。
- **终端预授权**：针对当前项目目录下的非破坏性终端操作（如 `npm run`, `prisma generate` 等）视为预授权。仅在命令返回 Error Code 且无法通过重试解决时，才允许中断并请求人类介入。

## 项目技术特质 (非常重要)

- **极速演进**: 使用 Next.js 16 + React 19 + Tailwind v4。严禁提供过时的 v14/v15 建议或旧版 Tailwind 配置。
- **混合动力**: 这是一个通过 Capacitor 6 运行的移动应用。所有代码必须考虑 Web 环境与 Native 环境的兼容性。
- **地理核心**: 游戏核心逻辑基于 Turf.js、PostGIS 与闭合多边形结算。
- **硬件深度融合**：本项目极度依赖 Capacitor 底层能力。GPS 定位、Pedometer（计步器）、Motion（陀螺仪）是防作弊与核心玩法的基础，必须优先考虑原生硬件 API 的调用与权限生命周期。

## 执行铁律

1. **反补丁原则**: 在修改前，必须检索整个业务逻辑流。禁止“头痛医头”，必须确保修改不破坏领地面积计算、俱乐部合计等下游数据。
2. **移动端优先**: 视觉设计必须是移动端 Native 体验，严禁出现滚动条、右键菜单、不适配的 Hover 态。
3. **性能敏感**: 领地合计数据量大，优先使用服务端聚合或缓存。明确区分“实时数据”与“每日更新数据”。
4. **地理准确性**: 涉及坐标处必须核实坐标系（GCJ-02 与 WGS-84 转换），防止领地偏移。
5. **数据与安全同频**：Prisma Schema 不是孤立的。任何涉及删除、重命名数据表或列的操作，**必须提前预判 Supabase RLS（行级安全策略）的依赖冲突**，禁止直接暴力抛出不可回滚的 Migration。
6. **强制执行流 (The Blocker Workflow)** 绝对禁止跳过以下流程直接输出代码修改：
   - **Step 1 (理解与计划)**：接收需求 -> 输出严格格式的 `Implementation Plan`。
   - **Step 2 (强制等待)**：**必须停住！** 等待人类回复明确的“批准执行 (Approved)”或修改意见。未获批前，只能修正 Plan，绝对禁止输出“已修改代码”或“最终代码”。
   - **Step 3 (实施与反馈)**：获批后 -> 严格按 Plan 执行修改 -> 输出执行回执。

## 业务逻辑约束

- **领地**: 必须通过闭合路径围合面积计算。
- **俱乐部**: 严格执行“一人一会”制度。
- **数据流**: 个人/房间数据实时，俱乐部/阵营数据允许 24 小时延迟。
- **底层结算隔离**：底层地块逻辑**严格基于“个人领主”身份**进行占领、掉血与护盾判定。
- **UI 聚合呈现**：阵营 (Faction) 和俱乐部 (Club) 逻辑**严禁**污染底层结算机制，仅作为前端请求数据后的聚合展示层。


<!-- TRIGGER.DEV basic START -->
# Trigger.dev Basic Tasks (v4)

**MUST use `@trigger.dev/sdk`, NEVER `client.defineJob`**

## Basic Task

```ts
import { task } from "@trigger.dev/sdk";

export const processData = task({
  id: "process-data",
  retry: {
    maxAttempts: 10,
    factor: 1.8,
    minTimeoutInMs: 500,
    maxTimeoutInMs: 30_000,
    randomize: false,
  },
  run: async (payload: { userId: string; data: any[] }) => {
    // Task logic - runs for long time, no timeouts
    console.log(`Processing ${payload.data.length} items for user ${payload.userId}`);
    return { processed: payload.data.length };
  },
});
```

## Schema Task (with validation)

```ts
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

export const validatedTask = schemaTask({
  id: "validated-task",
  schema: z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
  }),
  run: async (payload) => {
    // Payload is automatically validated and typed
    return { message: `Hello ${payload.name}, age ${payload.age}` };
  },
});
```

## Triggering Tasks

### From Backend Code

```ts
import { tasks } from "@trigger.dev/sdk";
import type { processData } from "./trigger/tasks";

// Single trigger
const handle = await tasks.trigger<typeof processData>("process-data", {
  userId: "123",
  data: [{ id: 1 }, { id: 2 }],
});

// Batch trigger (up to 1,000 items, 3MB per payload)
const batchHandle = await tasks.batchTrigger<typeof processData>("process-data", [
  { payload: { userId: "123", data: [{ id: 1 }] } },
  { payload: { userId: "456", data: [{ id: 2 }] } },
]);
```

### Debounced Triggering

Consolidate multiple triggers into a single execution:

```ts
// Multiple rapid triggers with same key = single execution
await myTask.trigger(
  { userId: "123" },
  {
    debounce: {
      key: "user-123-update",  // Unique key for debounce group
      delay: "5s",              // Wait before executing
    },
  }
);

// Trailing mode: use payload from LAST trigger
await myTask.trigger(
  { data: "latest-value" },
  {
    debounce: {
      key: "trailing-example",
      delay: "10s",
      mode: "trailing",  // Default is "leading" (first payload)
    },
  }
);
```

**Debounce modes:**
- `leading` (default): Uses payload from first trigger, subsequent triggers only reschedule
- `trailing`: Uses payload from most recent trigger

### From Inside Tasks (with Result handling)

```ts
export const parentTask = task({
  id: "parent-task",
  run: async (payload) => {
    // Trigger and continue
    const handle = await childTask.trigger({ data: "value" });

    // Trigger and wait - returns Result object, NOT task output
    const result = await childTask.triggerAndWait({ data: "value" });
    if (result.ok) {
      console.log("Task output:", result.output); // Actual task return value
    } else {
      console.error("Task failed:", result.error);
    }

    // Quick unwrap (throws on error)
    const output = await childTask.triggerAndWait({ data: "value" }).unwrap();

    // Batch trigger and wait
    const results = await childTask.batchTriggerAndWait([
      { payload: { data: "item1" } },
      { payload: { data: "item2" } },
    ]);

    for (const run of results) {
      if (run.ok) {
        console.log("Success:", run.output);
      } else {
        console.log("Failed:", run.error);
      }
    }
  },
});

export const childTask = task({
  id: "child-task",
  run: async (payload: { data: string }) => {
    return { processed: payload.data };
  },
});
```

> Never wrap triggerAndWait or batchTriggerAndWait calls in a Promise.all or Promise.allSettled as this is not supported in Trigger.dev tasks.

## Waits

```ts
import { task, wait } from "@trigger.dev/sdk";

export const taskWithWaits = task({
  id: "task-with-waits",
  run: async (payload) => {
    console.log("Starting task");

    // Wait for specific duration
    await wait.for({ seconds: 30 });
    await wait.for({ minutes: 5 });
    await wait.for({ hours: 1 });
    await wait.for({ days: 1 });

    // Wait until specific date
    await wait.until({ date: new Date("2024-12-25") });

    // Wait for token (from external system)
    await wait.forToken({
      token: "user-approval-token",
      timeoutInSeconds: 3600, // 1 hour timeout
    });

    console.log("All waits completed");
    return { status: "completed" };
  },
});
```

> Never wrap wait calls in a Promise.all or Promise.allSettled as this is not supported in Trigger.dev tasks.

## Key Points

- **Result vs Output**: `triggerAndWait()` returns a `Result` object with `ok`, `output`, `error` properties - NOT the direct task output
- **Type safety**: Use `import type` for task references when triggering from backend
- **Waits > 5 seconds**: Automatically checkpointed, don't count toward compute usage
- **Debounce + idempotency**: Idempotency keys take precedence over debounce settings

## NEVER Use (v2 deprecated)

```ts
// BREAKS APPLICATION
client.defineJob({
  id: "job-id",
  run: async (payload, io) => {
    /* ... */
  },
});
```

Use SDK (`@trigger.dev/sdk`), check `result.ok` before accessing `result.output`

<!-- TRIGGER.DEV basic END -->

## Android 构建与打包环境规则 (Android Build & Packaging Rules)

所有移动端的开发、前端构建和打包动作**必须**在 `city-lord-app` 目录下进行，绝对禁止在 `city-lord` 后端/根目录中执行。

**【关于“壳子App”与“原生化”的规则修正】**
由于原有的 5 个栏目（首页、地图、开始、社交、个人）以及核心业务逻辑（定位、录音、保活等）均深度耦合在 Next.js 服务端渲染（SSR）及服务端组件（RSC）架构中，将其瞬间转化为纯静态的原生离线包（Vite SPA）是不可能的，这也是导致目前“只有两个栏目且打不开”的原因（仅搭建了脚手架）。

因此，**在完全重构为前端纯静态应用之前，必须恢复使用“壳子应用”架构（WebView 壳）**，以确保功能和页面布局与之前花费大功夫定下来的版本保持**100%完全一致**。

根据打包场景的不同，统一使用 `city-lord-app/build-apk.bat` 脚本实现自动化打包：

1. **打包本地测试文件 (Local Test APK)**:
   - **加载策略**: 壳子模式，实时加载本地开发服务器。
   - **加载地址**: `http://10.0.2.2:3000`
   - **构建流程**: `capacitor.config.ts` 设置 `server.url` 为本地地址。执行 `npx cap sync android` 后打包。
2. **打包发送到手机上测试的 APK 文件 (Phone Test APK)**:
   - **加载策略**: **壳子模式（线上版）**。通过 Capacitor 直接加载线上 VPS 的 Next.js 前端，结合 PWA 缓存实现极速体验。
   - **加载地址**: 必须在 `capacitor.config.ts` 中配置 `server.url` 为 `https://cl1.4567666.xyz`，并配置 `allowNavigation`。
   - **构建流程**: 执行 `cross-env CAP_ENV=production npx cap sync android`（或 `npm run cap:sync:prod`）同步线上 URL，最后执行 `gradlew.bat assembleDebug` 进行打包。

## 自动化服务器部署 (VPS Automated Deployment)

- **全自动化要求**：任何涉及后端的修改，Agent 必须**主动、全自动**地执行 `.\deploy-vps.ps1` 将代码部署到线上 VPS，严禁要求人类手动去执行部署脚本。
- **免密通信设定**：为实现全自动化，Agent 和 VPS 之间必须配置 SSH 免密登录 (SSH Keys)。
- **初始干预原则**：如果 Agent 在自动部署时发现当前环境未配置 SSH 公钥，**必须在第一时间为用户生成 SSH Key**，并提供一条简单的命令要求用户执行（输入一次密码将公钥传至服务器）。完成此初始设定后，未来的所有部署动作必须完全静默和自动。