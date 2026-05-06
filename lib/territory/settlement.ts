import * as turf from '@turf/turf';
import difference from '@turf/difference';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { cleanAndSplitTrajectory } from '../gis/geometry-cleaner';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { TerritoryStatsAggregatorService } from '@/lib/services/territory-stats-aggregator';
import { extractValidLoops, LOOP_CLOSURE_THRESHOLD_M } from '@/lib/geometry-utils';
import { tasks } from '@trigger.dev/sdk';
import { processPostRunRewards } from '../game/gamification-dispatcher';
import { MIN_TERRITORY_AREA_M2 } from '@/lib/constants/territory';

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
    const PATROL_OVERLAP_THRESHOLD = 0.8;
    const SHIELD_CHARGE_INCREMENT = 100;

    // 1. Validate Input & Prepare Polygons
    if (!cityId || cityId === 'default_city' || cityId === 'unknown') {
        console.error(`[Settlement] 致命错误：cityId 无效 (${cityId})。强行终止入库以防事务崩溃。`);
        return {
            success: false,
            errorCode: 'INVALID_CITY_ID',
            error: 'Settlement aborted: invalid cityId',
            createdTerritories: 0,
            reinforcedTerritories: 0,
            damagedTerritories: 0,
            destroyedTerritories: 0,
            damageDetails: [],
            maintenanceDetails: []
        } as any;
    }

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
    if (runAreaSqMeters < MIN_TERRITORY_AREA_M2) {
        return { success: false, createdTerritories: 0, reinforcedTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'Run area too small' };
    }

    // Recalculate combined geometry for PostGIS intersection check
    const combinedGeometry = cleanedPolygons.length === 1
        ? cleanedPolygons[0].geometry
        : turf.multiPolygon(cleanedPolygons.map(p => p.geometry.coordinates)).geometry;
    const combinedGeometryJson = JSON.stringify(combinedGeometry);

    // ─── Phase 3D: 离线冲突防御 — 获取跑步结束时间作为时间戳基准 ───
    const runRecord = await prisma.runs.findUnique({
        where: { id: runId },
        select: { created_at: true, duration: true }
    });
    const runEndTime = runRecord?.created_at
        ? new Date(runRecord.created_at).getTime() + (runRecord.duration ?? 0) * 1000
        : Date.now();

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
            last_attacked_at: Date | string | null;
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
                ST_Contains(ST_GeomFromGeoJSON(${combinedGeometryJson}), t.geojson) as is_contained,
                t.last_attacked_at
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
            } else {
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
            }
        }

        const actuallyDestroyedContainedIds = new Set<string>();

        for (const existingTerr of overlappingTerritories) {
            const existingFeature = turf.feature(existingTerr.geometry);

            const territoryFaction = existingTerr.owner_faction ?? null;
            const beforeHealth = Number(existingTerr.health ?? existingTerr.current_hp ?? TERRITORY_MAX_HEALTH);

            if (existingTerr.owner_id === userId) {
                if (bestPatrolOverlap && bestPatrolOverlap.id === existingTerr.id) {
                    const newWorkingPolygons: Feature<Polygon>[] = [];
                    for (const poly of workingPolygons) {
                        const diff = difference(
                            poly as Feature<Polygon | MultiPolygon>,
                            existingFeature as Feature<Polygon | MultiPolygon>
                        );
                        if (diff) {
                            if (diff.geometry.type === 'MultiPolygon') {
                                diff.geometry.coordinates.forEach((coords: any) => {
                                    newWorkingPolygons.push(turf.polygon(coords));
                                });
                            } else {
                                newWorkingPolygons.push(diff as Feature<Polygon>);
                            }
                        }
                    }
                    workingPolygons = newWorkingPolygons;
                    continue;
                }

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

                const newWorkingPolygons: Feature<Polygon>[] = [];
                for (const poly of workingPolygons) {
                    const diff = difference(
                        poly as Feature<Polygon | MultiPolygon>,
                        existingFeature as Feature<Polygon | MultiPolygon>
                    );
                    if (diff) {
                        if (diff.geometry.type === 'MultiPolygon') {
                            diff.geometry.coordinates.forEach((coords: any) => {
                                newWorkingPolygons.push(turf.polygon(coords));
                            });
                        } else {
                            newWorkingPolygons.push(diff as Feature<Polygon>);
                        }
                    }
                }
                workingPolygons = newWorkingPolygons;
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

                const newWorkingPolygons: Feature<Polygon>[] = [];
                for (const poly of workingPolygons) {
                    const diff = difference(
                        poly as Feature<Polygon | MultiPolygon>,
                        existingFeature as Feature<Polygon | MultiPolygon>
                    );
                    if (diff) {
                        if (diff.geometry.type === 'MultiPolygon') {
                            diff.geometry.coordinates.forEach((coords: any) => {
                                newWorkingPolygons.push(turf.polygon(coords));
                            });
                        } else {
                            newWorkingPolygons.push(diff as Feature<Polygon>);
                        }
                    }
                }
                workingPolygons = newWorkingPolygons;
                continue;
            }

            // ─── Phase 3D: 离线冲突防御 — 时间戳倒挂校验 ───
            const territoryLastAttackedAt = existingTerr.last_attacked_at
                ? new Date(existingTerr.last_attacked_at).getTime()
                : 0;
            if (territoryLastAttackedAt > runEndTime) {
                console.warn(`[Settlement][Offline Conflict] runId: ${runId}, territory: ${existingTerr.id} - skipping. runEndTime < last_attacked_at`);
                continue;
            }

            // ─── Phase 3E: 删除旧 ENEMY_DAMAGE 双重扣血逻辑，统一走 Phase 3B 单链路 ───
            continue;
        }

        // ─── Phase 3B: 固定伤害 + 血量衰减 + 血量归零后裁切 ───
        const DAMAGE_PER_RUN = 10;

        for (const existingTerr of overlappingTerritories) {
            if (existingTerr.owner_id === userId) continue;
            const territoryFaction = existingTerr.owner_faction ?? null;
            if (runnerFaction && territoryFaction && runnerFaction === territoryFaction) continue;

            // 扣血逻辑：固定伤害，每次 10 点
            // ─── Phase 3D: 离线冲突防御 — 时间戳倒挂校验 ───
            const territoryLastAttackedAt3B = existingTerr.last_attacked_at
                ? new Date(existingTerr.last_attacked_at).getTime()
                : 0;
            if (territoryLastAttackedAt3B > runEndTime) {
                console.warn(`[Settlement][Offline Conflict 3B] runId: ${runId}, territory: ${existingTerr.id} - skipping. runEndTime < last_attacked_at`);
                continue;
            }

            const nextHealth = Math.max(0, (existingTerr.health ?? 100) - DAMAGE_PER_RUN);

            if (nextHealth > 0) {
                // 血量尚存，扣血并裁切 workingPolygons，防止玩家新领地与敌方重叠
                await tx.territories.update({
                    where: { id: existingTerr.id },
                    data: {
                        health: nextHealth,
                        last_attacked_at: new Date(),
                    }
                });

                const newWorkingPolygons: Feature<Polygon>[] = [];
                const existingFeature = turf.feature(existingTerr.geometry) as Feature<Polygon | MultiPolygon>;
                for (const poly of workingPolygons) {
                    const diff = difference(
                        poly as Feature<Polygon | MultiPolygon>,
                        existingFeature
                    );
                    if (diff) {
                        if (diff.geometry.type === 'MultiPolygon') {
                            diff.geometry.coordinates.forEach((coords: any) => {
                                newWorkingPolygons.push(turf.polygon(coords));
                            });
                        } else {
                            newWorkingPolygons.push(diff as Feature<Polygon>);
                        }
                    }
                }
                workingPolygons = newWorkingPolygons;
            } else {
                // 血量归零 — 摧毁领地，标记 SUPERSEDED
                // 跳过 difference 裁切：玩家的新轨迹已覆盖该区域，跳过裁切即完成吞并
                await tx.territories.update({
                    where: { id: existingTerr.id },
                    data: { status: 'SUPERSEDED' as any, health: 0, last_attacked_at: new Date() }
                });
                result.destroyedTerritories++;
                if (existingTerr.is_contained) {
                    actuallyDestroyedContainedIds.add(existingTerr.id);
                }
            }
        }

        // 清理被完全吞噬的历史废块
        const destroyedAndContainedIds = Array.from(actuallyDestroyedContainedIds);

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

        const triggeredEventIds: string[] = [];

        if (workingPolygons.length > 0) {
            // Check for random event triggers before creating new territories
            const activeRandomEvents = await tx.random_events.findMany({
                where: { city_id: cityId, status: 'ACTIVE' },
            });

            if (activeRandomEvents.length > 0) {
                for (const poly of workingPolygons) {
                    for (const event of activeRandomEvents) {
                        const point = turf.point([event.lng, event.lat]);
                        if (turf.booleanPointInPolygon(point, poly)) {
                            // Ensure we only trigger once
                            if (!triggeredEventIds.includes(event.id)) {
                                triggeredEventIds.push(event.id);
                            }
                        }
                    }
                }
            }

            if (triggeredEventIds.length > 0) {
                await tx.random_events.updateMany({
                    where: { id: { in: triggeredEventIds } },
                    data: {
                        status: 'TRIGGERED',
                        triggered_by: userId,
                        triggered_at: new Date(),
                    },
                });
            }

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

            if (preCalcArea >= MIN_TERRITORY_AREA_M2) {
                const newId = `terr_${globalThis.crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
                // TODO[LBS-Sec]: 当前城市判定依赖 fallback。需引入区划边界多边形数据，改为 ST_Intersects(cities.geom, territory.geom) 进行后端强制判定。
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
                        id, city_id, owner_id, owner_club_id, owner_faction, geojson, geojson_json,
                        source_run_id, first_claimed_at, last_claimed_at,
                        max_hp, current_hp, health, territory_type, score_weight, status,
                        area_m2_exact
                    )
                    SELECT
                        ${newId},
                        ${cityId},
                        CAST(${userId} AS UUID),
                        CAST(${clubId ?? null} AS UUID),
                        ${runnerFaction},
                        geom,
                        ST_AsGeoJSON(geom)::jsonb,
                        CAST(${runId} AS UUID),
                        NOW(), NOW(), 1000, 1000, 100,
                        'NORMAL'::"TerritoryType",
                        1.0,
                        'ACTIVE'::"TerritoryStatus",
                        real_area
                    FROM calculated
                    WHERE real_area >= ${MIN_TERRITORY_AREA_M2}
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
        if (result.createdTerritories > 0 || result.reinforcedTerritories > 0) {
            // Update User City Progress atomically inside the global block
            await tx.$executeRaw`
                INSERT INTO public.user_city_progress (user_id, city_id, tiles_captured, area_controlled, last_active_at, joined_at)
                VALUES (
                    ${userId}::uuid, 
                    ${cityId}, 
                    COALESCE((
                        SELECT COUNT(1)::int
                        FROM public.territories t
                        WHERE t.owner_id = ${userId}::uuid
                          AND t.city_id = ${cityId}
                          AND t.status = 'ACTIVE'::"TerritoryStatus"
                    ), 0), 
                    COALESCE((
                        SELECT SUM(t.area_m2_exact) / 1000000.0
                        FROM public.territories t
                        WHERE t.owner_id = ${userId}::uuid
                          AND t.city_id = ${cityId}
                          AND t.status = 'ACTIVE'::"TerritoryStatus"
                    ), 0), 
                    NOW(), 
                    NOW()
                )
                ON CONFLICT (user_id, city_id) DO UPDATE SET
                    tiles_captured = EXCLUDED.tiles_captured,
                    area_controlled = EXCLUDED.area_controlled,
                    last_active_at = NOW();
            `;

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
            // Faction Stats will be aggregated asynchronously by trigger jobs or periodic stats tasks

            // Update User Global Profile Stats
            await tx.$executeRaw`
                UPDATE public.profiles
                SET total_area = COALESCE((
                    SELECT SUM(t.area_m2_exact) / 1000000.0
                    FROM public.territories t
                    WHERE t.owner_id = ${userId}::uuid
                      AND t.status = 'ACTIVE'::"TerritoryStatus"
                ), 0),
                updated_at = NOW()
                WHERE id = ${userId}::uuid
            `;
        }

        return { ...result, triggeredEventIds };
    }, { timeout: 30000, maxWait: 10000 });

    // Fire-and-forget gamification task
    if (finalSettledResult.success) {
        const run = await prisma.runs.findUnique({ where: { id: runId }, select: { distance_km: true } });
        if (run) {
            await tasks.trigger<typeof processPostRunRewards>("process-post-run-rewards", {
                userId,
                runId,
                distanceKm: run.distance_km ?? 0,
                createdTerritories: finalSettledResult.createdTerritories,
                triggeredEventIds: (finalSettledResult as any).triggeredEventIds || [],
            });
        }
    }

    if (clubId) {
        await TerritoryStatsAggregatorService.processNextBatch();
    }
    return finalSettledResult;
}


