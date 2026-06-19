import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ============================================================
// Task Definitions
// ============================================================

async function processStaminaRecovery() {
  const result = await prisma.$executeRaw`
    UPDATE public.profiles
    SET stamina = LEAST(max_stamina, stamina + 10),
        updated_at = NOW()
    WHERE stamina < max_stamina
      AND stamina IS NOT NULL
      AND max_stamina IS NOT NULL
  `;
  return { recoveredCount: result };
}

async function processTerritoryDecay() {
  const DECAY_AMOUNT = 20;
  const result = await prisma.$transaction(async (tx) => {
    const decayedRows = await tx.$queryRaw<
      Array<{ id: string; owner_id: string | null; old_health: number; new_health: number }>
    >`
      WITH candidates AS (
        SELECT id, owner_id, COALESCE(health, 0)::int AS old_health
        FROM public.territories
        WHERE COALESCE(health, 0) > 0
      )
      UPDATE public.territories
      SET health = GREATEST(0, candidates.old_health - ${DECAY_AMOUNT}),
          last_maintained_at = NOW()
      FROM candidates
      WHERE territories.id = candidates.id
      RETURNING territories.id, candidates.owner_id, candidates.old_health, COALESCE(territories.health, 0)::int AS new_health
    `;

    const lowHealthNotifications = decayedRows
      .filter((row) => row.owner_id && row.old_health >= 50 && row.new_health < 50 && row.new_health > 0)
      .map((row) => ({
        user_id: row.owner_id,
        sender_id: null,
        type: 'system',
        content: `你的领地 ${row.id} 生命值已降至 ${row.new_health}/100，请尽快前往巡逻修复。`,
        is_read: false,
      }));

    if (lowHealthNotifications.length > 0) {
      await tx.messages.createMany({ data: lowHealthNotifications });
    }

    const neutralizedRows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE public.territories
      SET owner_id = NULL, owner_faction = NULL, owner_club_id = NULL
      WHERE COALESCE(health, 0) <= 0
        AND (owner_id IS NOT NULL OR owner_faction IS NOT NULL OR owner_club_id IS NOT NULL)
      RETURNING id
    `;

    return {
      decayedCount: decayedRows.length,
      neutralizedCount: neutralizedRows.length,
    };
  });
  return result;
}

async function processLeaderboardSnapshot() {
  const TOP_N = 50;
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  const snapshotDate = new Date(Date.UTC(beijing.getFullYear(), beijing.getMonth(), beijing.getDate()));

  const rows = await prisma.$queryRaw<
    { user_id: string; district_code: string; total_area: number; nickname: string | null; avatar_url: string | null; rn: bigint }[]
  >`
    SELECT user_id, district_code, total_area, nickname, avatar_url, rn
    FROM (
      SELECT
        p.id AS user_id,
        p.district_code,
        p.total_area,
        p.nickname,
        p.avatar_url,
        ROW_NUMBER() OVER (PARTITION BY p.district_code ORDER BY p.total_area DESC) AS rn
      FROM profiles p
      WHERE p.is_active = true
        AND p.district_code IS NOT NULL
        AND p.total_area > 0
    ) ranked
    WHERE rn <= ${TOP_N}
  `;

  return { snapshotCount: rows.length, date: snapshotDate.toISOString() };
}

async function processProvinceStats() {
  const { updateProvinceStats } = await import('@/app/actions/leaderboard');
  const result = await updateProvinceStats();
  return { success: result.success, count: result.success ? result.count : 0 };
}

// ============================================================
// Task Registry
// ============================================================

const TASK_REGISTRY = {
  'stamina-recovery': processStaminaRecovery,
  'territory-decay': processTerritoryDecay,
  'leaderboard-snapshot': processLeaderboardSnapshot,
  'province-stats': processProvinceStats,
} as const;

type TaskKey = keyof typeof TASK_REGISTRY;

const HIGH_FREQ_TASKS: TaskKey[] = ['stamina-recovery'];
const LOW_FREQ_TASKS: TaskKey[] = ['territory-decay', 'leaderboard-snapshot', 'province-stats'];
const ALL_TASKS: TaskKey[] = [...HIGH_FREQ_TASKS, ...LOW_FREQ_TASKS];

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest) {
  // [P6] Fail-closed: CRON_SECRET 未配置时直接 503
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Cron disabled: CRON_SECRET not configured' }, { status: 503 });
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type');

  let tasksToRun: TaskKey[];

  if (typeParam) {
    if (typeParam === 'high-freq') {
      tasksToRun = HIGH_FREQ_TASKS;
    } else if (typeParam === 'low-freq') {
      tasksToRun = LOW_FREQ_TASKS;
    } else if (typeParam === 'all') {
      tasksToRun = ALL_TASKS;
    } else if (typeParam in TASK_REGISTRY) {
      tasksToRun = [typeParam as TaskKey];
    } else {
      return NextResponse.json(
        { error: `Unknown task type: ${typeParam}`, availableTypes: [...Object.keys(TASK_REGISTRY), 'high-freq', 'low-freq', 'all'] },
        { status: 400 }
      );
    }
  } else {
    tasksToRun = ALL_TASKS;
  }

  const startTime = Date.now();
  const results: Record<string, { status: string; data?: unknown; error?: string }> = {};

  const taskPromises = tasksToRun.map(async (taskKey) => {
    const taskFn = TASK_REGISTRY[taskKey];
    try {
      const data = await taskFn();
      return { key: taskKey, status: 'fulfilled', data };
    } catch (error) {
      console.error(`[process-tasks] Task ${taskKey} failed:`, error);
      return { key: taskKey, status: 'rejected', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  const settledResults = await Promise.allSettled(taskPromises);

  for (const result of settledResults) {
    if (result.status === 'fulfilled') {
      const { key, status, data, error } = result.value;
      results[key] = { status, data, error };
    } else {
      results['unknown'] = { status: 'rejected', error: result.reason };
    }
  }

  const executionTime = Date.now() - startTime;
  const successCount = Object.values(results).filter((r) => r.status === 'fulfilled').length;
  const failCount = Object.values(results).filter((r) => r.status === 'rejected').length;

  return NextResponse.json({
    success: failCount === 0,
    executionTimeMs: executionTime,
    tasksRequested: tasksToRun,
    results,
    summary: { total: tasksToRun.length, success: successCount, failed: failCount },
    timestamp: new Date().toISOString(),
  });
}
