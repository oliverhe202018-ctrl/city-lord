import { prisma } from '@/lib/prisma'
import { validateMissionTemplates } from '@/lib/validations/mission'

export interface RunContext {
  distance: number // km
  capturedHexes: number
  capturedHexIds?: string[] // List of hex IDs captured/interacted with
  newHexCount?: number // Count of "newly discovered" hexes (for Exploration missions)
  startTime: Date
  endTime: Date
  regionId: string // Province or city identifier for the run location
}

/**
 * 预设任务列表常量。
 * ⚠️ 警告: 该常量仅用于后台（Admin）管理界面的默认任务导入数据（Seed）。
 * 游戏运行时判定与用户进度更新必须直接读取数据库 missions 表的权威配置（Data Source of Truth）。
 */
export const SEED_DEFAULT_MISSIONS = [
  // Daily Missions
  {
    id: 'daily_run_1',
    title: '每日开跑',
    description: '完成一次任意距离的跑步',
    type: 'RUN_COUNT',
    target: 1,
    reward_coins: 10,
    reward_experience: 50,
    frequency: 'daily'
  },
  {
    id: 'daily_dist_3',
    title: '每日3公里',
    description: '单日累计跑步距离达到3公里',
    type: 'DISTANCE',
    target: 3000, // meters
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

  // Weekly Missions
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

  // Achievements
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
    type: 'HEX_TOTAL', // Check total owned hexes
    target: 100,
    reward_coins: 1000,
    reward_experience: 5000,
    frequency: 'achievement'
  }
] as const

// Simple in-memory cache to avoid redundant checks per request
// Map<userId, lastCheckTimestamp>
const missionCheckCache = new Map<string, number>()
const CACHE_TTL_MS = 60 * 1000 // 60 seconds

/**
 * Ensures that user has all required missions assigned and resets them if needed.
 * This implements the "Lazy Load" strategy with READ-FIRST optimization.
 *
 * Strategy:
 * 1. READ: Fetch all user missions first.
 * 2. MEMORY CHECK: Determine if any mission is missing or stale (needs daily/weekly reset).
 * 3. WRITE: Only perform DB writes if absolutely necessary.
 * 4. CACHE: Skip entire process if checked recently (60s).
 */
export async function initializeUserMissions(userId: string) {
  const now = Date.now()
  const lastCheck = missionCheckCache.get(userId)

  // 1. Caching Strategy: Skip if checked recently
  if (lastCheck && (now - lastCheck < CACHE_TTL_MS)) {
    return
  }

  const startTime = performance.now()
  const nowDate = new Date()

  try {
    // 2. READ FIRST: Fetch existing user missions via Prisma
    const existingMissions = await prisma.user_missions_deprecated.findMany({
      where: { user_id: userId },
      select: {
        mission_id: true,
        updated_at: true,
        status: true,
        progress: true
      }
    })

    // 3. MEMORY CHECK
    const existingMap = new Map(
      existingMissions.map((m) => [m.mission_id, m])
    )

    const missionsToInsert: Array<{
      user_id: string
      mission_id: string
      status: string
      progress: number
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

    // Check every template against existing data
    for (const template of missionConfigs) {
      const existing = existingMap.get(template.id)

      // A. Check for Missing
      if (!existing) {
        missionsToInsert.push({
          user_id: userId,
          mission_id: template.id,
          status: 'in-progress',
          progress: 0,
          updated_at: nowDate
        })
        continue
      }

      // B. Check for Stale (Reset Logic)
      const freq = template.frequency ?? 'one_time';
      if (freq === 'achievement') continue
      if (!existing.updated_at) continue // Defensive

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
        // Reset if the last update was in a previous week
        if (currentMonday.getTime() !== lastUpdateMonday.getTime())
          shouldReset = true
      }

      if (shouldReset) {
        missionsToReset.push(template.id)
      }
    }

    // 4. WRITE ONLY IF NEEDED

    // Handle Inserts (Missing Missions) — use skipDuplicates to be safe
    if (missionsToInsert.length > 0) {
      console.log(
        `[MissionService] Inserting ${missionsToInsert.length} missing missions...`
      )

      await prisma.user_missions_deprecated.createMany({
        data: missionsToInsert,
        skipDuplicates: true
      })
    }

    // Handle Resets (Stale Missions)
    if (missionsToReset.length > 0) {
      console.log(
        `[MissionService] Resetting ${missionsToReset.length} stale missions...`
      )

      await prisma.user_missions_deprecated.updateMany({
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

    // Cache only after entire flow succeeds (avoid 60s skip on partial failure)
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
