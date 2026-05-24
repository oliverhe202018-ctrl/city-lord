import { task } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { getTitle } from '@/lib/game-logic/level-system';
import { tasks } from "@trigger.dev/sdk/v3";
import { updateMissionProgress } from "@/lib/game-logic/mission-service";
import { validateRunAndRebuildTerritories } from "@/lib/anti-cheat/territory-builder";
import { validateRunData } from "@/lib/validators/run-validator";
import { validateRunLegitimacy } from "@/lib/anti-cheat/mvp-rules";
import { isTester } from "@/lib/constants/anti-cheat";
import { cleanAndSplitTrajectory } from "@/lib/gis/geometry-cleaner";
import { processTerritorySettlement } from "@/lib/territory/settlement";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import {
    lineString as turfLineString,
    simplify as turfSimplify,
    polygon as turfPolygon,
    unkinkPolygon as turfUnkinkPolygon,
    area as turfArea,
    bbox as turfBbox,
    intersect as turfIntersect,
    featureCollection as turfFeatureCollection,
    union as turfUnion,
    length as turfLength,
    convex as turfConvex,
    point as turfPoint,
    kinks as turfKinks,
} from '@turf/turf';

import { reverseGeocodeCity } from '@/lib/map/server-geocode';

const EARTH_CORE_CITY_ID = 'EARTH_CORE_000';

type Coord = [number, number];

const PEDOMETER_STRICT_DISTANCE_METERS = 500;
const PEDOMETER_MIN_STEPS = 100;
const PEDOMETER_MAX_STRIDE_METERS = 1.5;

function haversineDistance([lng1, lat1]: Coord, [lng2, lat2]: Coord): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointToSegmentDistance(p: Coord, a: Coord, b: Coord): { dist: number; t: number } {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { dist: haversineDistance(p, a), t: 0 };
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
    const proj: Coord = [a[0] + t * dx, a[1] + t * dy];
    return { dist: haversineDistance(p, proj), t };
}

function rdpSamplePath(points: any[], maxPoints: number): any[] {
    if (points.length <= maxPoints) return points;
    const line = turfLineString(points.map((p: any) => [p.lng, p.lat]));
    let tolerance = 0.00001;
    let simplified = points;
    while (simplified.length > maxPoints && tolerance < 0.01) {
        const result = turfSimplify(line, { tolerance, highQuality: false });
        simplified = result.geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng }));
        tolerance *= 2;
    }
    return simplified;
}

function deduplicateRingPoints(ring: Coord[]): Coord[] {
    if (ring.length === 0) return ring;
    const result: Coord[] = [ring[0]];
    for (let i = 1; i < ring.length; i++) {
        const prev = result[result.length - 1];
        const curr = ring[i];
        if (Math.abs(curr[0] - prev[0]) > 1e-6 || Math.abs(curr[1] - prev[1]) > 1e-6) {
            result.push(curr);
        }
    }
    return result;
}

