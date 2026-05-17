import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DECAY_CRON_LOCK_ID = 10087
const DEFAULT_THRESHOLD_DAYS = 3
const DEFAULT_DEDUCT_RATE = 0.15

type AdvisoryLockRow = {
    locked: boolean
}

type CountRow = {
    count: number | bigint
}

type DeductRow = {
    territory_id: string
    old_health: number
    new_health: number
}

type NeutralizeRow = {
    territory_id: string
    old_health: number
    new_health: number
}

interface DecayFlags {
    deductEnabled: boolean
    neutralizeEnabled: boolean
    thresholdDays: number
    deductRate: number
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
    if (!value) return fallback

    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false

    return fallback
}

function parseIntegerFlag(value: string | undefined, fallback: number, min: number) {
    const parsed = Number.parseInt(value ?? '', 10)
    if (!Number.isFinite(parsed) || parsed < min) {
        return fallback
    }

    return parsed
}

function parseRateFlag(value: string | undefined, fallback: number) {
    const parsed = Number.parseFloat(value ?? '')
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
        return fallback
    }

    return parsed
}

function toNumber(value: number | bigint | null | undefined) {
    if (typeof value === 'bigint') {
        return Number(value)
    }

    return Number(value ?? 0)
}

function getDecayFlags(): DecayFlags {
    return {
        deductEnabled: parseBooleanFlag(process.env.FF_DECAY_DEDUCT_ENABLED, true),
        neutralizeEnabled: parseBooleanFlag(process.env.FF_DECAY_NEUTRALIZE_ENABLED, true),
        thresholdDays: parseIntegerFlag(process.env.FF_DECAY_THRESHOLD_DAYS, DEFAULT_THRESHOLD_DAYS, 1),
        deductRate: parseRateFlag(process.env.FF_DECAY_DEDUCT_RATE, DEFAULT_DEDUCT_RATE),
    }
}

