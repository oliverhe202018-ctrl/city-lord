import * as turf from '@turf/turf';
import { cleanAndSplitTrajectory } from '../gis/geometry-cleaner';
import { PrismaClient, Prisma } from '@prisma/client';
import { TerritoryStatsAggregatorService } from '@/lib/services/territory-stats-aggregator';
import { extractValidLoops, LOOP_CLOSURE_THRESHOLD_M } from '@/lib/geometry-utils';

const prisma = new PrismaClient();

export interface SettlementInput {
    runId: string;
    userId: string;
    cityId: string;
    clubId?: string | null;
    pathGeoJSON: any; // Changed from turf.Feature to any to avoid lint issues
    score_weight?: number;
    db?: Prisma.TransactionClient;
}

export interface DamageDetail {
    territoryId: string;
    ownerName: string;
    damage: number;
    territoryType: string;
    isDestroyed: boolean;
    isCritical?: boolean;
}

export interface MaintenanceDetail {
    territoryId: string;
    type: 'HEAL' | 'FORTIFY' | 'BOTH';
    oldMaxHp: number;
    newMaxHp: number;
    beforeHp: number;
    afterHp: number;
    level: number;
}

export interface SettlementResult {
    success: boolean;
    createdTerritories: number;
    damagedTerritories: number;
    destroyedTerritories: number;
    damageDetails: DamageDetail[];
    maintenanceDetails: MaintenanceDetail[];
    error?: string;
}

/**
 * Handles the calculation and database persistence of territory overlaps, damage, and acquisition.
 */
