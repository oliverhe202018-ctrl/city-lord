import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { cleanAndSplitTrajectory } from '../gis/geometry-cleaner';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { TerritoryStatsAggregatorService } from '@/lib/services/territory-stats-aggregator';
import { extractValidLoops, LOOP_CLOSURE_THRESHOLD_M } from '@/lib/geometry-utils';

export interface SettlementInput {
    runId: string;
    userId: string;
    cityId: string;
    clubId?: string | null;
    pathGeoJSON: Feature<Polygon | MultiPolygon>;
    score_weight?: number;
    /** Pre-processed cleaned polygons — if provided, skip extractValidLoops + cleanAndSplitTrajectory */
    preProcessedPolygons?: Feature<Polygon>[];
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
    reinforcedTerritories: number;
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
    const { runId, userId, cityId, clubId, pathGeoJSON } = input;
    const TERRITORY_MAX_HEALTH = 100;
    const ALLY_HEAL = 50;
    const ENEMY_DAMAGE = 20;
    const PATROL_OVERLAP_THRESHOLD = 0.8;
    const SHIELD_CHARGE_INCREMENT = 100;

    // 1. Validate Input & Prepare Polygons
    let cleanedPolygons: Feature<Polygon>[];

    if (input.preProcessedPolygons && input.preProcessedPolygons.length > 0) {
        // Fast path: use pre-processed data from run-service.ts (skip expensive re-computation)
        cleanedPolygons = input.preProcessedPolygons;
    } else {
        // Fallback path: original extraction + cleaning (for direct callers like territory-service.ts)
        if (!pathGeoJSON || !pathGeoJSON.geometry) {
            return { success: false, createdTerritories: 0, reinforcedTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'Invalid path geometry' };
        }

        if (pathGeoJSON.geometry.type === 'MultiPolygon') {
            // If the raw input is already a MultiPolygon (e.g., from an external split or test mock)
            cleanedPolygons = pathGeoJSON.geometry.coordinates.map((coords: number[][][]) => turf.polygon(coords));
        } else {
            // Processing a single raw path Polygon containing coordinate points
            const rawCoords = pathGeoJSON.geometry.coordinates?.[0];
            if (!Array.isArray(rawCoords) || rawCoords.length < 3) {
                return { success: false, createdTerritories: 0, reinforcedTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'Invalid path coordinates' };
            }
            const extractedLoops = extractValidLoops(
                (rawCoords as any).map((coord: [number, number], index: number) => ({
                    lng: coord[0],
                    lat: coord[1],
                    timestamp: index
                })),
                LOOP_CLOSURE_THRESHOLD_M
            );
            if (extractedLoops.length === 0) {
                return { success: false, createdTerritories: 0, reinforcedTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'No valid closed loops' };
            }

            cleanedPolygons = extractedLoops.flatMap((loop) => {
                const loopCoords = loop.map((point) => [point.lng, point.lat] as [number, number]);
                return cleanAndSplitTrajectory(loopCoords);
            });
        }
    }

    if (cleanedPolygons.length === 0) {
        return { success: false, createdTerritories: 0, reinforcedTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'Invalid geometry after cleaning' };
    }
    const runAreaSqMeters = cleanedPolygons.reduce((sum, polygon) => sum + turf.area(polygon), 0);
    if (runAreaSqMeters < 50) {
        return { success: false, createdTerritories: 0, reinforcedTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'Run area too small' };
    }

    // Recalculate combined geometry for PostGIS intersection check
    const combinedGeometry = cleanedPolygons.length === 1
        ? cleanedPolygons[0].geometry
        : turf.multiPolygon(cleanedPolygons.map(p => p.geometry.coordinates)).geometry;
    const combinedGeometryJson = JSON.stringify(combinedGeometry);

