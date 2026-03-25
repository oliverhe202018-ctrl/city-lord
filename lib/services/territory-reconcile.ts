import { prisma } from '@/lib/prisma'
import { DEFAULT_TERRITORY_AREA_KM2 } from '@/lib/constants/territory'

export class TerritoryReconcileService {
    /**
     * Run nightly reconcile. 
     * Uses Advisory Lock to ensure only one instance runs.
     * Compares the snapshot of 'territories' against 'club_territory_stats' and fixes any drift.
     */
    static async runReconcile() {
        // 1. Try to get PG Advisory Lock (10086 is our magic number for reconcile)
        const lockResult = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(10086) as locked;
    `
        // Depending on postgres driver the response might vary slightly, but we check truthiness
        if (!lockResult || !lockResult[0]?.locked) {
            console.log('[Reconcile] Could not obtain lock, another reconcile is likely running.')
            return { success: false, reason: 'LOCKED' }
        }

        try {
            console.log('[Reconcile] Started territory reconciliation snapshot.')

            // 2. Baseline true state from territories table
            const realClubStats = await prisma.$queryRaw<any[]>`
        SELECT 
          owner_club_id as club_id,
          COUNT(*)::int as total_tiles,
          (COUNT(*) * ${DEFAULT_TERRITORY_AREA_KM2})::numeric as total_area
        FROM public.territories
        WHERE owner_club_id IS NOT NULL
        GROUP BY owner_club_id
      `

            // 3. Current aggregated state
            const currentAggStats = await prisma.$queryRaw<any[]>`
        SELECT club_id, total_tiles, total_area 
        FROM public.club_territory_stats
      `

            // 4. Compare and compute drifted clubs
            const activeClubs = new Set([
                ...realClubStats.map(r => r.club_id),
                ...currentAggStats.map(r => r.club_id)
            ])

            let driftCount = 0

            for (const clubId of activeClubs) {
                const real = realClubStats.find(r => r.club_id === clubId) || { total_tiles: 0, total_area: 0 }
                const agg = currentAggStats.find(r => r.club_id === clubId) || { total_tiles: 0, total_area: 0 }

                // Precision issues with numeric, compare converted values allowing a tiny epsilon diff
                if (real.total_tiles !== agg.total_tiles || Math.abs(Number(real.total_area) - Number(agg.total_area)) > 0.01) {
                    driftCount++
                    console.warn(`[Reconcile] Drift Detected for Club ${clubId}. Real tiles: ${real.total_tiles}, Agg: ${agg.total_tiles}`)

                    // 5. Force override and leave audit trail
                    await prisma.$transaction(async (tx) => {
                        // For missing records in stats, we do UPSERT
                        // We reuse max event ID from cursor so we don't regress the worker cursor explicitly
                        await tx.$executeRaw`
               INSERT INTO public.club_territory_stats (club_id, total_area, total_tiles, last_synced_event_id, updated_at)
               VALUES (${clubId}::uuid, ${real.total_area}, ${real.total_tiles}, 
                 (SELECT COALESCE(last_event_id, 0) FROM worker_cursors WHERE consumer_name = 'stats_aggregator'), 
                 NOW()
               )
               ON CONFLICT (club_id) DO UPDATE SET
                 total_area = EXCLUDED.total_area,
                 total_tiles = EXCLUDED.total_tiles,
                 updated_at = NOW()
             `

                        // Leave audit trail
                        await tx.$executeRaw`
               INSERT INTO public.territory_events (territory_id, event_type, new_club_id, created_at)
               VALUES ('SYSTEM_RECONCILE', 'RECONCILE_ADJUST', ${clubId}::uuid, NOW())
             `
                    })
                }
            }

            console.log(`[Reconcile] Completed. Drifted clubs found & fixed: ${driftCount}`)
            return { success: true, driftedClubs: driftCount }

        } finally {
            // 6. Release advisory lock
            await prisma.$executeRaw`SELECT pg_advisory_unlock(10086);`
        }
    }
}
