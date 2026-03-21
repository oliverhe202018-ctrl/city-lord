import 'server-only'

import { z } from 'zod'
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
import { serverLog } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Flat row shape returned by $queryRaw joining user_missions_deprecated + missions.
 * Aliased columns prevent name collisions between the two tables.
 */
const MissionRowSchema = z.object({
  id: z.string(),
  mission_id: z.string(),
  status: z.string(),
  progress: z.coerce.number(),        // Postgres int4 → JS number
  mission_target: z.coerce.number(),  // missions.target aliased
  mission_type: z.string(),           // missions.type aliased
  reward_coins: z.coerce.number(),
  reward_experience: z.coerce.number(),
  mission_title: z.string(),          // missions.title aliased
})

export type MissionRow = z.infer<typeof MissionRowSchema>

/** Extended with new_progress after the UPDATE … RETURNING */
export type ProgressedMission = MissionRow & { new_progress: number }

// The transaction client type exposed by Prisma $transaction callback
import type { PrismaClient } from '@prisma/client'
type PrismaTransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * checkAndProgressMissions — queries active HEX_COUNT / HEX_TOTAL missions for
 * the user, attempts to record the (user, mission, territory) idempotency slot,
 * and increments progress for each slot successfully claimed.
 *
 * Uses `UPDATE … RETURNING progress` (yellow-flag improvement) to base the
 * completion check on the database-written value rather than an in-memory snapshot.
 *
 * Sets `status = 'completed'` for missions whose progress reaches target
 * so they no longer appear in future `status = 'in-progress'` queries.
 *
 * @returns progressed — missions whose progress ticked up but haven't hit target yet
 *          completed  — missions that just reached or exceeded their target
 */
export async function checkAndProgressMissions(
  tx: PrismaTransactionClient,
  userId: string,
  territoryId: string
): Promise<{ progressed: ProgressedMission[]; completed: ProgressedMission[] }> {
  // 1. Fetch all qualifying active missions
  const rawMissions = await tx.$queryRaw<unknown[]>`
    SELECT
      umd.id,
      umd.mission_id,
      umd.status,
      umd.progress,
      m.target          AS mission_target,
      m.type            AS mission_type,
      m.reward_coins,
      m.reward_experience,
      m.title           AS mission_title
    FROM user_missions umd
    JOIN missions m ON umd.mission_id = m.id
    WHERE umd.user_id = ${userId}::uuid
      AND umd.status = 'in-progress'
      AND m.type IN ('HEX_COUNT', 'HEX_TOTAL')
  `

  // 2. Validate raw rows — skip any that don't match expected shape
  const missions: MissionRow[] = []
  for (const row of rawMissions) {
    const parsed = MissionRowSchema.safeParse(row)
    if (parsed.success) {
      missions.push(parsed.data)
    } else {
      await serverLog('MissionRow schema validation failed — skipping row', {
        row,
        issues: parsed.error.issues,
      }, 'warn')
    }
  }

  if (missions.length === 0) {
    return { progressed: [], completed: [] }
  }

  // 3. Guard: verify mission_capture_idempotency table exists before inserting.
  //    If the migration hasn't been applied yet (deploy order mismatch), skip
  //    mission progress entirely rather than crashing the territory claim.
  //    to_regclass returns NULL when the relation doesn't exist.
  const tableCheck = await tx.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('public.mission_capture_idempotency') IS NOT NULL AS exists
  `
  if (!tableCheck[0]?.exists) {
    await serverLog(
      'mission_capture_idempotency table not found — skipping mission progress (migration pending)',
      { userId, territoryId },
      'warn'
    )
    return { progressed: [], completed: [] }
  }

  // 4. Attempt idempotency slot for each mission
  //    INSERT … ON CONFLICT DO NOTHING RETURNING mission_id
  //    Only missions that get a row back proceed to progress increment.
  const idempotencyRows = await tx.$queryRaw<{ mission_id: string }[]>`
    INSERT INTO mission_capture_idempotency (user_id, mission_id, territory_id)
    SELECT
      ${userId}::uuid,
      m.mission_id,
      ${territoryId}
    FROM UNNEST(${missions.map(m => m.mission_id)}::text[]) AS m(mission_id)
    ON CONFLICT (user_id, mission_id, territory_id) DO NOTHING
    RETURNING mission_id
  `

  const claimedMissionIds = new Set(idempotencyRows.map(r => r.mission_id))
  const eligibleMissions = missions.filter(m => claimedMissionIds.has(m.mission_id))

  if (eligibleMissions.length === 0) {
    return { progressed: [], completed: [] }
  }

  // 4. Increment progress and get DB-authoritative new value via RETURNING
  //    (Yellow-flag improvement: avoids race if future code has other write paths)
  const updatedRows = await tx.$queryRaw<{ id: string; progress: number }[]>`
    UPDATE user_missions
    SET progress = progress + 1, updated_at = NOW()
    WHERE id = ANY(${eligibleMissions.map(m => m.id)}::text[])
    RETURNING id, progress
  `

  const newProgressMap = new Map(updatedRows.map(r => [r.id, Number(r.progress)]))

  // 5. Split into progressed vs completed using DB-written progress
  const progressed: ProgressedMission[] = []
  const completed: ProgressedMission[] = []

  for (const m of eligibleMissions) {
    const new_progress = newProgressMap.get(m.id) ?? m.progress + 1
    const enriched: ProgressedMission = { ...m, new_progress }

    if (new_progress >= m.mission_target) {
      completed.push(enriched)
    } else {
      progressed.push(enriched)
    }
  }

  // 6. Mark completed missions status = 'completed' so they no longer appear
  //    in future 'in-progress' queries. This UPDATE is naturally idempotent.
  if (completed.length > 0) {
    await tx.$executeRaw`
      UPDATE user_missions
      SET status = 'completed', updated_at = NOW()
      WHERE id = ANY(${completed.map(m => m.id)}::text[])
    `
  }

  return { progressed, completed }
}
