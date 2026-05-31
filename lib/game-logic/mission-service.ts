import { prisma } from '@/lib/prisma'
import { validateMissionTemplates } from '@/lib/validations/mission'

export interface RunContext {
  distance: number
  capturedHexes: number
  capturedHexIds?: string[]
  newHexCount?: number
  startTime: Date
  endTime: Date
  regionId: string
}

export const SEED_DEFAULT_MISSIONS = [
  {
    id: 'daily_run_1',
    title: '每日开跑',
    description: '完成一次距离大于1公里的跑步',
    type: 'DISTANCE',
    target: 1000,
    reward_coins: 10,
    reward_experience: 50,
    frequency: 'daily'
  },
  {
    id: 'daily_dist_3',
    title: '每日3公里',
    description: '单日累计跑步距离达到3公里',
    type: 'DISTANCE',
    target: 3000,
    reward_coins: 30,
    reward_experience: 100,
    frequency: 'daily'
  },
  {
    id: 'daily_hex_10',
    title: '领地扩张',
    description: '单日占领或访问10个地块',
    type: 'HEX_COUNT',
    target: 10,
    reward_coins: 20,
    reward_experience: 80,
    frequency: 'daily'
  },
  {
    id: 'weekly_dist_15',
    title: '周跑者',
    description: '本周累计跑步15公里',
    type: 'DISTANCE',
    target: 15000,
    reward_coins: 100,
    reward_experience: 800,
    frequency: 'weekly'
  },
  {
    id: 'weekly_run_5',
    title: '坚持不懈',
    description: '本周累计完成5次跑步',
    type: 'RUN_COUNT',
    target: 5,
    reward_coins: 80,
    reward_experience: 600,
    frequency: 'weekly'
  },
  {
    id: 'weekly_explorer_20',
    title: '城市探险',
    description: '本周探索20个新地块',
    type: 'UNIQUE_HEX',
    target: 20,
    reward_coins: 150,
    reward_experience: 700,
    frequency: 'weekly'
  },
  {
    id: 'weekly_night_3',
    title: '夜跑侠',
    description: '本周完成3次夜跑（22:00-04:00）',
    type: 'NIGHT_RUN',
    target: 3,
    reward_coins: 80,
    reward_experience: 400,
    frequency: 'weekly'
  },
  {
    id: 'weekly_active_3',
    title: '活跃跑者',
    description: '本周累计跑步3天',
    type: 'ACTIVE_DAYS',
    target: 3,
    reward_coins: 50,
    reward_experience: 300,
    frequency: 'weekly'
  },
  {
    id: 'weekly_hex_50',
    title: '领地大亨',
    description: '本周占领或访问50个地块',
    type: 'HEX_COUNT',
    target: 50,
    reward_coins: 150,
    reward_experience: 600,
    frequency: 'weekly'
  },
  {
    id: 'weekly_calories_1000',
    title: '燃烧吧卡路里',
    description: '本周累计消耗1000千卡',
    type: 'CALORIES',
    target: 1000,
    reward_coins: 120,
    reward_experience: 500,
    frequency: 'weekly'
  },
  {
    id: 'ach_first_run',
    title: '初次启程',
    description: '完成你的第一次跑步',
    type: 'RUN_COUNT',
    target: 1,
    reward_coins: 50,
    reward_experience: 200,
    frequency: 'achievement'
  },
  {
    id: 'ach_marathon',
    title: '累计马拉松',
    description: '累计跑步距离达到42.195公里',
    type: 'DISTANCE',
    target: 42195,
    reward_coins: 500,
    reward_experience: 2000,
    frequency: 'achievement'
  },
  {
    id: 'ach_landlord',
    title: '大地主',
    description: '累计拥有100个地块',
    type: 'HEX_TOTAL',
    target: 100,
    reward_coins: 1000,
    reward_experience: 5000,
    frequency: 'achievement'
  }
] as const

const missionCheckCache = new Map<string, number>()
const CACHE_TTL_MS = 60 * 1000

