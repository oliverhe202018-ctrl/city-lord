import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DECAY_AMOUNT = 20

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const result = await prisma.$transaction(async (tx) => {
            const decayedRows = await tx.$queryRaw<Array<{ id: string; owner_id: string | null; old_health: number; new_health: number }>>`
                WITH candidates AS (
                    SELECT
                        id,
                        owner_id,
                        COALESCE(health, 0)::int AS old_health
                    FROM public.territories
                    WHERE COALESCE(health, 0) > 0
                )
                UPDATE public.territories
                SET
                    health = GREATEST(0, candidates.old_health - ${DECAY_AMOUNT}),
                    last_maintained_at = NOW()
                FROM candidates
                WHERE territories.id = candidates.id
                RETURNING territories.id, candidates.owner_id, candidates.old_health, COALESCE(territories.health, 0)::int AS new_health
            `

            const lowHealthNotifications = decayedRows
                .filter((row) => row.owner_id && row.old_health >= 50 && row.new_health < 50 && row.new_health > 0)
                .map((row) => ({
                    user_id: row.owner_id,
                    sender_id: null,
                    type: 'system',
                    content: `你的领地 ${row.id} 生命值已降至 ${row.new_health}/100，请尽快前往巡逻修复。`,
                    is_read: false
                }))

            if (lowHealthNotifications.length > 0) {
                await tx.messages.createMany({
                    data: lowHealthNotifications
                })
            }

            const neutralizedRows = await tx.$queryRaw<Array<{ id: string }>>`
                UPDATE public.territories
                SET
                    owner_id = NULL,
                    owner_faction = NULL,
                    owner_club_id = NULL
                WHERE COALESCE(health, 0) <= 0
                  AND (owner_id IS NOT NULL OR owner_faction IS NOT NULL OR owner_club_id IS NOT NULL)
                RETURNING id
            `

            return {
                decayedCount: decayedRows.length,
                neutralizedCount: neutralizedRows.length
            }
        })

        return NextResponse.json({
            success: true,
            decayedCount: result.decayedCount,
            neutralizedCount: result.neutralizedCount,
            decayPerRun: DECAY_AMOUNT
        })
    } catch (error: any) {
        console.error('[territory-decay cron] failed:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
