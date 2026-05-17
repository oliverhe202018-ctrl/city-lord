import * as turf from '@turf/turf';
import { getDistanceFromLatLonInMeters, extractValidLoops, LOOP_CLOSURE_THRESHOLD_M, haversineDistance } from '@/lib/geometry-utils';
import { MIN_TERRITORY_AREA_M2 } from '@/lib/constants/territory';
import { 
    ANTI_CHEAT_MAX_SPEED_KMH, 
    ANTI_CHEAT_MAX_GAP_SECONDS, 
    ANTI_CHEAT_MOCK_PERCENT_THRESHOLD, 
    ANTI_CHEAT_RISK_THRESHOLDS 
} from '@/lib/constants/anti-cheat';

export interface Point {
    lat: number;
    lng: number;
    timestamp: number;
    isMock?: boolean;
}

export interface AntiCheatValidationResult {
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    cheatFlags: string[];
    serverDistance: number;
    serverDuration: number;
    validPolygons: Point[][];
    totalArea: number;
}

/**
 * Completely ignores client payload calculations and rebuilds rules based on raw path points.
 */
export function validateRunAndRebuildTerritories(path: Point[]): AntiCheatValidationResult {
    let serverDistance = 0;
    let mockCount = 0;
    
    const cheatFlags: string[] = [];
    const validPolygons: Point[][] = [];
    let totalArea = 0;

    if (!path || path.length < 2) {
        return {
            riskScore: 0,
            riskLevel: 'LOW',
            cheatFlags,
            serverDistance: 0,
            serverDuration: 0,
            validPolygons: [],
            totalArea: 0
        };
    }

    const startTimestamp = path[0].timestamp;
    const endTimestamp = path[path.length - 1].timestamp;
    const serverDuration = Math.max(0, Math.floor((endTimestamp - startTimestamp) / 1000));

    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];

        if (curr.isMock) {
            mockCount++;
        }

        const dist = getDistanceFromLatLonInMeters(prev.lat, prev.lng, curr.lat, curr.lng);
        const timeDiff = Math.max(1, (curr.timestamp - prev.timestamp) / 1000); // prevent div by zero
        serverDistance += dist;

        const speedKmh = (dist / timeDiff) * 3.6;
        if (speedKmh > ANTI_CHEAT_MAX_SPEED_KMH && dist > 30) {
            // Speed limit exceeded for a significant segment
            if (!cheatFlags.includes('SPEED_LIMIT_EXCEEDED')) cheatFlags.push('SPEED_LIMIT_EXCEEDED');
        }

        if (timeDiff > ANTI_CHEAT_MAX_GAP_SECONDS && dist > 500) {
            if (!cheatFlags.includes('TELEPORTATION_OR_GAP')) cheatFlags.push('TELEPORTATION_OR_GAP');
        }
    }

    const extractedLoops = extractValidLoops(path, LOOP_CLOSURE_THRESHOLD_M) as Point[][];
    extractedLoops.forEach((loop, loopIndex) => {
        try {
            // 强制坐标去重：丢弃距离 < 1e-9 的共线重复点
            const dedupedCoords: Point[] = [];
            for (let i = 0; i < loop.length; i++) {
                if (i === 0) {
                    dedupedCoords.push(loop[i]);
                } else {
                    const prev = dedupedCoords[dedupedCoords.length - 1];
                    const curr = loop[i];
                    const dist = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
                    if (dist > 1e-9) {
                        dedupedCoords.push(curr);
                    }
                }
            }
            
            // 强制追加首点以确保 GeoJSON LinearRing 首尾坐标绝对相等
            if (dedupedCoords.length > 0) {
                const first = dedupedCoords[0];
                const last = dedupedCoords[dedupedCoords.length - 1];
                if (Math.abs(first.lat - last.lat) > 1e-9 || Math.abs(first.lng - last.lng) > 1e-9) {
                    dedupedCoords.push({ ...first, timestamp: first.timestamp });
                }
            }
            
            if (dedupedCoords.length < 4) {
                console.warn(`[territory-builder] Loop ${loopIndex} has insufficient points after deduplication: ${dedupedCoords.length}`);
                return;
            }
            
            const coords = dedupedCoords.map((point) => [point.lng, point.lat] as [number, number]);
            const poly = turf.polygon([coords]);
            const loopArea = turf.area(poly);
            if (loopArea >= MIN_TERRITORY_AREA_M2) {
                validPolygons.push(loop);
                totalArea += loopArea;
            }
        } catch (e) {
            console.error(`[territory-builder] Failed to process loop ${loopIndex}:`, e);
            throw e;
        }
    });

    // Risk Scoring
    let riskScore = 0;
    if (path.length > 0) {
         const mockPercent = (mockCount / path.length) * 100;
         if (mockPercent >= ANTI_CHEAT_MOCK_PERCENT_THRESHOLD) {
            riskScore += 50;
            cheatFlags.push('HIGH_MOCK_LOCATION_RATIO');
         } else if (mockPercent > 0) {
            riskScore += 20; // Some mock points found, but below fatal threshold
         }
    }

    if (cheatFlags.includes('SPEED_LIMIT_EXCEEDED')) riskScore += 30;
    if (cheatFlags.includes('TELEPORTATION_OR_GAP')) riskScore += 30;

    // Fast static check
    if (serverDistance > 1000 && totalArea === 0 && serverDuration > 300) {
        // Did they move 1km but not capture anything and it took 5 mins? Maybe a straight line, let's not auto flag just based on area.
        // Needs a tighter radius calculation, skip for MVP as it might false positive valid line runs.
    }

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (riskScore >= ANTI_CHEAT_RISK_THRESHOLDS.HIGH) riskLevel = 'HIGH';
    else if (riskScore >= ANTI_CHEAT_RISK_THRESHOLDS.MEDIUM) riskLevel = 'MEDIUM';

    return {
        riskScore: Math.min(riskScore, 100),
        riskLevel,
        cheatFlags,
        serverDistance,
        serverDuration,
        validPolygons,
        totalArea
    };
}
