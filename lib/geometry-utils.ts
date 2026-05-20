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
export const LOOP_CLOSURE_THRESHOLD_M = 30;

/** Snap distance for automatic loop closure */
export const LOOP_CLOSURE_SNAP_M = 30;

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
// Douglas-Peucker Path Simplification (with full metadata preservation)
// ============================================================

/**
 * 轻量级 Douglas-Peucker 算法实现，用于剔除 GPS 漂移产生的"微小毛刺折线"。
 *
 * ⚠️ 红线约束：简化后必须保留原始点的全部元数据（timestamp, accuracy, speed 等），
 * 仅从数组中移除几何上冗余的点，绝不修改保留点的任何属性。
 *
 * @param points 原始 GPS 点数组
 * @param toleranceMeters 简化容差（米），小于此值的偏移点将被剔除
 * @returns 简化后的点数组，保留完整元数据
 */
export function simplifyPathDP<T extends Coord>(
    points: T[],
    toleranceMeters: number = 3
): T[] {
    if (points.length <= 2) return [...points];

    // 递归 DP 算法：找到距离首尾连线最远的点
    function dpReduce(pts: T[], start: number, end: number, result: Set<number>): void {
        if (end - start <= 1) return;

        let maxDist = 0;
        let maxIndex = -1;

        const pStart = pts[start];
        const pEnd = pts[end];

        for (let i = start + 1; i < end; i++) {
            const dist = perpendicularDistance(pts[i], pStart, pEnd);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }

        if (maxDist > toleranceMeters) {
            result.add(maxIndex);
            // 递归处理两个子段
            dpReduce(pts, start, maxIndex, result);
            dpReduce(pts, maxIndex, end, result);
        }
    }

    // 首尾点永远保留
    const keptIndices = new Set<number>();
    keptIndices.add(0);
    keptIndices.add(points.length - 1);

    dpReduce(points, 0, points.length - 1, keptIndices);

    // 按原始顺序输出，保留完整元数据
    return points.filter((_, i) => keptIndices.has(i));
}

/**
 * 计算点到线段 p1-p2 的垂直距离（米）。
 */
