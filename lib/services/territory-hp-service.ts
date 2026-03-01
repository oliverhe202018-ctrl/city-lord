/**
 * TerritoryHPService
 *
 * Handles territory HP attack/damage logic with concurrency control.
 *
 * Attack Mechanics:
 *   - Players running through enemy territory deal HP damage
 *   - Damage = clamp(areaKm² × 5, 10, 200)
 *   - Each player can only attack the same territory once per day
 *   - Uses SELECT FOR UPDATE to prevent concurrent race conditions
 *   - When HP reaches 0, territory enters neutral cooldown (5 min)
 *
 * IMPORTANT: This service handles ONLY HP and logs.
 * All scoring (gain/loss) is handled exclusively in claimTerritory
 * to prevent duplicate score adjustments.
 *
 * Error Handling:
 *   - TERRITORY_IN_COOLDOWN: returned BEFORE hp_logs write → no log pollution
 *   - ALREADY_ATTACKED_TODAY: enforced by unique index on (territory_id, attacker_id, attack_date)
 *   - CANNOT_ATTACK_OWN_TERRITORY: basic ownership check
 *   All rejections happen before any mutation, so no rollback is needed.
 *
 * Cooldown Recovery:
 *   Passive — no background task needed. claimTerritory checks
 *   `neutral_until < NOW()` at claim time. When the cooldown expires,
 *   the territory becomes claimable automatically. On successful claim,
 *   health resets to 1000 and neutral_until is set to NULL.
 *
 * Trigger Point:
 *   Called during run settlement (跑步结算) when the backend detects
 *   that the runner's GPS trajectory intersects enemy territories.
 *   NOT triggered by manual button press or real-time location.
 *   The run settlement API (POST /api/sync/run) should call
 *   attackTerritory for each intersected enemy territory tile.
 *
 * CRITICAL: All attack operations run inside a Prisma $transaction
 * with row-level locking on the target territory.
 */

import { prisma } from '@/lib/prisma'
import {
    MIN_DAMAGE,
    MAX_DAMAGE,
    DAMAGE_PER_KM2,
    MAX_TERRITORY_HP,
    H3_TILE_AREA_KM2,
    NEUTRAL_COOLDOWN_MINUTES,
} from '@/lib/constants/territory'
import { redis } from '@/lib/redis'


// ============================================================
// Types
// ============================================================

export interface AttackResult {
    success: boolean
    /** HP damage dealt */
    damage?: number
    /** Remaining HP after attack */
    remainingHp?: number
    /** Whether the territory HP reached 0 (enters neutral cooldown) */
    territoryNeutralized?: boolean
    /** Whether this is a hot zone */
    isHotZone?: boolean
    /** Error message if failed */
    error?: string
}

export interface AttackInput {
    /** The user performing the attack */
    attackerId: string
    /** The territory being attacked */
    territoryId: string
    /** City context */
    cityId: string
    /** Optional: intersection area in m² (for variable damage). Defaults to tile area. */
    intersectionAreaM2?: number
}

// ============================================================
// Service
// ============================================================

