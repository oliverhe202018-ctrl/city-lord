import { AntiCheatValidator, AntiCheatContext, AntiCheatCheckResult } from '../types';
import { ErrorCode } from '@/lib/api/errors';
import { extractValidLoops } from '@/lib/geometry-utils';
import { MIN_TERRITORY_AREA_M2 } from '@/lib/constants/territory';
import {
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
    simplify as turfSimplify
} from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

function deduplicateRingPoints(ring: [number, number][]): [number, number][] {
    if (ring.length === 0) return ring;
    const result: [number, number][] = [ring[0]];
    for (let i = 1; i < ring.length; i++) {
        const prev = result[result.length - 1];
        const curr = ring[i];
        if (Math.abs(curr[0] - prev[0]) > 1e-6 || Math.abs(curr[1] - prev[1]) > 1e-6) {
            result.push(curr);
        }
    }
    return result;
}

function normalizeRunPolygon(closingPath: [number, number][]): {
    polygons: { lng: number; lat: number }[][];
    strategy: 'raw' | 'unkink' | 'convex_fallback';
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
    } catch (e) {
        return { polygons: [], strategy: 'raw', kinkCount: 0 };
    }

    let kinks;
    try {
        kinks = turfKinks(rawPoly);
    } catch (e) {
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
    } catch (e) {
        console.warn('[normalizeRunPolygon] unkink failed:', e);
    }

    try {
        const points = turfFeatureCollection(ring.map(p => turfPoint(p)));
        const hull = turfConvex(points);
        if (hull && hull.geometry?.coordinates?.[0]) {
            const hullRing = hull.geometry.coordinates[0];
            const finalArea = turfArea(hull);
            const areaInflationRatio = rawArea > 0 ? (finalArea / rawArea) : 1;

            if (areaInflationRatio > 1.10) {
                console.warn(`[PolygonLegitimacyValidator] Convex fallback rejected due to area inflation: ${areaInflationRatio.toFixed(2)} > 1.10`);
                return { polygons: [], strategy: 'raw', kinkCount };
            }

            return {
                polygons: [hullRing.map((coord: any) => ({ lng: coord[0], lat: coord[1] }))],
                strategy: 'convex_fallback',
                kinkCount,
                rawArea,
                finalArea,
                areaInflationRatio
            };
        }
    } catch (e) {
        console.warn('[normalizeRunPolygon] convex failed:', e);
    }

    return { polygons: [], strategy: 'raw', kinkCount };
}

function deduplicateByContainment(polygons: any[]): any[] {
    if (polygons.length <= 1) return polygons;

    const withData = polygons.flatMap(polyPts => {
        const coords = polyPts.map((p: any) => [p.lng, p.lat] as [number, number]);
        
        try {
            if (coords.length < 3) return [];
            const ring = [...coords];
            if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) {
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
                    if (area <= MIN_TERRITORY_AREA_M2) return false;
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
                            if (convexityRatio < 0.30) return false;
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
        } catch (e) {
            console.warn('[GIS] Failed to unkink polygon during deduplication:', e);
            return [];
        }
    });

    const sorted = withData.sort((a, b) => b.area - a.area);
    const survivors: typeof sorted = [];
    for (const candidate of sorted) {
        let isContained = false;
        for (const big of survivors) {
            const isNotOverlapping = 
                candidate.bbox[0] > big.bbox[2] ||
                candidate.bbox[2] < big.bbox[0] ||
                candidate.bbox[1] > big.bbox[3] ||
                candidate.bbox[3] < big.bbox[1];

            if (!isNotOverlapping) {
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
                } catch (e) { }
            }
        }
        if (!isContained) survivors.push(candidate);
    }
    return survivors.map(s => s.original);
}

export class PolygonLegitimacyValidator implements AntiCheatValidator {
    name = 'PolygonLegitimacyValidator';

