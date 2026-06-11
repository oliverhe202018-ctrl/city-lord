import * as turf from '@turf/turf';
import difference from '@turf/difference';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { cleanAndSplitTrajectory } from '../gis/geometry-cleaner';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { TerritoryStatsAggregatorService } from '@/lib/services/territory-stats-aggregator';
import { extractValidLoops, LOOP_CLOSURE_THRESHOLD_M } from '@/lib/geometry-utils';
import { gcj02LngLatToWgs84 } from '@/lib/gis/coord-transform';
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
    const PATROL_OVERLAP_THRESHOLD = 0.85;
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
    // P0-1 FIX: Convert GCJ02 → WGS84 before area calculation for accuracy
    const runAreaSqMeters = cleanedPolygons.reduce((sum, polygon) => {
        const wgsCoords = gcj02LngLatToWgs84(polygon.geometry.coordinates[0] as [number, number][]);
        const wgsPoly = turf.polygon([wgsCoords]);
        return sum + turf.area(wgsPoly);
    }, 0);
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
            shield: number | null;
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
                t.shield,
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
            FOR UPDATE SKIP LOCKED
        `;
            if (overlapRows.length > 0) {
                bestPatrolOverlap = {
                    ...overlapRows[0],
                    overlap_ratio: Number(overlapRows[0].overlap_ratio ?? 0)
                };
            }
        } catch (sqlErr: any) {
            console.error(`[Patrol Overlap SQL Error] userId: ${userId}, runId: ${runId}, error: ${sqlErr.message}`);
            throw new Error(`[Tx-Rollback] Patrol Overlap SQL Error: ${sqlErr.message}`);
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
            shield: number | null;
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
                t.shield,
                p.nickname as owner_name,
                ST_AsGeoJSON(t.geojson)::jsonb as geometry,
                ST_Contains(ST_GeomFromGeoJSON(${combinedGeometryJson}), t.geojson) as is_contained,
                t.last_attacked_at
            FROM territories t
            LEFT JOIN profiles p ON t.owner_id = p.id
            WHERE t.status = 'ACTIVE'::"TerritoryStatus"
            AND ST_Intersects(t.geojson, ST_GeomFromGeoJSON(${combinedGeometryJson}))
            FOR UPDATE SKIP LOCKED
        `;
        } catch (sqlErr: any) {
            console.error(`[Settlement SQL Error] userId: ${userId}, runId: ${runId}, error: ${sqlErr.message}`);
            throw new Error(`[Tx-Rollback] Settlement SQL Error: ${sqlErr.message}`);
        }

        const runnerProfile = await tx.profiles.findUnique({
            where: { id: userId },
            select: { faction: true, crit_rate: true }
        });
        const runnerFaction = runnerProfile?.faction ?? null;
        const runnerCritRate = runnerProfile?.crit_rate ?? 0; // 0-1 multiplier

        if (bestPatrolOverlap && bestPatrolOverlap.overlap_ratio >= PATROL_OVERLAP_THRESHOLD) {
            const currentHp = Number(bestPatrolOverlap.current_hp ?? 1000);
            const maxHp = Number(bestPatrolOverlap.max_hp ?? 1000);
            const currentShield = Number(bestPatrolOverlap.shield ?? 0);
            const maxShield = 1000;

            let nextHp = currentHp;
            let nextShield = currentShield;

            const neededHp = maxHp - currentHp;
            if (neededHp > 0) {
                if (neededHp >= SHIELD_CHARGE_INCREMENT) {
                    nextHp = currentHp + SHIELD_CHARGE_INCREMENT;
                } else {
                    nextHp = maxHp;
                    const remainder = SHIELD_CHARGE_INCREMENT - neededHp;
                    nextShield = Math.min(maxShield, currentShield + remainder);
                }
            } else {
                nextShield = Math.min(maxShield, currentShield + SHIELD_CHARGE_INCREMENT);
            }
            const nextHealth = Math.round((nextHp / maxHp) * 100);

            await tx.territories.update({
                where: { id: bestPatrolOverlap.id },
                data: {
                    current_hp: nextHp,
                    shield: nextShield,
                    health: nextHealth,
                    last_maintained_at: new Date()
                }
            });
            result.maintenanceDetails.push({
                territoryId: bestPatrolOverlap.id,
                type: neededHp >= SHIELD_CHARGE_INCREMENT ? 'HEAL' : (neededHp > 0 ? 'BOTH' : 'FORTIFY'),
                oldMaxHp: maxHp,
                newMaxHp: maxHp,
                beforeHp: currentHp,
                afterHp: nextHp,
                level: Number(bestPatrolOverlap.level ?? 1)
            });
            result.reinforcedTerritories++;
        }

        // 1. Process friendly / same-faction territories (Heal & Fortify)
        for (const existingTerr of overlappingTerritories) {
            const existingFeature = turf.feature(existingTerr.geometry);
            const territoryFaction = existingTerr.owner_faction ?? null;
            const beforeHealth = Number(existingTerr.health ?? existingTerr.current_hp ?? TERRITORY_MAX_HEALTH);

            // Owner-own territory
            if (existingTerr.owner_id === userId) {
                if (bestPatrolOverlap && bestPatrolOverlap.id === existingTerr.id) {
                    const newWorkingPolygons: Feature<Polygon>[] = [];
                    for (const poly of workingPolygons) {
                        const diff = difference(
                            turf.featureCollection([
                                poly as Feature<Polygon | MultiPolygon>,
                                existingFeature as Feature<Polygon | MultiPolygon>
                            ])
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

                const currentHp = Number(existingTerr.current_hp ?? 1000);
                const maxHp = Number(existingTerr.max_hp ?? 1000);
                await tx.territories.update({
                    where: { id: existingTerr.id },
                    data: {
                        current_hp: maxHp,
                        health: 100,
                        last_maintained_at: new Date()
                    }
                });

                result.maintenanceDetails.push({
                    territoryId: existingTerr.id,
                    type: 'HEAL',
                    oldMaxHp: maxHp,
                    newMaxHp: maxHp,
                    beforeHp: currentHp,
                    afterHp: maxHp,
                    level: Number(existingTerr.level ?? 1)
                });
                result.reinforcedTerritories++;

                const newWorkingPolygons: Feature<Polygon>[] = [];
                for (const poly of workingPolygons) {
                    const diff = difference(
                        turf.featureCollection([
                            poly as Feature<Polygon | MultiPolygon>,
                            existingFeature as Feature<Polygon | MultiPolygon>
                        ])
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

            // Teammate (same faction) territory
            if (runnerFaction && territoryFaction && runnerFaction === territoryFaction) {
                const currentHp = Number(existingTerr.current_hp ?? 1000);
                const maxHp = Number(existingTerr.max_hp ?? 1000);
                const nextHp = Math.min(maxHp, currentHp + 500);
                const nextHealth = Math.round((nextHp / maxHp) * 100);
                await tx.territories.update({
                    where: { id: existingTerr.id },
                    data: {
                        current_hp: nextHp,
                        health: nextHealth,
                        last_maintained_at: new Date()
                    }
                });

                result.maintenanceDetails.push({
                    territoryId: existingTerr.id,
                    type: 'HEAL',
                    oldMaxHp: maxHp,
                    newMaxHp: maxHp,
                    beforeHp: currentHp,
                    afterHp: nextHp,
                    level: Number(existingTerr.level ?? 1)
                });
                result.reinforcedTerritories++;

                const newWorkingPolygons: Feature<Polygon>[] = [];
                for (const poly of workingPolygons) {
                    const diff = difference(
                        turf.featureCollection([
                            poly as Feature<Polygon | MultiPolygon>,
                            existingFeature as Feature<Polygon | MultiPolygon>
                        ])
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
        }

        // ─── Phase 3B: 固定伤害 + 实时切割 + 离散分裂 ───
        const DAMAGE_PER_RUN = 10;
        const damageMultiplier = 1 + runnerCritRate;

        for (const existingTerr of overlappingTerritories) {
            // Skip friendly / same faction (processed in the first loop)
            if (existingTerr.owner_id === userId) continue;
            const territoryFaction = existingTerr.owner_faction ?? null;
            if (runnerFaction && territoryFaction && runnerFaction === territoryFaction) continue;

            const territoryLastAttackedAt = existingTerr.last_attacked_at
                ? new Date(existingTerr.last_attacked_at).getTime()
                : 0;
            if (territoryLastAttackedAt > runEndTime) {
                console.warn(`[Settlement][Offline Conflict] runId: ${runId}, territory: ${existingTerr.id} - skipping. runEndTime < last_attacked_at`);
                continue;
            }

            const targetId = existingTerr.id;
            const currentHp = Number(existingTerr.current_hp ?? 1000);
            const maxHp = Number(existingTerr.max_hp ?? 1000);
            const currentShield = Number(existingTerr.shield ?? 0);
            const damage = (DAMAGE_PER_RUN * damageMultiplier) * 10;

            let nextShield = currentShield;
            let nextHp = currentHp;

            if (currentShield > 0) {
                if (currentShield >= damage) {
                    nextShield = currentShield - damage;
                } else {
                    const remainder = damage - currentShield;
                    nextShield = 0;
                    nextHp = Math.max(0, currentHp - remainder);
                }
            } else {
                nextHp = Math.max(0, currentHp - damage);
            }
            const nextHealth = Math.round((nextHp / maxHp) * 100);

            // 1. Process ResidueZone (ST_Difference):
            // Splitting residue into independent active polygons inheriting attributes (excluding HitZone area)
            // Filter area < 50m² to avoid slivers
            await tx.$executeRaw`
                WITH difference_geom AS (
                    SELECT ST_Difference(
                        t.geojson,
                        ST_SetSRID(ST_GeomFromGeoJSON(${combinedGeometryJson}), 4326)
                    ) as geom
                    FROM territories t
                    WHERE t.id = ${targetId}
                ),
                dumped_polygons AS (
                    SELECT (ST_Dump(ST_CollectionExtract(ST_MakeValid(geom), 3))).geom AS single_geom
                    FROM difference_geom
                ),
                calculated AS (
                    SELECT 
                        single_geom,
                        ST_Area(single_geom::geography) AS real_area
                    FROM dumped_polygons
                )
                INSERT INTO territories (
                    id, city_id, owner_id, owner_club_id, owner_faction, geojson, geojson_json,
                    source_run_id, first_claimed_at, last_claimed_at,
                    max_hp, current_hp, health, territory_type, score_weight, status,
                    area_m2_exact, level, shield
                )
                SELECT
                    'terr_' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 24),
                    t.city_id,
                    t.owner_id,
                    t.owner_club_id,
                    t.owner_faction,
                    c.single_geom,
                    ST_AsGeoJSON(c.single_geom)::jsonb,
                    t.source_run_id,
                    t.first_claimed_at,
                    NOW(),
                    t.max_hp,
                    t.current_hp, -- inherits original current_hp
                    t.health,     -- inherits original health percentage
                    t.territory_type,
                    t.score_weight,
                    'ACTIVE'::"TerritoryStatus",
                    c.real_area,
                    t.level,
                    t.shield
                FROM calculated c
                CROSS JOIN territories t
                WHERE t.id = ${targetId} AND c.real_area >= 50
            `;

            // 2. Process HitZone (ST_Intersection):
            if (nextHp <= 0) {
                // Destroyed / Captured: Attacker captures it.
                // Do NOT subtract from workingPolygons.
                result.destroyedTerritories++;
                result.damageDetails.push({
                    territoryId: targetId,
                    ownerName: existingTerr.owner_name || 'Unknown',
                    damage: currentHp,
                    territoryType: existingTerr.territory_type,
                    isDestroyed: true
                });
            } else {
                // Damaged but not destroyed: Defender keeps HitZone with reduced HP.
                // Subtract HitZone from attacker's workingPolygons.
                const hitZoneRows = await tx.$queryRaw<{ id: string; geometry: any }[]>`
                    WITH intersection_geom AS (
                        SELECT ST_Intersection(
                            t.geojson,
                            ST_SetSRID(ST_GeomFromGeoJSON(${combinedGeometryJson}), 4326)
                        ) as geom
                        FROM territories t
                        WHERE t.id = ${targetId}
                    ),
                    dumped_polygons AS (
                        SELECT (ST_Dump(ST_CollectionExtract(ST_MakeValid(geom), 3))).geom AS single_geom
                        FROM intersection_geom
                    )
                    SELECT 
                        ${targetId} as id,
                        ST_AsGeoJSON(single_geom)::jsonb as geometry
                    FROM dumped_polygons
                    WHERE ST_Area(single_geom::geography) >= 50
                `;

                for (const row of hitZoneRows) {
                    const hitZoneFeature = turf.feature(row.geometry) as Feature<Polygon | MultiPolygon>;
                    
                    // Subtract from workingPolygons
                    const newWorkingPolygons: Feature<Polygon>[] = [];
                    for (const poly of workingPolygons) {
                        const diff = difference(
                            turf.featureCollection([
                                poly,
                                hitZoneFeature
                            ])
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

                    // Insert HitZone as defender's damaged territory
                    await tx.$executeRaw`
                        WITH geom_holder AS (
                            SELECT ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(row.geometry)}), 4326) AS geom
                        ),
                        calculated AS (
                            SELECT 
                                geom,
                                ST_Area(geom::geography) AS real_area
                            FROM geom_holder
                        )
                        INSERT INTO territories (
                            id, city_id, owner_id, owner_club_id, owner_faction, geojson, geojson_json,
                            source_run_id, first_claimed_at, last_claimed_at,
                            max_hp, current_hp, health, territory_type, score_weight, status,
                            area_m2_exact, level, shield
                        )
                        SELECT
                            'terr_' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 24),
                            t.city_id,
                            t.owner_id,
                            t.owner_club_id,
                            t.owner_faction,
                            c.geom,
                            ST_AsGeoJSON(c.geom)::jsonb,
                            t.source_run_id,
                            t.first_claimed_at,
                            NOW(),
                            t.max_hp,
                            CAST(${nextHp} AS INTEGER),
                            CAST(${nextHealth} AS INTEGER),
                            t.territory_type,
                            t.score_weight,
                            'ACTIVE'::"TerritoryStatus",
                            c.real_area,
                            t.level,
                            CAST(${nextShield} AS INTEGER)
                        FROM calculated c
                        CROSS JOIN territories t
                        WHERE t.id = ${targetId} AND c.real_area >= 50
                    `;
                }

                result.damagedTerritories++;
                result.damageDetails.push({
                    territoryId: targetId,
                    ownerName: existingTerr.owner_name || 'Unknown',
                    damage: damage,
                    territoryType: existingTerr.territory_type,
                    isDestroyed: false
                });
            }

            // Mark the original territory as SUPERSEDED (since it has been replaced/split)
            await tx.territories.update({
                where: { id: targetId },
                data: {
                    status: 'SUPERSEDED' as any,
                    health: 0,
                    current_hp: 0,
                    shield: 0,
                    last_attacked_at: new Date()
                }
            });
        }

        // 4. Generate New Territories (Discrete Polygons insertion)
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

            // Insert each remaining polygon in workingPolygons as a separate record
            for (const poly of workingPolygons) {
                const preCalcArea = turf.area(poly);

                if (preCalcArea >= 50) { // filter slivers < 50m²
                    const newId = `terr_${globalThis.crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
                    const geojsonStr = JSON.stringify(poly.geometry);

                    const affectedRows = await tx.$executeRaw`
                        WITH validated AS (
                            SELECT ST_CollectionExtract(
                                ST_MakeValid(ST_GeomFromGeoJSON(${geojsonStr}::text)),
                                3
                            ) AS geom
                        ),
                        calculated AS (
                            SELECT 
                                geom,
                                ST_Area(geom::geography) AS real_area
                            FROM validated
                        )
                        INSERT INTO territories (
                            id, city_id, owner_id, owner_club_id, owner_faction, geojson, geojson_json,
                            source_run_id, first_claimed_at, last_claimed_at,
                            max_hp, current_hp, health, territory_type, score_weight, status,
                            area_m2_exact, shield
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
                            real_area,
                            0
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
        }

        // 5. Connected network recursive CTE calculation (Chain & Decay)
        const usersToRefresh = new Set<string>();
        usersToRefresh.add(userId);
        for (const existingTerr of overlappingTerritories) {
            if (existingTerr.owner_id) {
                usersToRefresh.add(existingTerr.owner_id);
            }
        }

        const usersArray = Array.from(usersToRefresh);
        for (const uid of usersArray) {
            // Find base camp ID: level DESC, area_m2_exact DESC
            const baseCampRows = await tx.$queryRaw<{ id: string }[]>`
                SELECT id
                FROM territories
                WHERE owner_id = ${uid}::uuid
                  AND city_id = ${cityId}
                  AND status = 'ACTIVE'::"TerritoryStatus"
                ORDER BY level DESC, area_m2_exact DESC
                LIMIT 1
            `;

            if (baseCampRows.length > 0) {
                const baseCampId = baseCampRows[0].id;
                // Recursive CTE checking connectivity to baseCampId
                await tx.$executeRaw`
                    WITH RECURSIVE connected_nodes AS (
                        -- Anchor
                        SELECT id, geojson
                        FROM territories
                        WHERE id = ${baseCampId} 
                          AND status = 'ACTIVE'::"TerritoryStatus"

                        UNION

                        -- Recursive step
                        SELECT t.id, t.geojson
                        FROM territories t
                        INNER JOIN connected_nodes c ON ST_Intersects(t.geojson, c.geojson)
                        WHERE t.owner_id = ${uid}::uuid
                          AND t.city_id = ${cityId}
                          AND t.status = 'ACTIVE'::"TerritoryStatus"
                    )
                    UPDATE territories
                    SET is_isolated = CASE 
                        WHEN id IN (SELECT id FROM connected_nodes) THEN false 
                        ELSE true 
                    END
                    WHERE owner_id = ${uid}::uuid
                      AND city_id = ${cityId}
                      AND status = 'ACTIVE'::"TerritoryStatus"
                `;
            }
        }

        if (result.createdTerritories > 0 || result.reinforcedTerritories > 0 || result.destroyedTerritories > 0 || result.damagedTerritories > 0) {
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
                    ), 0)
                    WHERE id = ${clubId}::uuid
                `;
            }

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
    }, { isolationLevel: 'Serializable', timeout: 30000 });

    // Fire-and-forget gamification task
    if (finalSettledResult.success) {
        const run = await prisma.runs.findUnique({ where: { id: runId }, select: { distance: true } });
        if (run) {
            try {
                await tasks.trigger<typeof processPostRunRewards>("process-post-run-rewards", {
                    userId,
                    runId,
                    distanceKm: run.distance ? (run.distance / 1000) : 0,
                    createdTerritories: finalSettledResult.createdTerritories,
                    triggeredEventIds: (finalSettledResult as any).triggeredEventIds || [],
                });
            } catch (err: any) {
                console.error('[processTerritorySettlement] Failed to trigger process-post-run-rewards task:', err.message);
            }
        }
    }

    if (clubId) {
        await TerritoryStatsAggregatorService.processNextBatch();
    }
    return finalSettledResult;
}


