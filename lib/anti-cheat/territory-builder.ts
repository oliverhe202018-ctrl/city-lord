import * as turf from '@turf/turf';
import { getDistanceFromLatLonInMeters } from '@/lib/geometry-utils';
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

    const MIN_LOOP_SIZE = 10;
    const SNAP_THRESHOLD = 20;

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

        // Polygon Rebuilding (Mirrors useRunningTracker logic server-side)
        const currentPathLength = i; 
        if (currentPathLength >= MIN_LOOP_SIZE) {
            const startPoint = path[0];
            const distToStart = getDistanceFromLatLonInMeters(curr.lat, curr.lng, startPoint.lat, startPoint.lng);

            if (distToStart <= SNAP_THRESHOLD) {
                // Snap to start
                const snappedLoc = { lat: startPoint.lat, lng: startPoint.lng, timestamp: curr.timestamp, isMock: curr.isMock };
                
                // Reconstruct the loop
                const loopForCalc = path.slice(0, i).concat([snappedLoc]); 
                
                try {
                    const coords = loopForCalc.map(pt => [pt.lng, pt.lat]);
                    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                        coords.push(coords[0]);
                    }
                    const poly = turf.polygon([coords]);
                    const loopArea = turf.area(poly);

                    if (loopArea > 100) {
                        validPolygons.push(loopForCalc);
                        totalArea += loopArea;
                    }
                } catch (e) {
                    // Ignore invalid polygon
                }
            }
        }
    }

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