    const finalSettledResult: SettlementResult = await prisma.$transaction(async (tx) => {
        // Initial working set for area carving
        let workingPolygons: Feature<Polygon>[] = [...cleanedPolygons];

        let result: SettlementResult = {
            success: true,
            createdTerritories: 0,
            reinforcedTerritories: 0,
            damagedTerritories: 0,
            destroyedTerritories: 0,
            damageDetails: [],
            maintenanceDetails: []
        };

        interface OverlapRow {
            id: string;
            health: number | null;
            current_hp: number | null;
            max_hp: number | null;
            level: number | null;
            overlap_ratio: number;
        }
        let bestPatrolOverlap: OverlapRow | null = null;
        try {
            const overlapRows = await tx.$queryRaw<OverlapRow[]>`
            SELECT
                t.id,
                t.health,
                t.current_hp,
                t.max_hp,
                t.level,
                COALESCE(
                    ST_Area(
                        ST_Intersection(
                            t.geojson,
                            ST_SetSRID(ST_GeomFromGeoJSON(${combinedGeometryJson}), 4326)
                        )::geography
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
            return { success: false, createdTerritories: 0, reinforcedTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: `SQL Error: ${sqlErr.message}` };
        }

        // 2. Fetch overlapping territories using PostGIS BBox/Intersects (Raw SQL)
        interface TerritoryRow {
            id: string;
            owner_id: string | null;
            owner_faction: string | null;
            owner_club_id: string | null;
            health: number | null;
            current_hp: number | null;
            max_hp: number | null;
            score_weight: number | null;
            territory_type: string;
            level: number | null;
            owner_name: string | null;
            geometry: Polygon;
            is_contained: boolean;
        }
        let overlappingTerritories: TerritoryRow[] = [];
        try {
            overlappingTerritories = await tx.$queryRaw<TerritoryRow[]>`
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
            return { success: false, createdTerritories: 0, reinforcedTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: `SQL Error: ${sqlErr.message}` };
        }

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
                result.reinforcedTerritories++;
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
            result.reinforcedTerritories++;
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

                result.maintenanceDetails.push({
                    territoryId: existingTerr.id,
                    type: 'HEAL',
                    oldMaxHp: Number(existingTerr.max_hp ?? 1000),
                    newMaxHp: Number(existingTerr.max_hp ?? 1000),
                    beforeHp: beforeHealth,
                    afterHp: TERRITORY_MAX_HEALTH,
                    level: Number(existingTerr.level ?? 1)
                });
                result.reinforcedTerritories++;
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

                result.maintenanceDetails.push({
                    territoryId: existingTerr.id,
                    type: 'HEAL',
                    oldMaxHp: Number(existingTerr.max_hp ?? 1000),
                    newMaxHp: Number(existingTerr.max_hp ?? 1000),
                    beforeHp: beforeHealth,
                    afterHp: healedHealth,
                    level: Number(existingTerr.level ?? 1)
                });
                result.reinforcedTerritories++;
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
                        user_id: existingTerr.owner_id as string,
                        sender_id: null,
                        type: 'system',
                        content: `你的领地 ${existingTerr.id} 生命值已降至 ${afterHealth}/${TERRITORY_MAX_HEALTH}，请尽快前往巡逻修复。`,
                        is_read: false
                    }
                });
                await tx.notifications.create({
                    data: {
                        user_id: existingTerr.owner_id as string,
                        type: 'battle',
                        title: '领地遭受攻击',
                        body: `你的领地 ${existingTerr.id} 生命值已降至 ${afterHealth}/${TERRITORY_MAX_HEALTH}，请尽快巡逻修复。`,
                        is_read: false,
                        data: {
                            territoryId: existingTerr.id,
                            territoryName: existingTerr.id,
                            eventType: 'LOW_HEALTH',
                            clubId: existingTerr.owner_club_id ?? undefined,
                            attackerClubId: clubId ?? undefined,
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
            const newWorkingPolygons: Feature<Polygon>[] = [];
            for (const poly of workingPolygons) {
                // TODO: Refactor specific type for turf.difference once @turf/turf provides stable MultiPolygon/Polygon union types
                const diff = (turf as any).difference(poly as any, existingFeature as any) as Feature<Polygon> | null;
                if (diff) {
                    newWorkingPolygons.push(diff);
                }
            }
            workingPolygons = newWorkingPolygons;
        }

        // 清理被完全吞噬的历史废块
        const destroyedAndContainedIds = overlappingTerritories
            .filter((t: TerritoryRow) => {
                const beforeHp = Number(t.health ?? t.current_hp ?? 100);
                const afterHp = Math.max(0, beforeHp - ENEMY_DAMAGE);
                return afterHp <= 0 && Boolean(t.is_contained);
            })
            .map((t: TerritoryRow) => t.id);

        if (destroyedAndContainedIds.length > 0) {
            await tx.territories.updateMany({
                where: { id: { in: destroyedAndContainedIds } },
                data: {
                    status: 'SUPERSEDED' as any
                }
            });
        }

        // 4. Generate New Territories
        // After carving out existing alive territories, we have 1 or more polygons representing empty space + destroyed territories space

        if (workingPolygons.length > 0) {
            let finalGeometry: Polygon | MultiPolygon;

            if (workingPolygons.length === 1) {
                finalGeometry = workingPolygons[0].geometry as Polygon | MultiPolygon;
            } else {
                const coords = workingPolygons.map(f => {
                    if (f.geometry.type === 'Polygon') {
                        return [(f.geometry as Polygon).coordinates];
                    } else if (f.geometry.type === 'MultiPolygon') {
                        return (f.geometry as unknown as MultiPolygon).coordinates;
                    }
                    return [];
                }).flat(1);

                finalGeometry = turf.multiPolygon(coords as any).geometry as unknown as MultiPolygon;
            }

            const preCalcArea = turf.area(turf.feature(finalGeometry));

            if (preCalcArea >= 10) {
                const newId = `terr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                // TODO[LBS-Sec]: 当前城市判定依赖 fallback。需引入区划边界多边形数据，改为 ST_Intersects(cities.geom, territory.geom) 进行后端强制判定。
                const finalCityId = 'default_city';
                const geojsonStr = JSON.stringify(finalGeometry);

                const affectedRows = await tx.$executeRaw`
                    WITH validated AS (
                        SELECT ST_CollectionExtract(
                            ST_MakeValid(ST_GeomFromGeoJSON(${geojsonStr}::text)),
                            3
                        ) AS geom
                    ),
                    calculated AS (
                        -- 在此层进行 PostGIS 原生地理面积计算，确保与最终多边形绝对同源
                        SELECT 
                            geom,
                            ST_Area(geom::geography) AS real_area
                        FROM validated
                    )
                    INSERT INTO territories (
                        id, city_id, owner_id, owner_club_id, geojson, geojson_json,
                        source_run_id, first_claimed_at, last_claimed_at,
                        max_hp, current_hp, health, territory_type, score_weight, status,
                        area_m2_exact
                    )
                    SELECT
                        ${newId},
                        ${finalCityId},
                        CAST(${userId} AS UUID),
                        CAST(${clubId ?? null} AS UUID),
                        geom,
                        ST_AsGeoJSON(geom)::jsonb,
                        CAST(${runId} AS UUID),
                        NOW(), NOW(), 1000, 1000, 100,
                        'NORMAL'::"TerritoryType",
                        1.0,
                        'ACTIVE'::"TerritoryStatus",
                        real_area
                    FROM calculated
                    WHERE real_area >= 50
                `;

                if (affectedRows > 0) {
                    await tx.territory_events.create({
                        data: {
                            territory_id: newId,
                            event_type: 'CREATED',
                            event_type_old: 'CREATED',
                            user_id: userId,
                            old_owner_id: null,
                            new_owner_id: userId,
                            old_club_id: null,
                            new_club_id: clubId ?? null,
                            old_faction: null,
                            new_faction: runnerFaction,
                            source_run_id: runId
                        }
                    });

                    result.createdTerritories++;
                }
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
    }, { timeout: 30000, maxWait: 10000 });
    if (clubId) {
        await TerritoryStatsAggregatorService.processNextBatch();
    }
    return finalSettledResult;
}


