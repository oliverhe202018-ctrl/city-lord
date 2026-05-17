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

import * as turf from '@turf/turf';

// ============================================================
// Types
// ============================================================

export interface GeoPoint {
    lat: number;
    lng: number;
    timestamp: number;
}

export interface Coord {
    lat: number;
    lng: number;
    timestamp?: number;
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

/** Snap distance for automatic loop closure */
export const LOOP_CLOSURE_SNAP_M = 20;

/** Minimum number of GPS points required for a valid loop.
 * Set to 4 (minimum for a valid polygon: 3 unique vertices + 1 closing point).
 * Allows small square trajectories to be captured without needing 10+ GPS points. */
export const MIN_LOOP_POINTS = 4;

/**
 * Minimum polygon area (m²) to qualify for territory.
 * Single source of truth is now: lib/constants/territory.ts -> MIN_TERRITORY_AREA_M2
 * @deprecated Use import { MIN_TERRITORY_AREA_M2 } from '@/lib/constants/territory' instead
 */
export const MIN_TERRITORY_AREA_M2 = 50;

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

/**
 * 双策略闭合算法：使用Turf.js实现智能领地闭合
 * 策略A (Snap)：当最新点距起点 <= 20m时自动闭合
 * 策略B (Intersect)：检测最新线段与历史轨迹的交叉，提取闭合环
 */
export function extractValidLoops(
    path: Coord[],
    snapThreshold: number = LOOP_CLOSURE_SNAP_M,
    intersectThreshold: number = LOOP_CLOSURE_THRESHOLD_M
): Coord[][] {
    if (!Array.isArray(path) || path.length < 4) {
        return [];
    }

    const loops: Coord[][] = [];
    const seen = new Set<string>();

    // 策略A: Snap闭合 - 检测首尾点距离是否在容差范围内
    const firstPoint = path[0];
    const lastPoint = path[path.length - 1];
    const snapDistance = haversineDistance(firstPoint.lat, firstPoint.lng, lastPoint.lat, lastPoint.lng);
    
    if (snapDistance <= snapThreshold) {
        // 创建闭合环：复制路径并确保首尾闭合
        const loop = [...path];
        if (loop[loop.length - 1].lat !== firstPoint.lat || loop[loop.length - 1].lng !== firstPoint.lng) {
            loop.push({ lat: firstPoint.lat, lng: firstPoint.lng });
        }
        
        // 验证多边形面积
        if (isValidPolygon(loop)) {
            loops.push(loop);
        }
    }

    // 策略B: 自交闭合 — 仅用最新线段与历史线段比对（O(n) 而非 O(n²)）
    // 服务端批量：以最后一段为"最新线段"，遍历历史线段
    if (path.length >= 6) {
        const n = path.length;
        // 最新线段（用最后两点代表"当前步进"）
        const lastSeg = { p1: path[n - 2], p2: path[n - 1] };

        for (let i = 0; i < n - 3; i++) {  // ← O(n)，不是 O(n²)
            const intersectPoint = findLineSegmentIntersection(
                lastSeg.p1, lastSeg.p2,
                path[i], path[i + 1]
            );

            if (intersectPoint) {
                // 修复：使用精确交叉点作为环的起点和闭合点
                // 继承原路径点的时间戳（取 path[i] 和 path[i+1] 的平均值）
                const avgTimestamp = (path[i].timestamp ?? 0) + (path[i + 1].timestamp ?? 0);
                const intersectPointWithTimestamp: Coord = {
                    lat: intersectPoint.lat,
                    lng: intersectPoint.lng,
                    timestamp: avgTimestamp > 0 ? avgTimestamp / 2 : undefined
                };
                
                // 提取交叉点之后到末尾的环
                const ring: Coord[] = [
                    intersectPointWithTimestamp, // 交叉点作为起点
                    ...path.slice(i + 1, n),     // 包含 path[i+1] 到末尾
                    intersectPointWithTimestamp, // 闭合到交叉点
                ];
                if (isValidPolygon(ring)) {
                    const key = `${i+1}-${n-1}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        loops.push(ring);
                    }
                }
                break; // 找到第一个有效自交即停，避免重复
            }
        }
    }

    return loops;
}

/**
 * 检测两条线段是否相交，返回交点坐标
 */
function findLineSegmentIntersection(
    p1: Coord, p2: Coord, p3: Coord, p4: Coord
): Coord | null {
    // 转换为Turf.js线段
    const line1 = turf.lineString([[p1.lng, p1.lat], [p2.lng, p2.lat]]);
    const line2 = turf.lineString([[p3.lng, p3.lat], [p4.lng, p4.lat]]);
    
    // 检测线段交叉
    const intersection = turf.lineIntersect(line1, line2);
    
    if (intersection.features.length > 0) {
        const point = intersection.features[0].geometry.coordinates;
        return { lat: point[1], lng: point[0] };
    }
    
    return null;
}

/**
 * 验证多边形是否有效（面积 >= MIN_TERRITORY_AREA_M2）
 */
function isValidPolygon(points: Coord[]): boolean {
    if (points.length < 4) return false; // GeoJSON规范要求首尾闭合
    
    // 转换为Turf.js多边形
    const coordinates = points.map(p => [p.lng, p.lat]);
    // 确保闭合
    if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
        coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
        coordinates.push([coordinates[0][0], coordinates[0][1]]);
    }
    
    try {
        const polygon = turf.polygon([coordinates]);
        const area = turf.area(polygon);
        return area >= MIN_TERRITORY_AREA_M2;
    } catch (error) {
        // 无效的几何形状
        return false;
    }
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