function perpendicularDistance(point: Coord, p1: Coord, p2: Coord): number {
    const dx = p2.lng - p1.lng;
    const dy = p2.lat - p1.lat;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
        // 线段退化为点，返回点到点的距离
        return haversineDistance(point.lat, point.lng, p1.lat, p1.lng);
    }

    // 投影参数 t
    const t = ((point.lng - p1.lng) * dx + (point.lat - p1.lat) * dy) / lenSq;
    const clampedT = Math.max(0, Math.min(1, t));

    // 投影点坐标
    const projLat = p1.lat + clampedT * dy;
    const projLng = p1.lng + clampedT * dx;

    return haversineDistance(point.lat, point.lng, projLat, projLng);
}

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
 * 策略A (Snap)：当最新点距起点 <= 30m时自动闭合
 * 策略B (Intersect)：检测最新线段与历史轨迹的交叉，提取闭合环
 *
 * 重构要点：
 *  - 入口执行 DP 简化，保留完整元数据（含 timestamp）
 *  - P 型环使用精确交叉点 + 时间戳线性插值
 *  - 支持 8 字型等多环拓扑提取，无 break 截断
 *  - Set<string> 记录已提取线段区间，防污染
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

    // 入口 DP 简化：剔除微小毛刺，保留完整元数据（含 timestamp）
    const simplifiedPath = simplifyPathDP(path, 3);

    // 策略A: Snap闭合 - 检测首尾点距离是否在容差范围内
    const firstPoint = simplifiedPath[0];
    const lastPoint = simplifiedPath[simplifiedPath.length - 1];
    const snapDistance = haversineDistance(firstPoint.lat, firstPoint.lng, lastPoint.lat, lastPoint.lng);
    
    if (snapDistance <= snapThreshold) {
        const loop = [...simplifiedPath];
        if (loop[loop.length - 1].lat !== firstPoint.lat || loop[loop.length - 1].lng !== firstPoint.lng) {
            loop.push({ lat: firstPoint.lat, lng: firstPoint.lng, timestamp: firstPoint.timestamp });
        }
        
        if (isValidPolygon(loop)) {
            loops.push(loop);
        }
    }

    // 策略B: 自交闭合 — 扫描全部线段，提取所有有效闭合环
    if (simplifiedPath.length >= 6) {
        const n = simplifiedPath.length;
        // 记录已被提取为闭合环的线段索引
        const extractedSegments = new Set<number>();

        for (let i = 0; i < n - 3; i++) {
            // 跳过已被之前环覆盖的线段
            if (extractedSegments.has(i)) continue;

            for (let j = i + 2; j < n - 1; j++) {
                // 跳过已被之前环覆盖的线段
                if (extractedSegments.has(j)) continue;

                const intersectPoint = findLineSegmentIntersection(
                    simplifiedPath[i], simplifiedPath[i + 1],
                    simplifiedPath[j], simplifiedPath[j + 1]
                );

                if (intersectPoint) {
                    // 时间戳线性插值：根据交点在两条线段上的物理距离比例计算
                    const interpolatedTimestamp = interpolateTimestampAtIntersection(
                        simplifiedPath[i], simplifiedPath[i + 1],
                        simplifiedPath[j], simplifiedPath[j + 1],
                        intersectPoint
                    );

                    const intersectPointWithTimestamp: Coord = {
                        lat: intersectPoint.lat,
                        lng: intersectPoint.lng,
                        timestamp: interpolatedTimestamp
                    };

                    // 提取闭合环：从交点出发，沿路径走到 j+1，再回到交点
                    const ring: Coord[] = [
                        intersectPointWithTimestamp,
                        ...simplifiedPath.slice(i + 1, j + 2),
                        intersectPointWithTimestamp,
                    ];

                    if (isValidPolygon(ring)) {
                        const segKey = `${i}-${j + 1}`;
                        if (!seen.has(segKey)) {
                            seen.add(segKey);
                            // 标记该环覆盖的所有线段索引
                            for (let s = i; s <= j + 1; s++) {
                                extractedSegments.add(s);
                            }
                            loops.push(ring);
                        }
                    }
                    // 找到一个有效环后，跳出内层循环，继续外层扫描下一个未覆盖线段
                    break;
                }
            }
        }
    }

    return loops;
}

/**
 * 在两条线段的交点处进行时间戳线性插值。
 *
 * 根据交点到线段两端点的物理距离比例，对时间戳进行加权平均。
 * 取两条线段插值结果的平均值，确保时间戳尽可能准确。
 *
 * @returns 插值后的时间戳（毫秒），若无法插值则返回 undefined
 */
function interpolateTimestampAtIntersection(
    p1: Coord, p2: Coord,
    p3: Coord, p4: Coord,
    intersection: Coord
): number | undefined {
    const t1 = safeTimestamp(p1);
    const t2 = safeTimestamp(p2);
    const t3 = safeTimestamp(p3);
    const t4 = safeTimestamp(p4);

    const results: number[] = [];

    // 线段1的插值
    if (t1 !== null && t2 !== null) {
        const dist1 = haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        if (dist1 > 0) {
            const distToP1 = haversineDistance(p1.lat, p1.lng, intersection.lat, intersection.lng);
            const ratio = Math.max(0, Math.min(1, distToP1 / dist1));
            results.push(t1 + ratio * (t2 - t1));
        }
    }

    // 线段2的插值
    if (t3 !== null && t4 !== null) {
        const dist2 = haversineDistance(p3.lat, p3.lng, p4.lat, p4.lng);
        if (dist2 > 0) {
            const distToP3 = haversineDistance(p3.lat, p3.lng, intersection.lat, intersection.lng);
            const ratio = Math.max(0, Math.min(1, distToP3 / dist2));
            results.push(t3 + ratio * (t4 - t3));
        }
    }

    if (results.length === 0) return undefined;
    // 取所有可用插值的平均值
    return Math.round(results.reduce((a, b) => a + b, 0) / results.length);
}

/**
 * 安全获取时间戳，排除 NaN/undefined/Infinity。
 */
function safeTimestamp(point: Coord): number | null {
    if (typeof point.timestamp === 'number' && isFinite(point.timestamp!)) {
        return point.timestamp!;
    }
    return null;
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