export const TerritoryHPService = {
    /**
     * Attack a territory, reducing its HP.
     *
     * Uses Prisma transaction with raw SQL FOR UPDATE lock to prevent
     * concurrent attacks from corrupting HP values.
     *
     * NOTE: This method does NOT handle scoring.
     * All score gains/losses happen in claimTerritory during ownership transfer.
     */
    async attackTerritory(input: AttackInput): Promise<AttackResult> {
        const { attackerId, territoryId, cityId, intersectionAreaM2 } = input

        const lockKey = `territory_lock:${territoryId}`
        const redisLock = await redis.set(lockKey, attackerId, "EX", 10, "NX")
        if (!redisLock) {
            throw new Error('TERRITORY_LOCKED')
        }

        try {
            const result = await prisma.$transaction(
                async (tx) => {
                    // ── Step 1: Lock the territory row with FOR UPDATE ──
                    const locked = await tx.$queryRaw<
                        Array<{
                            id: string
                            owner_id: string
                            health: number
                            city_id: string
                            owner_change_count: number
                            neutral_until: Date | null
                        }>
                    >`
            SELECT id, owner_id, health, city_id, owner_change_count, neutral_until
            FROM public.territories
            WHERE id = ${territoryId}
            FOR UPDATE
          `

                    if (!locked || locked.length === 0) {
                        throw new Error('TERRITORY_NOT_FOUND')
                    }

                    const territory = locked[0]

                    // ── Step 2: Validate (all checks BEFORE any write) ──
                    // IMPORTANT: Rejections here mean zero side-effects.
                    // No hp_logs, no HP change, no state to roll back.
                    if (territory.owner_id === attackerId) {
                        throw new Error('CANNOT_ATTACK_OWN_TERRITORY')
                    }

                    // Cooldown check — territory with HP=0 enters 5-min neutral period.
                    // During cooldown: attack rejected, NO hp_logs written.
                    if (territory.neutral_until && territory.neutral_until > new Date()) {
                        throw new Error('TERRITORY_IN_COOLDOWN')
                    }

                    // ── Step 3: Calculate damage ──
                    const areaKm2 = intersectionAreaM2
                        ? intersectionAreaM2 / 1_000_000
                        : H3_TILE_AREA_KM2

                    const damage = Math.round(
                        Math.max(MIN_DAMAGE, Math.min(MAX_DAMAGE, areaKm2 * DAMAGE_PER_KM2))
                    )

                    // ── Step 4: Check daily attack limit via unique index ──
                    try {
                        await tx.territory_hp_logs.create({
                            data: {
                                territory_id: territoryId,
                                attacker_id: attackerId,
                                damage: damage,
                            },
                        })
                    } catch (e: any) {
                        if (e?.code === 'P2002') {
                            throw new Error('ALREADY_ATTACKED_TODAY')
                        }
                        throw e
                    }

                    // ── Step 5: Apply damage ──
                    const newHp = Math.max(0, territory.health - damage)

                    // ── Step 6: Handle HP reaching 0 (neutralize with cooldown) ──
                    let territoryNeutralized = false

                    if (newHp <= 0) {
                        territoryNeutralized = true
                        const cooldownEnd = new Date()
                        cooldownEnd.setMinutes(cooldownEnd.getMinutes() + NEUTRAL_COOLDOWN_MINUTES)

                        // Set territory to neutral with cooldown
                        // owner_change_count is incremented here, but the actual
                        // owner_change_log is written in claimTerritory (A→B only)
                        await tx.territories.update({
                            where: { id: territoryId },
                            data: {
                                health: 0,
                                owner_change_count: (territory.owner_change_count ?? 0) + 1,
                                last_owner_change_at: new Date(),
                                neutral_until: cooldownEnd,
                                captured_at: null,
                            },
                        })
                    } else {
                        await tx.territories.update({
                            where: { id: territoryId },
                            data: { health: newHp },
                        })
                    }

                    return {
                        success: true,
                        damage,
                        remainingHp: newHp,
                        territoryNeutralized,
                        isHotZone: false, // Will be resolved by caller if needed
                    }
                },
                {
                    maxWait: 5000,
                    timeout: 10000,
                }
            )

            return result
        } catch (err: any) {
            const message = err?.message || 'Attack failed'

            const errorMap: Record<string, string> = {
                TERRITORY_NOT_FOUND: '该领地不存在，请检查领地 ID 或稍后再试',
                CANNOT_ATTACK_OWN_TERRITORY: '您无法攻击自己的领地，选择其他目标',
                ALREADY_ATTACKED_TODAY: '今日已攻击过该领地，每日限一次',
                TERRITORY_IN_COOLDOWN: '该领地正在冷却期内，请稍后再试',
                TERRITORY_LOCKED: '该领地正在冷却中，稍后再试',
            }

            return {
                success: false,
                error: errorMap[message] || message,
            }
        } finally {
            const currentLockVal = await redis.get(`territory_lock:${territoryId}`)
            if (currentLockVal === attackerId) {
                await redis.del(`territory_lock:${territoryId}`)
            }
        }
    },

    /**
     * Repair/heal own territory.
     * Each maintenance restores HP to max and resets the decay timer.
     */
    async maintainTerritory(
        userId: string,
        territoryId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const territory = await prisma.territories.findUnique({
                where: { id: territoryId },
                select: { owner_id: true },
            })

            if (!territory) {
                return { success: false, error: '领地不存在' }
            }

            if (territory.owner_id !== userId) {
                return { success: false, error: '只能维护自己的领地' }
            }

            await prisma.territories.update({
                where: { id: territoryId },
                data: {
                    health: MAX_TERRITORY_HP,
                    last_maintained_at: new Date(),
                },
            })

            return { success: true }
        } catch (err: any) {
            return { success: false, error: err.message || '维护失败' }
        }
    },

    constants: {
        MIN_DAMAGE,
        MAX_DAMAGE,
        DAMAGE_PER_KM2,
        MAX_TERRITORY_HP,
        H3_TILE_AREA_KM2,
        NEUTRAL_COOLDOWN_MINUTES,
    },
}