    async validate(ctx: AntiCheatContext): Promise<AntiCheatCheckResult> {
        // Yield to the event loop for heavy CPU/Turf calculation
        await new Promise(resolve => setImmediate(resolve));

        const rawPathPoints = ctx.pathPoints;
        let diagData: any = { status: 'init' };
        let finalPolygons: any[] = [];
        
        let totalRawArea = 0;
        let totalFinalArea = 0;
        let totalKinkCount = 0;
        let finalStrategy: 'raw' | 'unkink' | 'convex_fallback' = 'raw';

        const loops = extractValidLoops(rawPathPoints);

        for (const loop of loops) {
            const closingPath = loop.map((p: any) => [p.lng, p.lat] as [number, number]);
            const normResult = normalizeRunPolygon(closingPath);
            
            for (const poly of normResult.polygons) {
                finalPolygons.push(poly);
            }
            if (normResult.rawArea) totalRawArea += normResult.rawArea;
            if (normResult.finalArea) totalFinalArea += normResult.finalArea;
            totalKinkCount += normResult.kinkCount;
            if (normResult.strategy === 'convex_fallback') {
                finalStrategy = 'convex_fallback';
            } else if (normResult.strategy === 'unkink' && finalStrategy !== 'convex_fallback') {
                finalStrategy = 'unkink';
            }
        }

        diagData.rawArea = totalRawArea;
        diagData.finalArea = totalFinalArea;
        diagData.kinkCount = totalKinkCount;
        diagData.strategy = finalStrategy;
        diagData.areaInflationRatio = totalRawArea > 0 ? totalFinalArea / totalRawArea : 1;
        diagData.points = rawPathPoints.length;
        diagData.status = finalPolygons.length === 0 ? 'Polygons Empty' : 'Success';

        const isGeometryInvalid = diagData.areaInflationRatio && diagData.areaInflationRatio > 1.35;
        
        if (isGeometryInvalid) {
            return {
                passed: false,
                isFatal: true,
                errorCode: ErrorCode.GEO_POLYGON_INVALID,
                cheatFlag: 'GEOMETRY_INVALID',
                riskScore: 90
            };
        }

        const polygonsForSettlement = deduplicateByContainment(finalPolygons);

        let accurateAreaKm2 = 0;
        if (polygonsForSettlement.length > 0) {
            const validPolys: Feature<Polygon>[] = [];
            polygonsForSettlement.forEach((polyPts) => {
                const coords = polyPts.map((p: any) => [p.lng, p.lat] as [number, number]);
                try {
                    if (coords.length >= 3) {
                        const ring = [...coords];
                        if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) {
                            ring.push([...ring[0]]);
                        }
                        const cleanRing = deduplicateRingPoints(ring);
                        if (cleanRing.length < 4) return;
                        
                        const rawPoly = turfPolygon([cleanRing]);
                        const unkinked = turfUnkinkPolygon(rawPoly);
                        unkinked.features.forEach((f: any) => {
                            const area = turfArea(f);
                            if (area <= MIN_TERRITORY_AREA_M2) return;
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
                } catch (e) {
                    console.warn('[GIS] accurateAreaKm2 unkink failed:', e);
                }
            });

            if (validPolys.length > 0) {
                try {
                    let merged = validPolys[0] as Feature<Polygon | MultiPolygon>;
                    for (let i = 1; i < validPolys.length; i++) {
                        let combined = turfUnion(turfFeatureCollection([merged, validPolys[i]]));
                        if (combined) {
                            try {
                                combined = turfSimplify(combined, { tolerance: 0.000003, highQuality: true });
                            } catch (simplifyErr) {
                                console.warn('[GIS] Failed to simplify combined polygon:', simplifyErr);
                            }
                            merged = combined as Feature<Polygon | MultiPolygon>;
                        }
                    }
                    accurateAreaKm2 = turfArea(merged) / 1000000;
                } catch (e) {
                    console.error('[GIS] Final union for area calculation failed:', e);
                }
            }
        }

        return { 
            passed: true, 
            isFatal: false, 
            riskScore: 0,
            computedData: {
                finalPolygons: polygonsForSettlement,
                accurateAreaKm2,
                diagData
            }
        };
    }
}