export async function processTerritorySettlement(input: SettlementInput): Promise<SettlementResult> {
    const { runId, userId, cityId, clubId, pathGeoJSON, db } = input;
    const client = db || prisma;
    const TERRITORY_MAX_HEALTH = 100;
    const ALLY_HEAL = 50;
    const ENEMY_DAMAGE = 20;
    const PATROL_OVERLAP_THRESHOLD = 0.8;
    const SHIELD_CHARGE_INCREMENT = 100;

    // 1. Validate Input
    if (!pathGeoJSON || !pathGeoJSON.geometry) {
        return { success: false, createdTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'Invalid path geometry' };
    }

    const rawCoords = pathGeoJSON.geometry.coordinates?.[0];
    if (!Array.isArray(rawCoords) || rawCoords.length < 3) {
        return { success: false, createdTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'Invalid path coordinates' };
    }
    const extractedLoops = extractValidLoops(
        rawCoords.map((coord: [number, number], index: number) => ({
            lng: coord[0],
            lat: coord[1],
            timestamp: index
        })),
        LOOP_CLOSURE_THRESHOLD_M
    );
    if (extractedLoops.length === 0) {
        return { success: false, createdTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'No valid closed loops' };
    }

    const cleanedPolygons = extractedLoops.flatMap((loop) => {
        const loopCoords = loop.map((point) => [point.lng, point.lat] as [number, number]);
        return cleanAndSplitTrajectory(loopCoords);
    });

    if (cleanedPolygons.length === 0) {
        return { success: false, createdTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'Invalid geometry after cleaning' };
    }
    const runAreaSqMeters = cleanedPolygons.reduce((sum, polygon) => sum + turf.area(polygon), 0);
    if (runAreaSqMeters < 50) {
        return { success: false, createdTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'Run area too small' };
    }

    // Recalculate combined geometry for PostGIS intersection check
    const combinedGeometry = cleanedPolygons.length === 1
        ? cleanedPolygons[0].geometry
        : turf.multiPolygon(cleanedPolygons.map(p => p.geometry.coordinates)).geometry;
    const combinedGeometryJson = JSON.stringify(combinedGeometry);

    // Initial working set for area carving
    let workingPolygons: any[] = [...cleanedPolygons];

    let result: SettlementResult = {
        success: true,
        createdTerritories: 0,
        damagedTerritories: 0,
        destroyedTerritories: 0,
        damageDetails: [],
        maintenanceDetails: []
    };

    let bestPatrolOverlap: {
        id: string;
        health: number | null;
        current_hp: number | null;
        max_hp: number | null;
        level: number | null;
        overlap_ratio: number;
    } | null = null;
    try {
        const overlapRows = await client.$queryRaw<any[]>`
            SELECT
                t.id,
                t.health,
                t.current_hp,
                t.max_hp,
                t.level,
                COALESCE(
                    ST_Area(
                        ST_Intersection(
                            t.geojson::geography,
                            ST_SetSRID(ST_GeomFromGeoJSON(${combinedGeometryJson}), 4326)::geography
                        )
                    ) / NULLIF(
                        ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(${combinedGeometryJson}), 4326)::geography),
                        0
                    ),
                    0
                ) AS overlap_ratio
            FROM territories t
            WHERE t.status = 'ACTIVE'::"TerritoryStatus"
              AND t.owner_id = ${userId}::uuid
              AND ST_Intersects(t.geojson, ST_SetSRID(ST_GeomFromGeoJSON(${combinedGeometryJson}), 4326))
            ORDER BY overlap_ratio DESC
            LIMIT 1
        `;
        if (overlapRows.length > 0) {
            bestPatrolOverlap = {
                ...overlapRows[0],
                overlap_ratio: Number(overlapRows[0].overlap_ratio ?? 0)
            };
        }
    } catch (sqlErr: any) {
        console.error(`[Patrol Overlap SQL Error] userId: ${userId}, runId: ${runId}, error: ${sqlErr.message}`);
        return { success: false, createdTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: `SQL Error: ${sqlErr.message}` };
    }

    // 2. Fetch overlapping territories using PostGIS BBox/Intersects (Raw SQL)
    let overlappingTerritories: any[] = [];
    try {
        overlappingTerritories = await client.$queryRaw<any[]>`
            SELECT 
                t.id, 
                t.owner_id,
                t.owner_faction,
                t.owner_club_id,
                t.health,
                t.current_hp,
                t.max_hp,
                t.score_weight,
                t.territory_type,
                t.level,
                p.nickname as owner_name,
                ST_AsGeoJSON(t.geojson)::jsonb as geometry,
                ST_Contains(ST_GeomFromGeoJSON(${combinedGeometryJson}), t.geojson) as is_contained
            FROM territories t
            LEFT JOIN profiles p ON t.owner_id = p.id
            WHERE t.status = 'ACTIVE'::"TerritoryStatus"
            AND ST_Intersects(t.geojson, ST_GeomFromGeoJSON(${combinedGeometryJson}))
        `;
    } catch (sqlErr: any) {
        console.error(`[Settlement SQL Error] userId: ${userId}, runId: ${runId}, error: ${sqlErr.message}`);
        return { success: false, createdTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: `SQL Error: ${sqlErr.message}` };
    }

    const processLogic = async (tx: Prisma.TransactionClient) => {
        const runnerProfile = await tx.profiles.findUnique({
            where: { id: userId },
            select: { faction: true }
        });
        const runnerFaction = runnerProfile?.faction ?? null;

        if (bestPatrolOverlap && bestPatrolOverlap.overlap_ratio >= PATROL_OVERLAP_THRESHOLD) {
            const beforeHealth = Number(bestPatrolOverlap.health ?? TERRITORY_MAX_HEALTH);
            const beforeShield = Number(bestPatrolOverlap.current_hp ?? 0);
            const maxShield = Number(bestPatrolOverlap.max_hp ?? 1000);

            if (beforeHealth < TERRITORY_MAX_HEALTH) {
                await tx.territories.update({
                    where: { id: bestPatrolOverlap.id },
                    data: {
                        health: TERRITORY_MAX_HEALTH,
                        last_maintained_at: new Date()
                    }
                });
                result.maintenanceDetails.push({
                    territoryId: bestPatrolOverlap.id,
                    type: 'HEAL',
                    oldMaxHp: maxShield,
                    newMaxHp: maxShield,
                    beforeHp: beforeHealth,
                    afterHp: TERRITORY_MAX_HEALTH,
                    level: Number(bestPatrolOverlap.level ?? 1)
                });
                return result;
            }

            const chargedShield = Math.min(maxShield, beforeShield + SHIELD_CHARGE_INCREMENT);
            await tx.territories.update({
                where: { id: bestPatrolOverlap.id },
                data: {
                    current_hp: chargedShield,
                    last_maintained_at: new Date()
                }
            });
            result.maintenanceDetails.push({
                territoryId: bestPatrolOverlap.id,
                type: 'FORTIFY',
                oldMaxHp: maxShield,
                newMaxHp: maxShield,
                beforeHp: beforeShield,
                afterHp: chargedShield,
                level: Number(bestPatrolOverlap.level ?? 1)
            });
            return result;
        }

        for (const existingTerr of overlappingTerritories) {
            // Self-owned or friendly club overlap check logic can be added here
            // For now, if it's the same owner, we might skip damage or apply healing. 
            // MVP: Assume any overlap causes damage unless owned by self.
            const existingFeature = turf.feature(existingTerr.geometry);

            const territoryFaction = existingTerr.owner_faction ?? null;
            const beforeHealth = Number(existingTerr.health ?? existingTerr.current_hp ?? TERRITORY_MAX_HEALTH);

            if (existingTerr.owner_id === userId) {
                await tx.territories.update({
                    where: { id: existingTerr.id },
                    data: {
                        health: TERRITORY_MAX_HEALTH,
                        last_maintained_at: new Date()
                    }
                });
                continue;
            }

            if (runnerFaction && territoryFaction && runnerFaction === territoryFaction) {
                const healedHealth = Math.min(TERRITORY_MAX_HEALTH, beforeHealth + ALLY_HEAL);
                await tx.territories.update({
                    where: { id: existingTerr.id },
                    data: {
                        health: healedHealth,
                        last_maintained_at: new Date()
                    }
                });
                continue;
            }

            const afterHealth = Math.max(0, beforeHealth - ENEMY_DAMAGE);
            const shouldNeutralize = afterHealth <= 0;
            const shouldNotifyLowHealth = Boolean(
                existingTerr.owner_id &&
                !shouldNeutralize &&
                beforeHealth >= 50 &&
                afterHealth < 50
            );

            await tx.territories.update({
                where: { id: existingTerr.id },
                data: shouldNeutralize ? {
                    health: 0,
                    owner_id: null,
                    owner_faction: null,
                    owner_club_id: null,
                    last_maintained_at: new Date()
                } : {
                    health: afterHealth,
                    last_maintained_at: new Date()
                }
            });

            if (shouldNotifyLowHealth) {
                await tx.messages.create({
                    data: {
                        user_id: existingTerr.owner_id,
                        sender_id: null,
                        type: 'system',
                        content: `你的领地 ${existingTerr.id} 生命值已降至 ${afterHealth}/${TERRITORY_MAX_HEALTH}，请尽快前往巡逻修复。`,
                        is_read: false
                    }
                });
                await tx.notifications.create({
                    data: {
                        user_id: existingTerr.owner_id,
                        type: 'battle',
                        title: '领地遭受攻击',
                        body: `你的领地 ${existingTerr.id} 生命值已降至 ${afterHealth}/${TERRITORY_MAX_HEALTH}，请尽快巡逻修复。`,
                        is_read: false,
                        data: {
                            territoryId: existingTerr.id,
                            territoryName: existingTerr.id,
                            eventType: 'LOW_HEALTH',
                            clubId: existingTerr.owner_club_id ?? null,
                            attackerClubId: clubId ?? null,
                            area: runAreaSqMeters,
                            health: {
                                current: afterHealth,
                                max: TERRITORY_MAX_HEALTH
                            }
                        }
                    }
                });
            }

            result.damageDetails.push({
                territoryId: existingTerr.id,
                ownerName: existingTerr.owner_name || '未知领主',
                damage: ENEMY_DAMAGE,
                territoryType: 'RELATIONAL',
                isDestroyed: shouldNeutralize,
                isCritical: false
            });

            if (shouldNeutralize) {
                result.destroyedTerritories++;
            } else {
                result.damagedTerritories++;
            }

            // Perform turf.difference to carve out the claimed shapes so they don't overlap existing active territories
            const newWorkingPolygons: any[] = [];
            for (const poly of workingPolygons) {
                const diff = (turf as any).difference(poly as any, existingFeature as any);
                if (diff) {
                    newWorkingPolygons.push(diff);
                }
            }
            workingPolygons = newWorkingPolygons;
        }

        // 4. Generate New Territories
        // After carving out existing alive territories, we have 1 or more polygons representing empty space + destroyed territories space

        for (const poly of workingPolygons) {
            // Break down MultiPolygons into separate Polygons for independent territories if they are disjoint
            const shapes = splitIntoPolygons(poly);

            for (const shape of shapes) {
                const shapeArea = turf.area(shape);

                // Minimum area threshold for a new territory
                if (shapeArea < 50) continue;

                // Generate ID
                const newId = `terr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                // Ensure cityId has a fallback for safety
                const finalCityId = cityId || 'default_city';

                // Dual Write: raw SQL required for the standard PostGIS geometry column
                const geojsonStr = JSON.stringify(shape.geometry);

                await tx.$executeRawUnsafe(`
                    INSERT INTO territories (
                        id, 
                        city_id,
                        owner_id, 
                        owner_club_id, 
                        geojson, 
                        geojson_json,
                        source_run_id,
                        first_claimed_at, 
                        last_claimed_at,
                        max_hp,
                        current_hp,
                        health,
                        territory_type,
                        score_weight,
                        status
                    ) VALUES (
                        '${newId}', 
                        '${finalCityId}',
                        '${userId}', 
                        ${clubId ? `'${clubId}'` : 'NULL'}, 
                        ST_CollectionExtract(ST_MakeValid(ST_GeomFromGeoJSON('${geojsonStr}'::text)), 3), 
                        '${geojsonStr}'::jsonb,
                        '${runId}',
                        NOW(), 
                        NOW(),
                        1000,
                        1000,
                        100,
                        'NORMAL'::"TerritoryType",
                        1.0,
                        'ACTIVE'::"TerritoryStatus"
                    )
                `);

                // Log Genesis event
                await tx.territory_events.create({
                    data: {
                        territory_id: newId,
                        event_type: 'CREATED',
                        user_id: userId,
                        run_id: runId,
                        old_owner_id: null,
                        new_owner_id: userId,
                        old_club_id: null,
                        new_club_id: clubId ?? null,
                        old_faction: null,
                        new_faction: runnerFaction,
                        source_run_id: runId
                    } as any
                });

                result.createdTerritories++;
            }
        }
        if (clubId) {
            await tx.$executeRaw`
                INSERT INTO public.club_territory_stats (club_id, total_area, total_tiles, last_synced_event_id, updated_at)
                VALUES (
                    ${clubId}::uuid,
                    COALESCE((
                        SELECT SUM(t.area_m2_exact) / 1000000.0
                        FROM public.territories t
                        WHERE t.owner_club_id = ${clubId}::uuid
                          AND t.status = 'ACTIVE'::"TerritoryStatus"
                    ), 0),
                    COALESCE((
                        SELECT COUNT(1)
                        FROM public.territories t
                        WHERE t.owner_club_id = ${clubId}::uuid
                          AND t.status = 'ACTIVE'::"TerritoryStatus"
                    ), 0),
                    COALESCE((SELECT MAX(id) FROM public.territory_events), 0),
                    NOW()
                )
                ON CONFLICT (club_id) DO UPDATE SET
                    total_area = EXCLUDED.total_area,
                    total_tiles = EXCLUDED.total_tiles,
                    last_synced_event_id = EXCLUDED.last_synced_event_id,
                    updated_at = NOW()
            `;

            await tx.$executeRaw`
                UPDATE public.clubs
                SET total_area = COALESCE((
                    SELECT SUM(t.area_m2_exact) / 1000000.0
                    FROM public.territories t
                    WHERE t.owner_club_id = ${clubId}::uuid
                      AND t.status = 'ACTIVE'::"TerritoryStatus"
                ), 0),
                updated_at = NOW()
                WHERE id = ${clubId}::uuid
            `;
        }
        return result; // Add return
    };

    if (db) {
        const settled = await processLogic(db);
        if (clubId) {
            await TerritoryStatsAggregatorService.processNextBatch();
        }
        return settled;
    } else {
        const settled = await prisma.$transaction(processLogic);
        if (clubId) {
            await TerritoryStatsAggregatorService.processNextBatch();
        }
        return settled;
    }
}

// Utility to flatten GeoJSON objects into Polygons
function splitIntoPolygons(feature: any): any[] {
    if (feature.geometry.type === 'Polygon') {
        return [feature];
    } else if (feature.geometry.type === 'MultiPolygon') {
        return feature.geometry.coordinates.map((coords: any) => turf.polygon(coords));
    }
    return [];
}
