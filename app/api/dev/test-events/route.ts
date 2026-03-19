/**
 * 冒烟测试路由 — EventBus Phase 1
 *
 * GET /api/dev/test-events
 *
 * 验证能力：
 *   1. emit → handler 调用
 *   2. 多 handler 并行执行
 *   3. 单个 handler 失败不阻断其他 handler
 *
 * ⚠️ 仅限开发环境使用，生产环境应禁用。
 */

import { NextResponse } from 'next/server'
import { eventBus, type RunFinishedPayload, type GameEventType } from '@/lib/game-logic/event-bus'

export async function GET() {
  // 0. 安全检查
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 })
  }

  const logs: string[] = []
  const errors: string[] = []

  // 1. 清除已有 handler（隔离测试环境）
  eventBus.clearAll()

  // 2. 注册测试 handler
  eventBus.on('RUN_FINISHED', 'test_handler_success_1', async (payload) => {
    logs.push(`✅ handler_success_1: received RUN_FINISHED for user ${payload.userId}, distance=${payload.distance}m`)
  })

  eventBus.on('RUN_FINISHED', 'test_handler_success_2', async (payload) => {
    // 模拟异步操作
    await new Promise((resolve) => setTimeout(resolve, 50))
    logs.push(`✅ handler_success_2: async completed for run ${payload.runId}`)
  })

  eventBus.on('RUN_FINISHED', 'test_handler_should_fail', async () => {
    throw new Error('Simulated handler failure — this should NOT block other handlers')
  })

  eventBus.on('RUN_FINISHED', 'test_handler_success_3', async (payload) => {
    logs.push(`✅ handler_success_3: still running after failure! pace=${payload.pace}`)
  })

  // 3. 捕获错误回调
  eventBus.setErrorHandler(({ eventType, handlerName, error }) => {
    errors.push(`❌ [${eventType}] handler "${handlerName}" failed: ${error instanceof Error ? error.message : String(error)}`)
  })

  // 4. 触发事件
  const testEvent: RunFinishedPayload = {
    type: 'RUN_FINISHED',
    userId: 'test-user-001',
    runId: 'test-run-001',
    distance: 5000,
    duration: 1800,
    pace: 6.0,
    capturedHexes: 12,
    newHexCount: 5,
    capturedHexIds: ['hex-a', 'hex-b', 'hex-c'],
    startTime: new Date('2026-03-18T18:00:00+08:00'),
    endTime: new Date('2026-03-18T18:30:00+08:00'),
    regionId: 'shanghai',
  }

  await eventBus.emit(testEvent)

  // 5. 验证结果
  const successCount = logs.length
  const errorCount = errors.length
  const allPassed = successCount === 3 && errorCount === 1

  // 6. 测试空事件类型（无 handler 的情况）
  await eventBus.emit({
    type: 'LEVEL_UP',
    userId: 'test-user-001',
    oldLevel: 5,
    newLevel: 6,
    newTitle: 'Citizen',
  })
  logs.push('✅ Empty handler event (LEVEL_UP with no registered handler) completed without error')

  // 7. 测试 getHandlers API
  const registeredHandlers = eventBus.getHandlers('RUN_FINISHED')
  logs.push(`📋 Registered RUN_FINISHED handlers: ${registeredHandlers.join(', ')}`)

  // 8. 清理
  eventBus.clearAll()

  return NextResponse.json({
    status: allPassed ? 'ALL_TESTS_PASSED' : 'SOME_TESTS_FAILED',
    summary: {
      successfulHandlers: successCount,
      failedHandlers: errorCount,
      expectedSuccess: 3,
      expectedErrors: 1,
    },
    logs,
    errors,
  })
}
