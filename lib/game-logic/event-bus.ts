/**
 * EventBus — 城市领主全局事件总线
 *
 * 单例模式（通过 globalThis 缓存，防止 Next.js HMR / Serverless 多实例问题）。
 * 所有跨系统联动通过此总线解耦。
 */

// ─── 事件类型枚举 ─────────────────────────────────────────────
export type GameEventType =
  | 'RUN_FINISHED'
  | 'MISSION_COMPLETED'
  | 'MISSION_CLAIMED'
  | 'LEVEL_UP'
  | 'TERRITORY_CAPTURED'
  | 'BADGE_EARNED'
  | 'ACTIVITY_COMPLETED'

// ─── 事件 Payload 定义（Discriminated Union）──────────────────
export interface RunFinishedPayload {
  type: 'RUN_FINISHED'
  userId: string
  runId: string
  distance: number        // meters
  duration: number        // seconds
  pace: number            // min/km
  capturedHexes: number
  newHexCount: number
  capturedHexIds: string[]
  startTime: Date
  endTime: Date
  regionId?: string
}

export interface MissionCompletedPayload {
  type: 'MISSION_COMPLETED'
  userId: string
  missionId: string
  missionCode: string
  rewards: { exp: number; coins: number }
}

export interface MissionClaimedPayload {
  type: 'MISSION_CLAIMED'
  userId: string
  missionId: string
  missionCode: string
  rewards: { exp: number; coins: number }
}

export interface LevelUpPayload {
  type: 'LEVEL_UP'
  userId: string
  oldLevel: number
  newLevel: number
  newTitle: string
}

export interface TerritoryCapturedPayload {
  type: 'TERRITORY_CAPTURED'
  userId: string
  territoryId: string
  isNew: boolean
}

export interface BadgeEarnedPayload {
  type: 'BADGE_EARNED'
  userId: string
  badgeId: string
  badgeCode: string
  badgeName: string
}

export interface ActivityCompletedPayload {
  type: 'ACTIVITY_COMPLETED'
  userId: string
  activityId: string
  clubId?: string // Optional as some activities might not be club-specific or handled differently
  isTopThree?: boolean
}

// 联合类型
export type GameEvent =
  | RunFinishedPayload
  | MissionCompletedPayload
  | MissionClaimedPayload
  | LevelUpPayload
  | TerritoryCapturedPayload
  | BadgeEarnedPayload
  | ActivityCompletedPayload

// 根据事件类型提取对应 Payload 的工具类型
export type EventPayload<T extends GameEventType> = Extract<GameEvent, { type: T }>

// ─── Handler 类型 ────────────────────────────────────────────
export type EventHandler<T extends GameEventType> = (
  payload: EventPayload<T>
) => Promise<void> | void

interface RegisteredHandler {
  name: string
  handler: (payload: any) => Promise<void> | void
}

// ─── 错误回调 ────────────────────────────────────────────────
export type ErrorCallback = (info: {
  eventType: GameEventType
  handlerName: string
  error: unknown
}) => void

const defaultOnError: ErrorCallback = ({ eventType, handlerName, error }) => {
  console.error(
    `[EventBus] Handler "${handlerName}" failed for event "${eventType}":`,
    error instanceof Error ? error.message : error
  )
}

// ─── EventBus 实现 ──────────────────────────────────────────
class EventBus {
  private handlers = new Map<GameEventType, RegisteredHandler[]>()
  private onError: ErrorCallback = defaultOnError

  /**
   * 注册事件监听器
   * @param type      事件类型
   * @param name      handler 名称（用于错误日志）
   * @param handler   异步或同步处理函数
   */
  on<T extends GameEventType>(
    type: T,
    name: string,
    handler: EventHandler<T>
  ): void {
    const list = this.handlers.get(type) ?? []
    list.push({ name, handler })
    this.handlers.set(type, list)
  }

  /**
   * 移除指定事件的指定 handler（按名称匹配）
   */
  off(type: GameEventType, name: string): void {
    const list = this.handlers.get(type)
    if (!list) return
    this.handlers.set(
      type,
      list.filter((h) => h.name !== name)
    )
  }

  /**
   * 触发事件：使用 Promise.allSettled 保证所有 handler 并行执行且互不阻断。
   * 失败的 handler 通过 onError 回调记录，不影响其他 handler。
   */
  async emit<T extends GameEventType>(event: EventPayload<T>): Promise<void> {
    const list = this.handlers.get(event.type)
    if (!list || list.length === 0) return

    const results = await Promise.allSettled(
      list.map(async ({ name, handler }) => {
        try {
          await handler(event)
        } catch (err) {
          // 抛出以让 allSettled 标记为 rejected，并在下面统一处理
          throw { handlerName: name, error: err }
        }
      })
    )

    for (const result of results) {
      if (result.status === 'rejected') {
        const { handlerName, error } = result.reason as {
          handlerName: string
          error: unknown
        }
        this.onError({ eventType: event.type, handlerName, error })
      }
    }
  }

  /**
   * 替换全局错误回调（用于测试或自定义日志服务）
   */
  setErrorHandler(cb: ErrorCallback): void {
    this.onError = cb
  }

  /**
   * 获取已注册的 handler 列表（调试用）
   */
  getHandlers(type: GameEventType): string[] {
    return (this.handlers.get(type) ?? []).map((h) => h.name)
  }

  /**
   * 清除所有注册的 handler（主要用于测试）
   */
  clearAll(): void {
    this.handlers.clear()
  }
}

// ─── 单例导出（globalThis 缓存，兼容 Next.js HMR / Serverless）────
const globalForEventBus = globalThis as unknown as { __eventBus: EventBus }

export const eventBus: EventBus =
  globalForEventBus.__eventBus || new EventBus()

if (process.env.NODE_ENV !== 'production') {
  globalForEventBus.__eventBus = eventBus
}
