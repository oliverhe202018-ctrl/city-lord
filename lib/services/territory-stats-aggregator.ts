import { prisma } from '@/lib/prisma'
import { DEFAULT_TERRITORY_AREA_KM2 } from '@/lib/constants/territory'

const CONSUMER_NAME = 'stats_aggregator'
const BATCH_SIZE_LIMIT = 500

export class TerritoryStatsAggregatorService {
    /**
     * Processes a batch of territory events and updates the stats aggregation tables.
     * Ensures idempotency through the worker_cursors table.
     */
    static async processNextBatch(): Promise<{ processed: number; lastEventId: number }> {
        // We use a transaction to ensure cursor advancement and stats updates are atomic
        return await prisma.$transaction(async (tx) => {
            // 1. Get the current cursor
            const cursorRows = await tx.$queryRaw<any[]>`
                SELECT * FROM public.worker_cursors WHERE consumer_name = ${CONSUMER_NAME}
            `

            let startingEventId: bigint | number = 0

            if (!cursorRows || cursorRows.length === 0) {
                // If no cursor exists, initialize it at 0
                await tx.$executeRaw`
                    INSERT INTO public.worker_cursors (consumer_name, last_event_id, updated_at)
                    VALUES (${CONSUMER_NAME}, 0, NOW())
                `
            } else {
                startingEventId = cursorRows[0].last_event_id
            }

            // 2. Fetch the next batch of events, explicitly excluding RECONCILE_ADJUST
            // Using raw query for precise control over the query and type mapping
            const events = await tx.$queryRaw<any[]>`
        SELECT * FROM territory_events
        WHERE id > ${startingEventId}
          AND event_type != 'RECONCILE_ADJUST'
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE_LIMIT}
      `

            if (!events || events.length === 0) {
                return { processed: 0, lastEventId: Number(startingEventId) }
            }

            // Memory Delta Accumulators
            const clubDeltas: Record<string, { tiles: number; area: number }> = {}
            const factionDeltas: Record<string, { tiles: number; area: number }> = {}

            let maxProcessedId = startingEventId

            for (const event of events) {
                maxProcessedId = BigInt(event.id) > maxProcessedId ? BigInt(event.id) : maxProcessedId

                // Parse IDs and Factions from the event row (these are strings/uuids)
                const oldClub = event.old_club_id
                const newClub = event.new_club_id
                const oldFaction = event.old_faction
                const newFaction = event.new_faction

                // Club Math
                if (oldClub && oldClub !== newClub) {
                    if (!clubDeltas[oldClub]) clubDeltas[oldClub] = { tiles: 0, area: 0 }
                    clubDeltas[oldClub].tiles -= 1
                    clubDeltas[oldClub].area -= DEFAULT_TERRITORY_AREA_KM2
                }
                if (newClub && newClub !== oldClub) {
                    if (!clubDeltas[newClub]) clubDeltas[newClub] = { tiles: 0, area: 0 }
                    clubDeltas[newClub].tiles += 1
                    clubDeltas[newClub].area += DEFAULT_TERRITORY_AREA_KM2
                }

                // Faction Math
                if (oldFaction && oldFaction !== newFaction) {
                    if (!factionDeltas[oldFaction]) factionDeltas[oldFaction] = { tiles: 0, area: 0 }
                    factionDeltas[oldFaction].tiles -= 1
                    factionDeltas[oldFaction].area -= DEFAULT_TERRITORY_AREA_KM2
                }
                if (newFaction && newFaction !== oldFaction) {
                    if (!factionDeltas[newFaction]) factionDeltas[newFaction] = { tiles: 0, area: 0 }
                    factionDeltas[newFaction].tiles += 1
                    factionDeltas[newFaction].area += DEFAULT_TERRITORY_AREA_KM2
                }
            }

            // 3. Apply Deltas to Club Stats
            for (const clubId of Object.keys(clubDeltas)) {
                const delta = clubDeltas[clubId]
                if (delta.tiles === 0) continue

                // Use Upsert mathematically (raw required for relative update + insert)
                await tx.$executeRaw`
          INSERT INTO club_territory_stats (club_id, total_area, total_tiles, last_synced_event_id, updated_at)
          VALUES (${clubId}::uuid, ${delta.area}, ${delta.tiles}, ${maxProcessedId}, NOW())
          ON CONFLICT (club_id) DO UPDATE SET
            total_area = club_territory_stats.total_area + EXCLUDED.total_area,
            total_tiles = club_territory_stats.total_tiles + EXCLUDED.total_tiles,
            last_synced_event_id = EXCLUDED.last_synced_event_id,
            updated_at = NOW()
        `
            }

            // 4. Apply Deltas to Faction Stats
            for (const factionName of Object.keys(factionDeltas)) {
                const delta = factionDeltas[factionName]
                if (delta.tiles === 0) continue

                await tx.$executeRaw`
          INSERT INTO faction_territory_stats (faction_name, total_area, total_tiles, last_synced_event_id, updated_at)
          VALUES (${factionName}, ${delta.area}, ${delta.tiles}, ${maxProcessedId}, NOW())
          ON CONFLICT (faction_name) DO UPDATE SET
            total_area = faction_territory_stats.total_area + EXCLUDED.total_area,
            total_tiles = faction_territory_stats.total_tiles + EXCLUDED.total_tiles,
            last_synced_event_id = EXCLUDED.last_synced_event_id,
            updated_at = NOW()
        `
            }

            // 5. Advance Cursor
            await tx.$executeRaw`
        UPDATE worker_cursors
        SET last_event_id = ${maxProcessedId}, updated_at = NOW()
        WHERE consumer_name = ${CONSUMER_NAME}
      `

            return { processed: events.length, lastEventId: Number(maxProcessedId) }
        })
    }
}