function normalizeRunPolygon(closingPath: Coord[]): {
    polygons: { lng: number; lat: number }[][];
    strategy: string;
    kinkCount: number;
    rawArea?: number;
    finalArea?: number;
    areaInflationRatio?: number;
} {
    if (closingPath.length < 3) return { polygons: [], strategy: 'raw', kinkCount: 0 };

    const ring = [...closingPath];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
    }

    const cleanRing = deduplicateRingPoints(ring);
    if (cleanRing.length < 4) return { polygons: [], strategy: 'raw', kinkCount: 0 };

    let rawPoly;
    try {
        rawPoly = turfPolygon([cleanRing]);
    } catch {
        return { polygons: [], strategy: 'raw', kinkCount: 0 };
    }

    let kinks;
    try {
        kinks = turfKinks(rawPoly);
    } catch {
        return { polygons: [], strategy: 'raw', kinkCount: 0 };
    }
    const kinkCount = kinks.features.length;
    const rawArea = turfArea(rawPoly);

    if (kinkCount === 0) {
        return {
            polygons: [cleanRing.map(([lng, lat]) => ({ lng, lat }))],
            strategy: 'raw',
            kinkCount,
            rawArea,
            finalArea: rawArea,
            areaInflationRatio: 1
        };
    }

    try {
        const unkinked = turfUnkinkPolygon(rawPoly);
        let maxArea = 0;
        let maxPolyPoints: { lng: number; lat: number }[] = [];

        unkinked.features.forEach((f: any) => {
            const area = turfArea(f);
            if (area > maxArea) {
                maxArea = area;
                if (f.geometry.coordinates[0]) {
                    maxPolyPoints = f.geometry.coordinates[0].map((coord: any) => ({ lng: coord[0], lat: coord[1] }));
                }
            }
        });

        if (maxPolyPoints.length > 0) {
            return {
                polygons: [maxPolyPoints],
                strategy: 'unkink',
                kinkCount,
                rawArea,
                finalArea: maxArea,
                areaInflationRatio: rawArea > 0 ? (maxArea / rawArea) : 1
            };
        }
    } catch { /* skip */ }

    try {
        const points = turfFeatureCollection(ring.map(p => turfPoint(p)));
        const hull = turfConvex(points);
        if (hull && hull.geometry?.coordinates?.[0]) {
            const hullRing = hull.geometry.coordinates[0];
            const finalArea = turfArea(hull);
            return {
                polygons: [hullRing.map((coord: any) => ({ lng: coord[0], lat: coord[1] }))],
                strategy: 'convex_fallback',
                kinkCount,
                rawArea,
                finalArea,
                areaInflationRatio: rawArea > 0 ? (finalArea / rawArea) : 1
            };
        }
    } catch { /* skip */ }

    return { polygons: [], strategy: 'raw', kinkCount };
}

async function resolveRunCityId(runData: any): Promise<string | null> {
    const pathPoints = runData.path;
    if (!pathPoints || pathPoints.length === 0) return null;
    const resolved = await resolveCityFromPath(pathPoints);
    return resolved;
}

async function resolveCityFromPath(sampledPoints: { lng: number; lat: number }[]): Promise<string | null> {
    if (!sampledPoints || sampledPoints.length === 0) return null;
    const validPoints = sampledPoints.filter((point) =>
        Number.isFinite(point.lng) && Number.isFinite(point.lat)
    );
    if (validPoints.length === 0) return null;

    const candidateIndices = [0, validPoints.length - 1, Math.floor(validPoints.length / 4)];

    for (const idx of candidateIndices) {
        if (idx < 0 || idx >= validPoints.length) continue;
        const { lng, lat } = validPoints[idx];
        try {
            const { cityName, adcode } = await reverseGeocodeCity(lat, lng);
            if (cityName || adcode) {
                return await resolveCityFromGeocode(cityName, adcode, lng, lat);
            }
        } catch (err) {
            console.warn(`[resolveCityFromPath] Point ${idx} failed`, err);
        }
    }
    return null;
}

async function resolveCityFromGeocode(cityName: string | null, adcode: string | null, lng: number, lat: number): Promise<string | null> {
    if (!cityName && !adcode) return null;

    const normalizedCityName = cityName ? cityName.replace(/市$/, '').replace(/省$/, '').trim() : null;

    let adcodeMatches: string[] = [];
    if (typeof adcode === 'string') {
        if (adcode.length === 6) {
            adcodeMatches.push(`${adcode.slice(0, 4)}00`);
        } else if (adcode.length === 4) {
            adcodeMatches.push(`${adcode}00`);
        } else if (adcode.length === 2) {
            adcodeMatches.push(`${adcode}0000`);
        } else {
            adcodeMatches.push(adcode);
        }
    }

    type CityIdRow = { id: string };
    const existingCityRows = await prisma.$queryRaw<CityIdRow[]>`
        SELECT id FROM public.cities
        WHERE adcode = ANY(${adcodeMatches}::text[])
           OR (${normalizedCityName} IS NOT NULL AND name = ${normalizedCityName})
        LIMIT 1
    `;
    if (existingCityRows.length > 0) return existingCityRows[0].id;
    if (!normalizedCityName) return null;

    const adcodeToInsert = adcodeMatches.length > 0 ? adcodeMatches[0] : (typeof adcode === 'string' ? adcode : null);
    const newCity = await prisma.cities.create({
        data: { name: normalizedCityName, adcode: adcodeToInsert, created_at: new Date() }
    });
    return newCity.id;
}

