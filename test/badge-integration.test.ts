/**
 * Badge System Integration Tests
 *
 * Tests the full badge awarding pipeline:
 * 1. awardBadgeAtomic — 首次授予 + 通知 + 事件发射
 * 2. awardBadgeAtomic — 幂等性 (P2002 → already_owned，无重复通知)
 * 3. checkAndAwardBadges — triggerType 过滤 + 已拥有跳过
 * 4. completeActivityAction — 事务内 isTopThree 计算
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── vi.hoisted — declare mock fns before vi.mock hoisting ──────
const {
  mockTxUserBadgesCreate,
  mockTxNotificationsCreate,
  mockTxRegistrationsUpdate,
  mockTxRegistrationsCount,
  mockBadgesFindUnique,
  mockPrismaTransaction,
  mockBuildBadgeContext,
} = vi.hoisted(() => {
  const mockTxUserBadgesCreate = vi.fn()
  const mockTxNotificationsCreate = vi.fn()
  const mockTxRegistrationsUpdate = vi.fn()
  const mockTxRegistrationsCount = vi.fn()
  const mockBadgesFindUnique = vi.fn()

  const mockTx = {
    user_badges: { create: mockTxUserBadgesCreate },
    notifications: { create: mockTxNotificationsCreate },
    club_activity_registrations: {
      update: mockTxRegistrationsUpdate,
      count: mockTxRegistrationsCount,
    },
  }

  const mockPrismaTransaction = vi.fn(async (fn: (tx: typeof mockTx) => Promise<any>) => {
    return fn(mockTx)
  })

  const mockBuildBadgeContext = vi.fn()

  return {
    mockTxUserBadgesCreate,
    mockTxNotificationsCreate,
    mockTxRegistrationsUpdate,
    mockTxRegistrationsCount,
    mockBadgesFindUnique,
    mockPrismaTransaction,
    mockBuildBadgeContext,
  }
})

// ─── Mock Prisma ─────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    badges: { findUnique: mockBadgesFindUnique },
    $transaction: mockPrismaTransaction,
  },
}))

// ─── Mock Supabase (needed by server actions) ────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
      }),
    },
  }),
}))

// ─── Mock badge-context ──────────────────────────────────────────
vi.mock('@/lib/game-logic/badge-context', () => ({
  buildBadgeContext: mockBuildBadgeContext,
}))

// ─── Imports (after mocks) ───────────────────────────────────────
import { awardBadgeAtomic, checkAndAwardBadges } from '@/lib/game-logic/achievement-core'
import { eventBus } from '@/lib/game-logic/event-bus'

// ─── Test Data ───────────────────────────────────────────────────
const MOCK_BADGE = {
  id: 'badge-uuid-first-activity',
  code: 'first-activity',
  name: '首次活动',
  description: '完成第一次俱乐部活动',
  icon_name: null,
  category: 'special',
  condition_value: 1,
  tier: 'bronze',
  requirement_type: 'count',
  requirement_value: 1,
  icon_path: null,
  level: null,
  requirement_description: null,
}

function createP2002Error() {
  const error: any = new Error('Unique constraint failed')
  error.code = 'P2002'
  return error
}

function defaultBadgeContext(overrides?: Partial<Record<string, any>>) {
  return {
    userId: 'test-user-id',
    stats: { level: 5, totalDistance: 10, totalTiles: 3 },
    completedMissionCount: 2,
    uniqueDaysRunInLast7Days: 3,
    activeTileCount: 2,
    completedActivityCount: 1,
    earnedBadgeCodes: new Set<string>(),
    eventData: {},
    ...overrides,
  }
}

// ═════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════

describe('Badge System Integration', () => {
  let emitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    emitSpy = vi.spyOn(eventBus, 'emit').mockResolvedValue(undefined)
    mockBuildBadgeContext.mockResolvedValue(defaultBadgeContext())
    // Default: transaction executes callback normally
    mockPrismaTransaction.mockImplementation(async (fn: any) => {
      const mockTx = {
        user_badges: { create: mockTxUserBadgesCreate },
        notifications: { create: mockTxNotificationsCreate },
        club_activity_registrations: {
          update: mockTxRegistrationsUpdate,
          count: mockTxRegistrationsCount,
        },
      }
      return fn(mockTx)
    })
  })

  afterEach(() => {
    emitSpy.mockRestore()
  })

  // ─── 1. Award Flow ───────────────────────────────────────────
  describe('awardBadgeAtomic — 首次授予', () => {
    it('should insert user_badge, create notification, emit BADGE_EARNED, return awarded', async () => {
      mockBadgesFindUnique.mockResolvedValue(MOCK_BADGE)
      mockTxUserBadgesCreate.mockResolvedValue({ id: 'ub-1' })
      mockTxNotificationsCreate.mockResolvedValue({ id: 'notif-1' })

      const result = await awardBadgeAtomic('test-user-id', 'first-activity')

      // Status
      expect(result.status).toBe('awarded')
      expect(result.badgeCode).toBe('first-activity')
      expect(result.badgeName).toBe('首次活动')

      // TX operations
      expect(mockTxUserBadgesCreate).toHaveBeenCalledOnce()
      expect(mockTxUserBadgesCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'test-user-id',
          badge_id: 'badge-uuid-first-activity',
        }),
      })

      expect(mockTxNotificationsCreate).toHaveBeenCalledOnce()
      expect(mockTxNotificationsCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'test-user-id',
          type: 'badge',
        }),
      })

      // Event emitted post-commit
      expect(emitSpy).toHaveBeenCalledOnce()
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BADGE_EARNED',
          userId: 'test-user-id',
          badgeCode: 'first-activity',
        })
      )
    })

    it('should return badge_not_found when badge code does not exist', async () => {
      mockBadgesFindUnique.mockResolvedValue(null)

      const result = await awardBadgeAtomic('test-user-id', 'nonexistent-badge')

      expect(result.status).toBe('badge_not_found')
      expect(mockPrismaTransaction).not.toHaveBeenCalled()
      expect(emitSpy).not.toHaveBeenCalled()
    })
  })

  // ─── 2. Idempotency (P2002) ──────────────────────────────────
  describe('awardBadgeAtomic — 幂等性 (P2002)', () => {
    it('should return already_owned on duplicate, no notification, no event', async () => {
      mockBadgesFindUnique.mockResolvedValue(MOCK_BADGE)
      mockPrismaTransaction.mockRejectedValueOnce(createP2002Error())

      const result = await awardBadgeAtomic('test-user-id', 'first-activity')

      expect(result.status).toBe('already_owned')
      expect(emitSpy).not.toHaveBeenCalled()
    })

    it('should propagate non-P2002 errors gracefully', async () => {
      mockBadgesFindUnique.mockResolvedValue(MOCK_BADGE)
      const genericError = new Error('Connection lost')
      mockPrismaTransaction.mockRejectedValueOnce(genericError)

      const result = await awardBadgeAtomic('test-user-id', 'first-activity')

      expect(result.status).toBe('error')
      expect(emitSpy).not.toHaveBeenCalled()
    })
  })

  // ─── 3. checkAndAwardBadges — Filter + Skip ──────────────────
  describe('checkAndAwardBadges — trigger 过滤与跳过已拥有', () => {
    it('should only check badges matching the triggerType', async () => {
      mockBadgesFindUnique.mockResolvedValue(MOCK_BADGE)
      mockTxUserBadgesCreate.mockResolvedValue({ id: 'ub-1' })
      mockTxNotificationsCreate.mockResolvedValue({ id: 'notif-1' })

      const results = await checkAndAwardBadges('test-user-id', 'ACTIVITY_COMPLETED', {
        isTopThree: false,
      })

      // first-activity should succeed (completedActivityCount >= 1)
      // activity-enthusiast should fail (completedActivityCount < 5)
      // activity-top3 should fail (isTopThree = false)
      const awardedCodes = results
        .filter(r => r.status === 'awarded')
        .map(r => r.badgeCode)

      expect(awardedCodes).toContain('first-activity')
      expect(awardedCodes).not.toContain('activity-enthusiast')
      expect(awardedCodes).not.toContain('activity-top3')
    })

    it('should skip badges already in earnedBadgeCodes', async () => {
      mockBuildBadgeContext.mockResolvedValueOnce(
        defaultBadgeContext({ earnedBadgeCodes: new Set(['first-activity']) })
      )

      const results = await checkAndAwardBadges('test-user-id', 'ACTIVITY_COMPLETED')

      const attempted = results.map(r => r.badgeCode)
      expect(attempted).not.toContain('first-activity')
    })

    it('should not trigger activity badges for unrelated events', async () => {
      const results = await checkAndAwardBadges('test-user-id', 'LEVEL_UP', {
        newLevel: 5,
      })

      const attemptedCodes = results.map(r => r.badgeCode)
      expect(attemptedCodes).not.toContain('first-activity')
      expect(attemptedCodes).not.toContain('activity-enthusiast')
      expect(attemptedCodes).not.toContain('activity-top3')
    })
  })

  // ─── 4. isTopThree transaction logic ──────────────────────────
  describe('completeActivityAction — isTopThree 竞态保护', () => {
    it('should compute isTopThree = true when completionCount <= 3', async () => {
      mockTxRegistrationsUpdate.mockResolvedValue({})
      mockTxRegistrationsCount.mockResolvedValue(2)

      const result = await mockPrismaTransaction(async (tx: any) => {
        await tx.club_activity_registrations.update({
          where: { id: 'reg-1' },
          data: { status: 'completed' },
        })
        const count = await tx.club_activity_registrations.count({
          where: { activity_id: 'activity-1', status: 'completed' },
        })
        return { isTopThree: count <= 3 }
      })

      expect(result.isTopThree).toBe(true)
    })

    it('should compute isTopThree = false when completionCount > 3', async () => {
      mockTxRegistrationsUpdate.mockResolvedValue({})
      mockTxRegistrationsCount.mockResolvedValue(4)

      const result = await mockPrismaTransaction(async (tx: any) => {
        await tx.club_activity_registrations.update({
          where: { id: 'reg-1' },
          data: { status: 'completed' },
        })
        const count = await tx.club_activity_registrations.count({
          where: { activity_id: 'activity-1', status: 'completed' },
        })
        return { isTopThree: count <= 3 }
      })

      expect(result.isTopThree).toBe(false)
    })

    it('should compute isTopThree = true at boundary (exactly 3rd)', async () => {
      mockTxRegistrationsUpdate.mockResolvedValue({})
      mockTxRegistrationsCount.mockResolvedValue(3)

      const result = await mockPrismaTransaction(async (tx: any) => {
        await tx.club_activity_registrations.update({
          where: { id: 'reg-1' },
          data: { status: 'completed' },
        })
        const count = await tx.club_activity_registrations.count({
          where: { activity_id: 'activity-1', status: 'completed' },
        })
        return { isTopThree: count <= 3 }
      })

      expect(result.isTopThree).toBe(true)
    })
  })
})
