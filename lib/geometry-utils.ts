/**
 * geometry-utils.ts
 * 
 * SINGLE SOURCE OF TRUTH for all geographic/geometric calculations.
 * Used by both phone (useRunningTracker) and smartwatch (ActivityService) paths.
 * 
 * Extracts logic previously duplicated in:
 * - hooks/useRunningTracker.ts (getDistanceFromLatLonInMeters, deg2rad)
 * - app/actions/sync.ts (getDistanceFromLatLonInKm, deg2rad)
 */

// ============================================================
// Types
// ============================================================

export interface GeoPoint {
    lat: number;
    lng: number;
    timestamp: number;
}

export interface LoopCheckResult {
    isClosed: boolean;
    /** Distance between start and end points in meters */
    gapDistance: number;
}

export interface DriftFilterResult {
    /** Cleaned points with drift removed */
    cleanedPoints: GeoPoint[];
    /** Number of points removed due to drift */
    removedCount: number;
    /** Warnings about removed points */
    warnings: string[];
}

// ============================================================
// Constants (shared thresholds for phone + watch consistency)
// ============================================================

/** Maximum distance (meters) between start/end to consider loop closed */
export const LOOP_CLOSURE_THRESHOLD_M = 20;

/** Minimum number of GPS points required for a valid loop */
export const MIN_LOOP_POINTS = 10;

/** Minimum polygon area (m²) to qualify for territory */
export const MIN_TERRITORY_AREA_M2 = 100;

/** Maximum plausible running speed (km/h) for drift filtering */
export const MAX_RUNNING_SPEED_KMH = 35;

/** Maximum plausible human heart rate (bpm) */
export const MAX_HEART_RATE_BPM = 250;

/** Minimum plausible human heart rate (bpm) */
export const MIN_HEART_RATE_BPM = 30;

/** Absolute speed limit for rejecting data (km/h) — beyond any human activity */
export const ABSOLUTE_SPEED_LIMIT_KMH = 100;

// ============================================================
// Core Math
// ============================================================

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Calculate the Haversine distance between two geographic points.
 * @returns Distance in meters
 */
export function haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371e3; // Earth radius in meters
    const dLat = deg2rad(lat2 - lat1);
    const dLng = deg2rad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Haversine distance in kilometers (convenience wrapper).
 */
export function haversineDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    return haversineDistance(lat1, lng1, lat2, lng2) / 1000;
}

// ============================================================
// Path Analysis
// ============================================================

/**
 * Calculate the total path distance from an array of GPS points.
 * @returns Total distance in meters
 */
export function calculatePathDistance(points: GeoPoint[]): number {
    if (points.length < 2) return 0;

    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += haversineDistance(
            points[i - 1].lat, points[i - 1].lng,
            points[i].lat, points[i].lng
        );
    }
    return total;
}

/**
 * Check whether a trajectory forms a closed loop.
 * Compares the distance between first and last points against threshold.
 */
export function isLoopClosed(
    points: GeoPoint[],
    thresholdMeters: number = LOOP_CLOSURE_THRESHOLD_M
): LoopCheckResult {
    if (points.length < MIN_LOOP_POINTS) {
        return { isClosed: false, gapDistance: Infinity };
    }

    const first = points[0];
    const last = points[points.length - 1];
    const gapDistance = haversineDistance(first.lat, first.lng, last.lat, last.lng);

    return {
        isClosed: gapDistance <= thresholdMeters,
        gapDistance,
    };
}

// ============================================================
// Data Cleaning
// ============================================================

/**
 * Filter GPS drift points based on speed between consecutive points.
 * Points that imply a speed exceeding `maxSpeedKmh` are considered drift and removed.
 */
export function filterDriftPoints(
    points: GeoPoint[],
    maxSpeedKmh: number = MAX_RUNNING_SPEED_KMH
): DriftFilterResult {
    if (points.length <= 1) {
        return { cleanedPoints: [...points], removedCount: 0, warnings: [] };
    }

    const cleanedPoints: GeoPoint[] = [points[0]];
    const warnings: string[] = [];
    let removedCount = 0;

    for (let i = 1; i < points.length; i++) {
        const prev = cleanedPoints[cleanedPoints.length - 1];
        const curr = points[i];

        const distMeters = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        const timeDiffSec = Math.abs(curr.timestamp - prev.timestamp) / 1000;

        if (timeDiffSec <= 0) {
            // Duplicate timestamp — skip
            removedCount++;
            continue;
        }

        const speedKmh = (distMeters / timeDiffSec) * 3.6;

        if (speedKmh > maxSpeedKmh) {
            removedCount++;
            warnings.push(
                `第${i}个点因瞬移被剔除（速度: ${speedKmh.toFixed(1)}km/h, 距离: ${distMeters.toFixed(0)}m）`
            );
            continue;
        }

        cleanedPoints.push(curr);
    }

    return { cleanedPoints, removedCount, warnings };
}

// ============================================================
// Validation
// ============================================================

export interface HumanLimitCheck {
    valid: boolean;
    reason?: string;
}

/**
 * Validate that physiological data is within human limits.
 */
export function validateHumanLimits(
    heartRate?: number,
    paceKmh?: number
): HumanLimitCheck {
    if (heartRate !== undefined && heartRate !== null) {
        if (heartRate < MIN_HEART_RATE_BPM || heartRate > MAX_HEART_RATE_BPM) {
            return {
                valid: false,
                reason: `心率 ${heartRate}bpm 超出人体极限范围 (${MIN_HEART_RATE_BPM}-${MAX_HEART_RATE_BPM}bpm)`,
            };
        }
    }

    if (paceKmh !== undefined && paceKmh !== null) {
        if (paceKmh > ABSOLUTE_SPEED_LIMIT_KMH) {
            return {
                valid: false,
                reason: `配速 ${paceKmh.toFixed(1)}km/h 超出人体极限 (>${ABSOLUTE_SPEED_LIMIT_KMH}km/h)`,
            };
        }
    }

    return { valid: true };
}

// ============================================================
// Legacy-compatible wrappers
// ============================================================

/**
 * Drop-in replacement for the function previously in useRunningTracker.ts
 */
export function getDistanceFromLatLonInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    return haversineDistance(lat1, lon1, lat2, lon2);
}

/**
 * Drop-in replacement for the function previously in sync.ts
 */
export function getDistanceFromLatLonInKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    return haversineDistanceKm(lat1, lon1, lat2, lon2);
}