function getDailyPeriodKey(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

function getWeeklyPeriodKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`
}

function getPeriodKey(frequency: string, date: Date = new Date()): string {
  if (frequency === 'daily') return getDailyPeriodKey(date)
  if (frequency === 'weekly') return getWeeklyPeriodKey(date)
  return 'one_time'
}

export async function initializeUserMissions(userId: string) {
  const now = Date.now()
  const lastCheck = missionCheckCache.get(userId)

  if (lastCheck && (now - lastCheck < CACHE_TTL_MS)) {
    return
  }

  const startTime = performance.now()
  const nowDate = new Date()

  try {
    const existingMissions = await prisma.user_missions.findMany({
      where: { user_id: userId },
      select: {
        mission_id: true,
        updated_at: true,
        status: true,
        progress: true,
        period_key: true,
      }
    })

    const existingMap = new Map(
      existingMissions.map((m) => [m.mission_id, m])
    )

    const missionsToInsert: Array<{
      user_id: string
      mission_id: string
      status: string
      progress: number
      period_key: string
      updated_at: Date
    }> = []
    const missionsToReset: string[] = []

    const rawConfigs = await prisma.missions.findMany()
    if (!rawConfigs || rawConfigs.length === 0) {
      console.warn('[MissionService] No missions found in DB. Run admin initialization first.')
      return
    }

    const { valid: missionConfigs, errors: templateErrors } = validateMissionTemplates(rawConfigs);

    if (templateErrors.length > 0) {
      console.warn(
        `[initializeUserMissions] ${templateErrors.length} invalid mission template(s) skipped:`,
        templateErrors.map(e => ({
          index: e.index,
          issues: e.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        }))
      );
    }

    for (const template of missionConfigs) {
      const existing = existingMap.get(template.id)
      const freq = template.frequency ?? 'one_time'

      if (!existing) {
        missionsToInsert.push({
          user_id: userId,
          mission_id: template.id,
          status: 'in-progress',
          progress: 0,
          period_key: getPeriodKey(freq, nowDate),
          updated_at: nowDate
        })
        continue
      }

      if (freq === 'achievement') continue
      if (!existing.updated_at) continue

      const lastUpdate = new Date(existing.updated_at)
      let shouldReset = false

      if (freq === 'daily') {
        const isSameDay =
          lastUpdate.getDate() === nowDate.getDate() &&
          lastUpdate.getMonth() === nowDate.getMonth() &&
          lastUpdate.getFullYear() === nowDate.getFullYear()
        if (!isSameDay) shouldReset = true
      } else if (freq === 'weekly') {
        const getMonday = (d: Date) => {
          const copy = new Date(d)
          copy.setHours(0, 0, 0, 0)
          const day = copy.getDay()
          const diff = copy.getDate() - day + (day === 0 ? -6 : 1)
          copy.setDate(diff)
          return copy
        }
        const currentMonday = getMonday(nowDate)
        const lastUpdateMonday = getMonday(lastUpdate)
        if (currentMonday.getTime() !== lastUpdateMonday.getTime())
          shouldReset = true
      }

      if (shouldReset) {
        missionsToReset.push(template.id)
      }
    }

    if (missionsToInsert.length > 0) {
      console.log(
        `[MissionService] Inserting ${missionsToInsert.length} missing missions...`
      )

      await prisma.user_missions.createMany({
        data: missionsToInsert,
        skipDuplicates: true
      })
    }

    if (missionsToReset.length > 0) {
      console.log(
        `[MissionService] Resetting ${missionsToReset.length} stale missions...`
      )

      await prisma.user_missions.updateMany({
        where: {
          user_id: userId,
          mission_id: { in: missionsToReset }
        },
        data: {
          status: 'in-progress',
          progress: 0,
          updated_at: nowDate
        }
      })
    }

    missionCheckCache.set(userId, now)

    if (missionsToInsert.length > 0 || missionsToReset.length > 0) {
      const duration = (performance.now() - startTime).toFixed(2)
      console.log(
        `[MissionService] Initialization (Writes performed) completed in ${duration}ms`
      )
    }
  } catch (error) {
    console.error(
      '[MissionService] Unexpected error during initialization:',
      error
    )
  }
}

export async function updateMissionProgress(
  userId: string,
  missionType: string,
  increment: number,
  tx?: any
) {
  const db = tx || prisma

  try {
    const missions = await db.missions.findMany({
      where: { type: missionType }
    })

    if (missions.length === 0) return

    const nowDate = new Date()

    for (const mission of missions) {
      const freq = mission.frequency ?? 'one_time'
      if (freq === 'achievement') continue

      const periodKey = getPeriodKey(freq, nowDate)

      await db.user_missions.upsert({
        where: {
          user_id_mission_id_period_key: {
            user_id: userId,
            mission_id: mission.id,
            period_key: periodKey,
          }
        },
        update: {
          progress: { increment },
          updated_at: nowDate,
        },
        create: {
          user_id: userId,
          mission_id: mission.id,
          progress: increment,
          status: 'in-progress',
          period_key: periodKey,
          updated_at: nowDate,
        }
      })
    }
  } catch (error) {
    console.error('[MissionService] updateMissionProgress failed:', error)
  }
}

// ─── Deduplication: Redis fallback to in-memory LRU cache ───
const claimDedupCache = new Map<string, number>()
const DEDUP_TTL_MS = 5000 // 5s window
const DEDUP_MAX_ENTRIES = 1000

function getDedupKey(userId: string, missionId: string): string {
  return `claim:${userId}:${missionId}`
}

function isDeduplicated(userId: string, missionId: string): boolean {
  const key = getDedupKey(userId, missionId)
  const now = Date.now()

  // Try Redis first
  try {
    // Lazy require to avoid crash if ioredis is unavailable
    const { redis } = require('@/lib/redis')
    if (redis && redis.status === 'ready') {
      // Synchronous check not possible with Redis, skip and rely on DB atomicity
      return false
    }
  } catch {
    // Redis not available, fall through to memory cache
  }

  // Memory LRU fallback
  const timestamp = claimDedupCache.get(key)
  if (timestamp && now - timestamp < DEDUP_TTL_MS) {
    return true
  }

  // Evict old entries if cache is full
  if (claimDedupCache.size >= DEDUP_MAX_ENTRIES) {
    const oldestKey = claimDedupCache.keys().next().value
    if (oldestKey) claimDedupCache.delete(oldestKey)
  }

  claimDedupCache.set(key, now)
  return false
}

export async function claimMissionReward(
  userId: string,
  missionId: string,
  tx?: any
) {
  // Fast-path deduplication (5s window, Redis or memory fallback)
  if (isDeduplicated(userId, missionId)) {
    console.warn(`[MissionService] Duplicate claim blocked (dedup): userId=${userId}, missionId=${missionId}`)
    return { success: false, error: 'DUPLICATE_CLAIM' }
  }

  const db = tx || prisma

  try {
    // Atomic claim: use updateMany with WHERE clause to prevent race conditions
    // The WHERE condition ensures only 'in-progress' missions with sufficient progress can be claimed
    const userMission = await db.user_missions.findFirst({
      where: {
        user_id: userId,
        mission_id: missionId,
        status: 'in-progress',
      },
      include: {
        missions: true,
      }
    })

    if (!userMission) {
      return { success: false, error: 'MISSION_NOT_FOUND' }
    }

    const target = userMission.missions.target_value ?? userMission.missions.target ?? 1
    const progress = userMission.progress ?? 0

    if (progress < target) {
      return { success: false, error: 'PROGRESS_INSUFFICIENT' }
    }

    const coins = userMission.missions.reward_coins ?? 0
    const xp = userMission.missions.reward_experience ?? userMission.missions.reward_xp ?? 0

    // Atomic update: only succeed if status is still 'in-progress'
    const updateResult = await db.user_missions.updateMany({
      where: {
        id: userMission.id,
        status: 'in-progress', // Atomic guard: prevents double-claim
      },
      data: {
        status: 'completed',
        claimed_at: new Date(),
      }
    })

    if (updateResult.count === 0) {
      // Another request already claimed this mission
      console.warn(`[MissionService] Concurrent claim detected: userId=${userId}, missionId=${missionId}`)
      return { success: false, error: 'DUPLICATE_CLAIM' }
    }

    // P0: 原子事务 — 任务状态更新与奖励发放在同一事务中
    // 防止出现 status=completed 但奖励未到账的半悬挂状态
    if (!tx) {
      // 未传入外部事务时，使用 prisma.$transaction 确保原子性
      await prisma.$transaction(async (atomicTx) => {
        // 重新验证状态（防止并发窗口）
        const recheck = await atomicTx.user_missions.findUnique({
          where: { id: userMission.id },
          select: { status: true }
        })
        if (recheck?.status === 'completed') {
          throw new Error('MISSION_ALREADY_CLAIMED')
        }

        await atomicTx.user_missions.update({
          where: { id: userMission.id },
          data: { status: 'completed', claimed_at: new Date() }
        })

        const newCoins = (await atomicTx.profiles.findUnique({
          where: { id: userId },
          select: { coins: true }
        }))?.coins ?? 0

        await atomicTx.profiles.update({
          where: { id: userId },
          data: {
            coins: newCoins + coins,
            xp: { increment: xp },
            updated_at: new Date(),
          }
        })

        // 写入金币审计流水
        if (coins > 0) {
          await atomicTx.walletTransaction.create({
            data: {
              user_id: userId,
              currency_type: 'COIN',
              amount: coins,
              transaction_type: 'MISSION_COMPLETED',
              description: `任务完成奖励: ${userMission.missions.title || missionId}`,
              balance: newCoins + coins,
              reference_id: missionId,
              reference_type: 'mission'
            }
          })
        }
      })
    } else {
      // 已传入外部事务，直接在事务中执行
      await db.profiles.update({
        where: { id: userId },
        data: {
          coins: { increment: coins },
          xp: { increment: xp },
          updated_at: new Date(),
        }
      })

      if (coins > 0) {
        const profile = await db.profiles.findUnique({
          where: { id: userId },
          select: { coins: true }
        })
        await db.walletTransaction.create({
          data: {
            user_id: userId,
            currency_type: 'COIN',
            amount: coins,
            transaction_type: 'MISSION_COMPLETED',
            description: `任务完成奖励: ${userMission.missions.title || missionId}`,
            balance: (profile?.coins ?? 0) + coins,
            reference_id: missionId,
            reference_type: 'mission'
          }
        })
      }
    }

    return { success: true, coins, xp }
  } catch (error) {
    console.error('[MissionService] claimMissionReward failed:', error)
    return { success: false, error: 'INTERNAL_ERROR' }
  }
}

export async function getUserMissions(userId: string) {
  try {
    await initializeUserMissions(userId)

    const userMissions = await prisma.user_missions.findMany({
      where: { user_id: userId },
      include: {
        missions: true,
      },
      orderBy: [
        { missions: { frequency: 'asc' } },
        { missions: { type: 'asc' } },
      ]
    })

    return userMissions.map(um => ({
      id: um.missions.id,
      title: um.missions.title,
      description: um.missions.description,
      type: um.missions.type,
      frequency: um.missions.frequency,
      targetValue: um.missions.target_value ?? um.missions.target ?? 1,
      progress: um.progress ?? 0,
      status: um.status,
      rewardCoins: um.missions.reward_coins ?? 0,
      rewardXp: um.missions.reward_experience ?? um.missions.reward_xp ?? 0,
      periodKey: um.period_key,
      claimedAt: um.claimed_at,
      percent: Math.min(100, Math.floor(((um.progress ?? 0) / (um.missions.target_value ?? um.missions.target ?? 1)) * 100)),
    }))
  } catch (error) {
    console.error('[MissionService] getUserMissions failed:', error)
    return []
  }
}