async function ensureCityIdExists(resolvedCityId: string | null, path: any[]): Promise<string | null> {
    if (resolvedCityId) return resolvedCityId;

    try {
        const validPoints = path.filter((p: any) => Number.isFinite(p.lng) && Number.isFinite(p.lat));
        if (validPoints.length > 0) {
            const { lng, lat } = validPoints[0];
            const nearbyCities = await prisma.$queryRaw`
                SELECT id FROM public.cities
                WHERE ST_DWithin(
                    location,
                    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
                    50000
                )
                ORDER BY location <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
                LIMIT 1
            `;
            if ((nearbyCities as any[]).length > 0) return (nearbyCities as any[])[0].id;
        }
    } catch { }

    return EARTH_CORE_CITY_ID;
}

export const runSettlementTask = task({
    id: "run-settlement",
    maxDuration: 600,
    retry: { maxAttempts: 3 },
    run: async (payload: { runId: string }) => {
        const { runId } = payload;
        console.log(`[run-settlement] Starting settlement for runId=${runId}`);

        let runRecord: any;
        try {
            runRecord = await prisma.runs.findUnique({ where: { id: runId } });
        } catch (err) {
            console.error(`[run-settlement] Failed to fetch run ${runId}`, err);
            return { success: false, error: 'Run not found' };
        }

        if (!runRecord) {
            console.error(`[run-settlement] Run ${runId} not found`);
            return { success: false, error: 'Run not found' };
        }

        if (runRecord.status === 'completed' || runRecord.status === 'flagged') {
            console.log(`[run-settlement] Run ${runId} already settled (status=${runRecord.status}), skipping`);
            return { success: true, skipped: true };
        }

        const userId = runRecord.user_id;
        const runData = {
            idempotencyKey: runRecord.idempotency_key,
            distance: runRecord.distance,
            duration: runRecord.duration,
            path: runRecord.path || [],
            polygons: runRecord.polygons || [],
            timestamp: runRecord.timestamp?.getTime() || Date.now(),
            calories: runRecord.calories,
            clubId: runRecord.club_id,
            totalSteps: runRecord.totalSteps,
            steps: runRecord.steps,
            eventsHistory: runRecord.eventsLog || [],
        };

        const submittedTotalSteps = Math.max(0, Math.floor(Number(runData.totalSteps ?? runData.steps ?? 0)));
        let runnerClubId = runRecord.club_id;

        try {
            const rawPathPointsForGIS = runData.path || [];
            if (rawPathPointsForGIS.length > 500) {
                const line = turfLineString(rawPathPointsForGIS.map((p: any) => [p.lng, p.lat]));
                const simplified = turfSimplify(line, { tolerance: 0.0001, highQuality: false });
                const startTime = rawPathPointsForGIS[0]?.timestamp || Date.now();
                const endTime = rawPathPointsForGIS[rawPathPointsForGIS.length - 1]?.timestamp || Date.now();
                const count = simplified.geometry.coordinates.length;
                runData.path = simplified.geometry.coordinates.map(([lng, lat]: any, idx: number) => ({
                    lat, lng,
                    timestamp: Math.floor(startTime + (endTime - startTime) * (idx / Math.max(1, count - 1)))
                }));
            }
        } catch (simplifyErr) {
            console.warn('[run-settlement] Path simplification failed', simplifyErr);
        }

        const pathPoints = runData.path || [];
        const legitimacyCheck = validateRunLegitimacy({
            distanceKm: runData.distance / 1000,
            durationSeconds: runData.duration,
            pathPointsCount: pathPoints.length
        });

        const isUserTester = isTester(userId);
        if (isUserTester) {
            (legitimacyCheck as any).isValid = true;
        }

        let isBlockedByLegitimacy = false;
        if (!legitimacyCheck.isValid && !isUserTester) {
            isBlockedByLegitimacy = true;
            console.warn(`[run-settlement] Legitimacy check failed for user ${userId}: ${legitimacyCheck.reason}`);
        }

        const metadataValidation = validateRunData({
            distanceMeters: runData.distance,
            durationSeconds: runData.duration,
            steps: submittedTotalSteps
        });

        const pathValidation = validateRunAndRebuildTerritories(runData.path);

        let pedometerAntiCheatLog: string | null = null;
        if (runData.distance > PEDOMETER_STRICT_DISTANCE_METERS) {
            if (submittedTotalSteps < PEDOMETER_MIN_STEPS) {
                pedometerAntiCheatLog = 'STEP_TOO_LOW';
            } else {
                const strideLength = runData.distance / submittedTotalSteps;
                if (strideLength > PEDOMETER_MAX_STRIDE_METERS) {
                    pedometerAntiCheatLog = 'STRIDE_TOO_LONG';
                }
            }
        }

        let isFlagged = metadataValidation.isFlagged || pathValidation.riskLevel === 'HIGH';
        let isPedometerInvalid = pedometerAntiCheatLog !== null;
        let effectiveRiskLevel = pathValidation.riskLevel;

        if (isUserTester) {
            isFlagged = false;
            isPedometerInvalid = false;
            pedometerAntiCheatLog = null;
            effectiveRiskLevel = 'LOW';
        }

        const isBlockedByAntiCheat = isBlockedByLegitimacy || isFlagged || isPedometerInvalid;
        const flagReason = metadataValidation.flagReason || (effectiveRiskLevel === 'HIGH' ? 'PATH_ANALYSIS_FAILED' : undefined);

        const MAX_SERVER_PATH_POINTS = 600;
        const sampledPath = rdpSamplePath(runData.path, MAX_SERVER_PATH_POINTS);
        const sampledPointsLngLat = sampledPath.map((p: any) => [p.lng, p.lat] as [number, number]);

        let finalPolygons: { lng: number; lat: number }[][] = [];
    let diagData: any = { status: 'init' };

        if (sampledPointsLngLat.length >= 3) {
            const lastPoint = sampledPointsLngLat[sampledPointsLngLat.length - 1];
            const firstPoint = sampledPointsLngLat[0];
            let closingPath: Coord[] | null = null;

            const distGlobal = haversineDistance(lastPoint, firstPoint);
            const START_END_SNAP_THRESHOLD_M = 20;

            if (distGlobal <= START_END_SNAP_THRESHOLD_M && sampledPointsLngLat.length >= 4) {
                closingPath = [...sampledPointsLngLat, [firstPoint[0], firstPoint[1]] as Coord];
            } else {
                const MIN_LOOP_SEGMENT_INDEX = 10;
                const MAX_SEARCH_SEGMENT_INDEX = Math.min(
                    Math.floor(sampledPointsLngLat.length * 0.70),
                    sampledPointsLngLat.length - 2
                );
                const SEGMENT_CROSS_THRESHOLD_M = 15;

                let bestIndex = -1;
                let minDist = SEGMENT_CROSS_THRESHOLD_M + 1;

                for (let i = MIN_LOOP_SEGMENT_INDEX; i < MAX_SEARCH_SEGMENT_INDEX; i++) {
                    const segA = sampledPointsLngLat[i];
                    const segB = sampledPointsLngLat[i + 1];
                    if (!segA || !segB) continue;
                    const { dist } = pointToSegmentDistance(lastPoint, segA, segB);
                    if (dist <= SEGMENT_CROSS_THRESHOLD_M && dist < minDist) {
                        minDist = dist;
                        bestIndex = i;
                    }
                }

                if (bestIndex !== -1) {
                    closingPath = sampledPointsLngLat.slice(bestIndex);
                }
            }

            if (closingPath && closingPath.length >= 3) {
                const normResult = normalizeRunPolygon(closingPath);
                finalPolygons = normResult.polygons;
                diagData.strategy = normResult.strategy;
                diagData.kinkCount = normResult.kinkCount;
                diagData.rawArea = normResult.rawArea;
                diagData.finalArea = normResult.finalArea;
                diagData.areaInflationRatio = normResult.areaInflationRatio;
            }
        }

        const isGeometryInvalid = diagData.areaInflationRatio && diagData.areaInflationRatio > 1.35;

        if (isBlockedByAntiCheat || isGeometryInvalid) {
            finalPolygons = [];
        } else if (effectiveRiskLevel === 'MEDIUM' && !isUserTester) {
            finalPolygons = [];
        }

        function deduplicateByContainment(polygons: any[]): any[] {
            if (polygons.length <= 1) return polygons;

            const withData = polygons.flatMap((polyPts: any) => {
                const coords = polyPts.map((p: any) => [p.lng, p.lat] as Coord);
                try {
                    if (coords.length < 3) return [];
                    const ring = [...coords];
                    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
                        ring.push([...ring[0]]);
                    }
                    const cleanRing = deduplicateRingPoints(ring);
                    if (cleanRing.length < 4) return [];

                    const rawPoly = turfPolygon([cleanRing]);
                    const unkinked = turfUnkinkPolygon(rawPoly);

                    const MIN_ISO_RATIO = 0.003;
                    const MAX_TERRITORY_AREA_M2 = 200_000;
                    return unkinked.features
                        .filter((f: any) => {
                            const area = turfArea(f);
                            if (area <= 50) return false;
                            if (area > MAX_TERRITORY_AREA_M2) return false;
                            try {
                                const perimeterM = turfLength(f) * 1000;
                                if (perimeterM <= 0) return false;
                                const isoRatio = (4 * Math.PI * area) / (perimeterM * perimeterM);
                                if (isoRatio < MIN_ISO_RATIO) return false;
                            } catch { return false; }
                            try {
                                const hull = turfConvex(f);
                                if (hull) {
                                    const hullArea = turfArea(hull);
                                    const convexityRatio = hullArea > 0 ? (area / hullArea) : 1;
                                    if (convexityRatio < 0.55) return false;
                                }
                            } catch { }
                            return true;
                        })
                        .map((f: any) => ({
                            original: polyPts,
                            f: f as Feature<Polygon>,
                            area: turfArea(f),
                            bbox: turfBbox(f)
                        }));
                } catch {
                    return [];
                }
            });

            const sorted = withData.sort((a: any, b: any) => b.area - a.area);
            const survivors: typeof sorted = [];
            for (const candidate of sorted) {
                let isContained = false;
                for (const big of survivors) {
                    // 优化2：BBox (包围盒) 快速重叠检查
                    const isNotOverlapping = 
                        candidate.bbox[0] > big.bbox[2] || // 候选件在右侧
                        candidate.bbox[2] < big.bbox[0] || // 候选件在左侧
                        candidate.bbox[1] > big.bbox[3] || // 候选件在上侧
                        candidate.bbox[3] < big.bbox[1];   // 候选件在下侧
                    const isBBoxOverlapping = !isNotOverlapping;

                    if (isBBoxOverlapping) {
                        try {
                            const intersection = turfIntersect(turfFeatureCollection([big.f, candidate.f]));
                            if (intersection) {
                                const minArea = Math.min(big.area, candidate.area);
                                if (minArea > 0) {
                                    const overlapRatio = turfArea(intersection) / minArea;
                                    if (overlapRatio > 0.80) {
                                        isContained = true;
                                        break;
                                    }
                                }
                            }
                        } catch { }
                    }
                }
                if (!isContained) survivors.push(candidate);
            }
            return survivors.map(s => s.original);
        }

        const polygonsForSettlement = (isBlockedByAntiCheat || (effectiveRiskLevel === 'MEDIUM' && !isUserTester))
            ? [] : deduplicateByContainment(finalPolygons);

        let accurateAreaKm2 = 0;
        if (polygonsForSettlement.length > 0) {
            const validPolys: Feature<Polygon>[] = [];
            polygonsForSettlement.forEach((polyPts: any) => {
                const coords = polyPts.map((p: any) => [p.lng, p.lat] as Coord);
                try {
                    if (coords.length >= 3) {
                        const ring = [...coords];
                        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
                            ring.push([...ring[0]]);
                        }
                        const cleanRing = deduplicateRingPoints(ring);
                        if (cleanRing.length < 4) return;

                        const rawPoly = turfPolygon([cleanRing]);
                        const unkinked = turfUnkinkPolygon(rawPoly);
                        unkinked.features.forEach((f: any) => {
                            const area = turfArea(f);
                            if (area <= 50) return;
                            if (area > 200_000) return;
                            try {
                                const perimeterM = turfLength(f) * 1000;
                                if (perimeterM > 0) {
                                    const isoRatio = (4 * Math.PI * area) / (perimeterM * perimeterM);
                                    if (isoRatio < 0.003) return;
                                }
                            } catch { }
                            validPolys.push(f as Feature<Polygon>);
                        });
                    }
                } catch { }
            });

            if (validPolys.length > 0) {
                try {
                    let merged = validPolys[0] as Feature<Polygon | MultiPolygon>;
                    for (let i = 1; i < validPolys.length; i++) {
                        const combined = turfUnion(turfFeatureCollection([merged, validPolys[i]]));
                        if (combined) merged = combined as Feature<Polygon | MultiPolygon>;
                    }
                    accurateAreaKm2 = turfArea(merged) / 1000000;
                } catch { }
            }
        }

        const resolvedCityId = await resolveRunCityId(runData);
        const safeCityId = await ensureCityIdExists(resolvedCityId, runData.path || []);

        const userProfile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { faction: true, stamina: true, max_stamina: true }
        });
        const userFaction = userProfile?.faction ?? null;
        const currentStamina = userProfile?.stamina ?? 100;
        const maxStamina = userProfile?.max_stamina ?? 100;

        let finalRunStatus = isBlockedByAntiCheat ? 'flagged' : 'settling';
        let customFlagReason = flagReason;

        if (isGeometryInvalid) {
            finalRunStatus = 'flagged';
            customFlagReason = 'GEOMETRY_INVALID';
        }

        const distanceKm = pathValidation.serverDistance / 1000;
        const areaM2 = accurateAreaKm2 * 1_000_000;
        const baseCoins = Math.round(distanceKm * 2);
        const areaCoins = Math.round(areaM2 / 1000);
        const totalCoins = baseCoins + areaCoins;
        const totalXp = Math.round(distanceKm * 10) + Math.round(areaM2 / 500);

        const staminaCost = isBlockedByAntiCheat ? 0 : Math.max(0, Math.floor(10 + distanceKm * 10));
        const finalStamina = Math.max(0, currentStamina - staminaCost);

        try {
            const result = await prisma.$transaction(async (tx: any) => {
                const eventsHistory = Array.isArray(runData.eventsHistory) ? runData.eventsHistory : [];
                const runEventsWithDiag = [
                    ...eventsHistory,
                    {
                        eventId: `diag_${Date.now()}`,
                        eventType: 'DIAGNOSTIC',
                        status: 'SUCCESS',
                        triggeredAt: Date.now(),
                        resolvedAt: Date.now(),
                        data: {
                            geometryFixStrategy: diagData.strategy,
                            kinkCount: diagData.kinkCount,
                            rawArea: diagData.rawArea,
                            finalArea: diagData.finalArea,
                            areaInflationRatio: diagData.areaInflationRatio
                        }
                    }
                ];

                await tx.runs.update({
                    where: { id: runId },
                    data: {
                        distance: pathValidation.serverDistance,
                        duration: pathValidation.serverDuration,
                        area: accurateAreaKm2 * 1_000_000,
                        path: runData.path,
                        polygons: finalPolygons,
                        status: finalRunStatus,
                        updated_at: new Date(),
                        risk_score: isUserTester ? 0 : pathValidation.riskScore,
                        risk_level: isUserTester ? 'LOW' : pathValidation.riskLevel,
                        cheat_flags: {
                            ...(pathValidation.cheatFlags as any),
                            ...(isUserTester ? { tester_bypass: true } : {})
                        },
                        client_distance: runData.distance,
                        is_flagged: isUserTester ? false : (isFlagged || isGeometryInvalid),
                        flag_reason: isUserTester ? null : customFlagReason,
                        eventsLog: runEventsWithDiag,
                        totalSteps: submittedTotalSteps,
                        isValid: isUserTester ? true : (!isPedometerInvalid && !isGeometryInvalid),
                        antiCheatLog: isUserTester ? null : pedometerAntiCheatLog,
                        city_id: safeCityId,
                    }
                });

                if (isBlockedByAntiCheat || pathValidation.riskLevel !== 'LOW') {
                    await tx.anti_cheat_audit_logs.create({
                        data: {
                            user_id: userId,
                            run_id: runId,
                            risk_score: isPedometerInvalid ? Math.max(pathValidation.riskScore, 90) : pathValidation.riskScore,
                            cheat_flags: {
                                ...(pathValidation.cheatFlags as any),
                                pedometer_reason: pedometerAntiCheatLog
                            },
                            raw_payload: runData,
                            action_taken: isPedometerInvalid ? 'pedometer_blocked' : (isFlagged ? 'shadowban' : 'polygons_neutralized'),
                        }
                    });
                }

                if (isBlockedByAntiCheat) {
                    return { runId, rewards: { coins: 0, xp: 0 }, isValid: false };
                }

                if (safeCityId) {
                    await tx.user_city_progress.upsert({
                        where: { user_id_city_id: { user_id: userId, city_id: safeCityId } },
                        update: { last_active_at: new Date() },
                        create: {
                            user_id: userId,
                            city_id: safeCityId,
                            area_controlled: 0,
                            tiles_captured: 0,
                            last_active_at: new Date(),
                            joined_at: new Date()
                        }
                    });
                }

                if (!isFlagged) {
                    await tx.profiles.update({
                        where: { id: userId },
                        data: {
                            coins: { increment: totalCoins },
                            stamina: finalStamina,
                            total_distance_km: { increment: distanceKm },
                            total_runs_count: { increment: 1 },
                            updated_at: new Date()
                        }
                    });
                }

                return { runId, rewards: { coins: totalCoins, xp: totalXp }, isValid: !isBlockedByAntiCheat, totalArea: areaM2 };
            }, { timeout: 30000, maxWait: 10000 });

            if (!isBlockedByAntiCheat && !isGeometryInvalid && polygonsForSettlement.length > 0) {
                try {
                    await tasks.trigger("settle-territories", {
                        runId,
                        userId,
                        cityId: safeCityId,
                        clubId: runnerClubId,
                        polygons: polygonsForSettlement,
                        distance: pathValidation.serverDistance,
                        duration: pathValidation.serverDuration,
                        diag: diagData
                    });
                    console.log(`[run-settlement] settle-territories triggered for runId=${runId}`);
                } catch (triggerErr) {
                    console.error('[run-settlement] Failed to trigger settle-territories', triggerErr);
                }
            }

            await prisma.runs.update({
                where: { id: runId },
                data: { status: 'completed', updated_at: new Date() }
            });

            try {
                const pathPoints = runData.path;
                if (pathPoints && pathPoints.length > 0) {
                    const firstPoint = pathPoints[0];
                    if (firstPoint && typeof firstPoint.lat === 'number' && typeof firstPoint.lng === 'number') {
                        const { cityName, adcode, districtCode, provinceCode } = await reverseGeocodeCity(firstPoint.lat, firstPoint.lng);
                        if (adcode || cityName || districtCode || provinceCode) {
                            await prisma.profiles.update({
                                where: { id: userId },
                                data: {
                                    ...(adcode ? { city_code: adcode } : {}),
                                    ...(cityName ? { city_name: cityName } : {}),
                                    ...(districtCode ? { district_code: districtCode } : {}),
                                    ...(provinceCode ? { province_code: provinceCode } : {}),
                                    updated_at: new Date(),
                                },
                            });
                            console.log(`[run-settlement] geo updated for userId=${userId}: city_code=${adcode}, district_code=${districtCode}, province_code=${provinceCode}`);
                        }
                    }
                }
            } catch (geoErr) {
                console.error('[run-settlement] Failed to update geo metadata:', geoErr);
            }

            revalidatePath('/dashboard');
            revalidatePath('/profile/me');
            revalidateTag('territories');
            revalidateTag('city-stats');
            revalidateTag('city-leaderboard');

            if (!isBlockedByAntiCheat) {
                const distKm = pathValidation.serverDistance / 1000;
                const durationMin = pathValidation.serverDuration / 60;
                const totalArea = result.totalArea ?? 0;

                const asyncTasks: Promise<unknown>[] = [];

                asyncTasks.push(
                    updateMissionProgress(userId, 'DISTANCE', Math.round(distKm * 1000))
                        .catch(err => console.error('[Settlement Async] DISTANCE progress failed:', err))
                );
                asyncTasks.push(
                    updateMissionProgress(userId, 'RUN_COUNT', 1)
                        .catch(err => console.error('[Settlement Async] RUN_COUNT progress failed:', err))
                );
                if (finalPolygons.length > 0) {
                    asyncTasks.push(
                        updateMissionProgress(userId, 'HEX_COUNT', finalPolygons.length)
                            .catch(err => console.error('[Settlement Async] HEX_COUNT progress failed:', err))
                    );
                }

                if (totalArea > 0 && userFaction) {
                    asyncTasks.push(
                        prisma.faction_stats_snapshot.upsert({
                            where: { id: 'global_daily' },
                            update: userFaction === 'Red'
                                ? { red_area: { increment: totalArea } }
                                : { blue_area: { increment: totalArea } },
                            create: {
                                id: 'global_daily',
                                red_area: userFaction === 'Red' ? totalArea : 0,
                                blue_area: userFaction === 'Blue' ? totalArea : 0
                            }
                        }).catch(err => console.error('[Settlement Async] Faction stats upsert failed:', err))
                    );
                }

                if (runnerClubId && totalArea > 0) {
                    asyncTasks.push(
                        prisma.club_members.updateMany({
                            where: { user_id: userId, club_id: runnerClubId },
                            data: { territory_contribution: { increment: totalArea } }
                        }).catch(err => console.error('[Settlement Async] Club contribution failed:', err))
                    );
                }

                asyncTasks.push(
                    (async () => {
                        const { addExperienceUnified } = await import('@/lib/game-logic/experience-service');
                        const levelResult = await addExperienceUnified(userId, totalXp, 'RUN_SETTLEMENT');
                        if (levelResult.levelUp) {
                            console.log(`[run-settlement] LEVEL_UP for userId=${userId}: ${levelResult.newLevel - 1} → ${levelResult.newLevel}`);
                        }
                    })().catch(err => console.error('[Settlement Async] XP/Level-up failed:', err))
                );

                asyncTasks.push(
                    (async () => {
                        const { checkAndAwardBadges } = await import('@/lib/game-logic/achievement-core');
                        const pace = durationMin > 0 ? distKm / durationMin : 0;
                        await checkAndAwardBadges(userId, 'RUN_FINISHED', {
                            distance: pathValidation.serverDistance,
                            duration: pathValidation.serverDuration,
                            pace,
                            area: totalArea,
                            endTime: new Date()
                        });
                    })().catch(err => console.error('[Settlement Async] Badge scan failed:', err))
                );

                Promise.allSettled(asyncTasks).catch(err =>
                    console.error('[Settlement Async Chain Error]', err)
                );
            }

            console.log(`[run-settlement] ✅ Completed for runId=${runId}`);
            return { success: true, ...result };

        } catch (txErr: any) {
            console.error(`[run-settlement] Transaction failed for runId=${runId}`, txErr);
            await prisma.runs.update({
                where: { id: runId },
                data: { status: 'flagged', updated_at: new Date() }
            }).catch(() => { });
            return { success: false, error: txErr.message };
        }
    }
});