async function countStarvingTerritories(thresholdDate: Date) {
    const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::int AS count
        FROM public.territories
        WHERE owner_id IS NOT NULL
          AND last_maintained_at < ${thresholdDate}
    `

    return toNumber(rows[0]?.count)
}

async function runDecayDeduct(thresholdDate: Date, deductRate: number, actionId: string) {
    return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<DeductRow[]>`
            WITH candidates AS (
                SELECT
                    id,
                    owner_id,
                    owner_club_id,
                    owner_faction,
                    COALESCE(health, 0)::int AS old_health
                FROM public.territories
                WHERE owner_id IS NOT NULL
                  AND last_maintained_at < ${thresholdDate}
                  AND COALESCE(health, 0) > 0
                FOR UPDATE SKIP LOCKED
            ),
            updated AS (
                UPDATE public.territories AS t
                SET health = GREATEST(
                    0,
                    candidates.old_health - GREATEST(1, ROUND(candidates.old_health::numeric * ${deductRate})::int)
                )

                FROM candidates
                WHERE t.id = candidates.id
                RETURNING
                    t.id AS territory_id,
                    candidates.owner_id AS old_owner_id,
                    candidates.owner_club_id AS old_club_id,
                    candidates.owner_faction AS old_faction,
                    candidates.old_health,
                    COALESCE(t.health, 0)::int AS new_health
            ),
            inserted_events AS (
                INSERT INTO public.territory_events (
                    territory_id,
                    event_type,
                    user_id,
                    old_owner_id,
                    new_owner_id,
                    old_club_id,
                    new_club_id,
                    old_faction,
                    new_faction,
                    action_id,
                    processed_for_stats,
                    created_at
                )
                SELECT
                    territory_id,
                    'DECAY_DAMAGE',
                    NULL,
                    old_owner_id,
                    old_owner_id,
                    old_club_id,
                    old_club_id,
                    old_faction,
                    old_faction,
                    ${actionId},
                    FALSE,
                    NOW()
                FROM updated
                RETURNING territory_id
            )
            SELECT updated.territory_id, updated.old_health, updated.new_health
            FROM updated
            INNER JOIN inserted_events ON inserted_events.territory_id = updated.territory_id
        `

        return {
            deductedCount: rows.length,
            zeroHealthCount: rows.filter((row) => row.new_health <= 0).length,
        }
    })
}

async function runDecayNeutralize(thresholdDate: Date, actionId: string) {
    return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<NeutralizeRow[]>`
            WITH candidates AS (
                SELECT
                    id,
                    owner_id,
                    owner_club_id,
                    owner_faction,
                    COALESCE(health, 0)::int AS old_health
                FROM public.territories
                WHERE owner_id IS NOT NULL
                  AND last_maintained_at < ${thresholdDate}
                  AND COALESCE(health, 0) <= 0
                FOR UPDATE SKIP LOCKED
            ),
            updated AS (
                UPDATE public.territories AS t
                SET
                    owner_id = NULL,
                    owner_club_id = NULL,
                    owner_faction = NULL,
                    health = 0
                FROM candidates
                WHERE t.id = candidates.id
                RETURNING
                    t.id AS territory_id,
                    candidates.owner_id AS old_owner_id,
                    candidates.owner_club_id AS old_club_id,
                    candidates.owner_faction AS old_faction,
                    candidates.old_health,
                    0::int AS new_health
            ),
            inserted_events AS (
                INSERT INTO public.territory_events (
                    territory_id,
                    event_type,
                    user_id,
                    old_owner_id,
                    new_owner_id,
                    old_club_id,
                    new_club_id,
                    old_faction,
                    new_faction,
                    action_id,
                    processed_for_stats,
                    created_at
                )
                SELECT
                    territory_id,
                    'DECAY_NEUTRALIZE',
                    NULL,
                    old_owner_id,
                    NULL,
                    old_club_id,
                    NULL,
                    old_faction,
                    NULL,
                    ${actionId},
                    FALSE,
                    NOW()
                FROM updated
                RETURNING territory_id
            )
            SELECT updated.territory_id, updated.old_health, updated.new_health
            FROM updated
            INNER JOIN inserted_events ON inserted_events.territory_id = updated.territory_id
        `

        return {
            neutralizedCount: rows.length,
        }
    })
}

export async function GET(request: Request) {
    let lockAcquired = false

    try {
        const authHeader = request.headers.get('authorization')
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const flags = getDecayFlags()
        const thresholdDate = new Date(Date.now() - flags.thresholdDays * 24 * 60 * 60 * 1000)
        const runId = `decay_${new Date().toISOString()}`

        const lockResult = await prisma.$queryRaw<AdvisoryLockRow[]>`
            SELECT pg_try_advisory_lock(${DECAY_CRON_LOCK_ID}) AS locked
        `

        lockAcquired = Boolean(lockResult[0]?.locked)
        if (!lockAcquired) {
            return NextResponse.json({
                success: true,
                skipped: true,
                reason: 'LOCKED',
            })
        }

        const starvingCount = await countStarvingTerritories(thresholdDate)

        const deductResult = flags.deductEnabled
            ? await runDecayDeduct(thresholdDate, flags.deductRate, `${runId}_deduct`)
            : { deductedCount: 0, zeroHealthCount: 0 }

        const neutralizeResult = flags.neutralizeEnabled
            ? await runDecayNeutralize(thresholdDate, `${runId}_neutralize`)
            : { neutralizedCount: 0 }

        console.log(
            `[Decay Monitor] stale=${starvingCount}, deducted=${deductResult.deductedCount}, zeroHealthAfterDeduct=${deductResult.zeroHealthCount}, neutralized=${neutralizeResult.neutralizedCount}, thresholdDays=${flags.thresholdDays}, deductRate=${flags.deductRate}`
        )

        return NextResponse.json({
            success: true,
            mode: 'APPLY_DECAY',
            flags: {
                deductEnabled: flags.deductEnabled,
                neutralizeEnabled: flags.neutralizeEnabled,
                thresholdDays: flags.thresholdDays,
                deductRate: flags.deductRate,
            },
            thresholdDate: thresholdDate.toISOString(),
            starvingCount,
            deductedCount: deductResult.deductedCount,
            zeroHealthAfterDeduct: deductResult.zeroHealthCount,
            neutralizedCount: neutralizeResult.neutralizedCount,
        })
    } catch (error: any) {
        console.error('[Decay Monitor] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    } finally {
        if (lockAcquired) {
            await prisma.$executeRaw`SELECT pg_advisory_unlock(${DECAY_CRON_LOCK_ID})`
        }
    }
}


