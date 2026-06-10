'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath, revalidateTag, unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';
import { tasks } from "@trigger.dev/sdk/v3";
import { RunRecordDTO, ActionResponse, RunEventLog } from '@/types/run-sync';
import { validateRunAndRebuildTerritories, AntiCheatValidationResult } from '@/lib/anti-cheat/territory-builder';
import { updateMissionProgress } from '@/lib/game-logic/mission-service';
import { checkRunRateLimit } from '@/lib/anti-cheat/rate-limiter';
import { processTerritorySettlement } from '@/lib/territory/settlement';
import { MIN_TERRITORY_AREA_M2 } from '@/lib/constants/territory';
import { AppError } from '@/lib/api/errors';
import {
    AntiCheatPipeline,
    MockLocationValidator,
    TeleportValidator,
    PedometerValidator,
    PolygonLegitimacyValidator,
    AntiCheatContext
} from '@/lib/anti-cheat/pipeline';
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
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { cleanAndSplitTrajectory } from '@/lib/gis/geometry-cleaner';
import { isLoopClosed, LOOP_CLOSURE_THRESHOLD_M, extractValidLoops, type Coord, simplifyPathDP } from '@/lib/geometry-utils';
import { isTester } from '@/lib/constants/anti-cheat';
import { reverseGeocodeCity } from '@/lib/map/server-geocode';
import { v4 as uuidv4 } from 'uuid';

// ─── 动态城市识别：基于轨迹首点坐标匹配最近城市 ───
async function resolveRunCityId(runData: any): Promise<string | null> {
  const pathPoints = runData.path;
  if (!pathPoints || pathPoints.length === 0) return null;
  const resolved = await resolveCityFromPath(pathPoints);
  return resolved;
}

async function resolveCityFromPath(
    sampledPoints: { lng: number; lat: number }[]
): Promise<string | null> {
    if (!sampledPoints || sampledPoints.length === 0) return null;
    const validPoints = sampledPoints.filter((point) =>
        Number.isFinite(point.lng) && Number.isFinite(point.lat)
    );
    if (validPoints.length === 0) return null;

    // P0 修复：废弃质心算法，使用起点作为第一代表点，防止坐标落入海域/无名区
    // 回退策略：起点 -> 终点 -> 1/4 处点
    const candidateIndices = [
        0,                                      // 起点（第一优先）
        validPoints.length - 1,                 // 终点（第二优先）
        Math.floor(validPoints.length / 4)      // 1/4 处点（第三优先）
    ];

    for (const idx of candidateIndices) {
        if (idx < 0 || idx >= validPoints.length) continue;
        const { lng, lat } = validPoints[idx];
        try {
            const { cityName, adcode } = await reverseGeocodeCity(lat, lng);
            if (cityName || adcode) {
                console.log(`[resolveCityFromPath] 使用第 ${idx} 个点解析成功: cityName=${cityName ?? 'null'}, adcode=${adcode ?? 'null'}`);
                return await resolveCityFromGeocode(cityName, adcode, lng, lat);
            }
        } catch (err) {
            console.warn(`[resolveCityFromPath] 第 ${idx} 个点逆地理编码失败`, err);
        }
    }

    console.warn('[resolveCityFromPath] 所有候选点均解析失败');
    return null;
}

async function resolveCityFromGeocode(
    cityName: string | null,
    adcode: string | null,
    lng: number,
    lat: number
): Promise<string | null> {
    if (!cityName && !adcode) {
        console.warn('[resolveCityFromGeocode] 高德逆地理编码失败: cityName/adcode 均为空');
        return null;
    }

    // P0 修复：城市名归一化，防止"北京市"和"北京"分裂为两条记录
    const normalizedCityName = cityName
        ? cityName.replace(/市$/, '').replace(/省$/, '').trim()
        : null;

    let adcodeMatches: string[] = [];
    if (typeof adcode === 'string') {
        if (adcode.length === 6) {
            const cityAdcode = `${adcode.slice(0, 4)}00`;
            adcodeMatches.push(cityAdcode);

            const directControlledPrefixes = ["11", "12", "31", "50"];
            if (directControlledPrefixes.includes(adcode.slice(0, 2))) {
                const provincialAdcode = `${adcode.slice(0, 2)}0000`;
                if (provincialAdcode !== cityAdcode) {
                    adcodeMatches.push(provincialAdcode);
                }
            }
        } else if (adcode.length === 4) {
            adcodeMatches.push(`${adcode}00`);
        } else if (adcode.length === 2) {
            adcodeMatches.push(`${adcode}0000`);
        } else {
            adcodeMatches.push(adcode);
        }
    }

    console.log(`[resolveCityFromGeocode] 逆地理编码结果: cityName=${normalizedCityName ?? 'null'}, adcode=${adcode ?? 'null'}, normalizedAdcodes=[${adcodeMatches.join(',')}]`);

    type CityIdRow = { id: string };
    const existingCityRows = await prisma.$queryRaw<CityIdRow[]>`
        SELECT id
        FROM public.cities
        WHERE adcode = ANY(${adcodeMatches}::text[])
           OR (${normalizedCityName} IS NOT NULL AND name = ${normalizedCityName})
        LIMIT 1
    `;
    if (existingCityRows.length > 0) {
        console.log(`[resolveCityFromGeocode] 命中已有城市: id=${existingCityRows[0].id}`);
        return existingCityRows[0].id;
    }
    if (!normalizedCityName) {
        console.warn('[resolveCityFromGeocode] 未命中城市且 cityName 为空，跳过城市创建');
        return null;
    }
    const adcodeToInsert = adcodeMatches.length > 0 ? adcodeMatches[0] : (typeof adcode === 'string' ? adcode : null);

    // P0 修复：ON CONFLICT 使用归一化后的城市名，确保"北京市"和"北京"映射为同一记录
    const newCityRows = await prisma.$queryRaw<CityIdRow[]>`
        INSERT INTO public.cities (name, pinyin, adcode, center_lng, center_lat, created_at, updated_at)
        VALUES (${normalizedCityName}, ${normalizedCityName}, ${adcodeToInsert}, ${lng}, ${lat}, ${new Date()}, ${new Date()})
        ON CONFLICT (name) DO UPDATE SET
            pinyin = EXCLUDED.pinyin,
            adcode = EXCLUDED.adcode,
            center_lng = EXCLUDED.center_lng,
            center_lat = EXCLUDED.center_lat,
            updated_at = EXCLUDED.updated_at
        RETURNING id
    `;
    if (newCityRows.length === 0) {
        console.error('[resolveCityFromGeocode] 城市创建后未返回 id');
        return null;
    }
    console.log(`[resolveCityFromGeocode] 动态创建新城市: id=${newCityRows[0].id}, name=${normalizedCityName}`);
    return newCityRows[0].id;
}

// ============================================================
// 防线 2：经纬度最近邻空间查询（纯离线/DB 计算）
// 使用 Haversine 公式在 cities 表中查找距离给定坐标最近的城市
// 容忍半径：50km（覆盖近海、跨市边界等边缘场景）
// ============================================================
const NEAREST_CITY_RADIUS_KM = 50;

async function resolveCityByNearestSpatial(
    lat: number,
    lng: number
): Promise<string | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.warn('[resolveCityByNearestSpatial] 坐标无效，跳过空间查询');
        return null;
    }

    try {
        type NearestCityRow = { id: string; name: string; distance_km: string };
        const rows = await prisma.$queryRaw<NearestCityRow[]>`
            SELECT 
                id, 
                name,
                (6371.0 * ACOS(
                    LEAST(1.0, 
                        COS(RADIANS(${lat})) * COS(RADIANS(center_lat)) * COS(RADIANS(center_lng) - RADIANS(${lng})) 
                        + SIN(RADIANS(${lat})) * SIN(RADIANS(center_lat))
                    )
                )) AS distance_km
            FROM public.cities
            WHERE center_lat IS NOT NULL AND center_lng IS NOT NULL
            ORDER BY distance_km ASC
            LIMIT 1
        `;

        if (rows.length === 0) {
            console.warn('[resolveCityByNearestSpatial] cities 表为空，无可用城市');
            return null;
        }

        const nearest = rows[0];
        const distanceKm = parseFloat(nearest.distance_km);

        if (distanceKm > NEAREST_CITY_RADIUS_KM) {
            console.log(`[resolveCityByNearestSpatial] 最近城市 "${nearest.name}" 距离 ${distanceKm.toFixed(1)}km > ${NEAREST_CITY_RADIUS_KM}km 容忍半径，跳过`);
            return null;
        }

        console.log(`[resolveCityByNearestSpatial] 命中最近邻城市: id=${nearest.id}, name=${nearest.name}, distance=${distanceKm.toFixed(1)}km`);
        return nearest.id;
    } catch (err) {
        console.error('[resolveCityByNearestSpatial] 空间查询失败:', err);
        return null;
    }
}

// ============================================================
// 防线 3：运营商/边缘节点网络 IP 溯源（网络层兜底）
// 从 Vercel/Cloudflare 边缘节点注入的请求头中提取城市信息
// 提取到英文名后，回传给高德 API 尝试换取中文名
// ============================================================
async function resolveCityFromNetwork(
    fallbackLng?: number,
    fallbackLat?: number
): Promise<string | null> {
    try {
        const headersList = await headers();
        let networkCityName: string | null = null;

        // 优先级：Vercel 边缘节点 > Cloudflare > 其他 CDN
        const vercelCity = headersList.get('x-vercel-ip-city');
        const cfCity = headersList.get('cf-ipcity');
        const vercelRegion = headersList.get('x-vercel-ip-country-region');

        networkCityName = vercelCity || cfCity || vercelRegion || null;

        if (!networkCityName) {
            console.log('[resolveCityFromNetwork] 未检测到网络层地理头信息');
            return null;
        }

        console.log(`[resolveCityFromNetwork] 网络层城市: ${networkCityName}`);

        // 批示 2：将英文名回传给高德 API 尝试换取中文名
        // 使用网络 IP 提供的坐标（如果有）或传入的 fallback 坐标进行逆地理编码
        if (fallbackLng !== undefined && fallbackLat !== undefined) {
            try {
                const { cityName, adcode } = await reverseGeocodeCity(fallbackLat, fallbackLng);
                if (cityName || adcode) {
                    console.log(`[resolveCityFromNetwork] 高德回译成功: cityName=${cityName ?? 'null'}, adcode=${adcode ?? 'null'}`);
                    return await resolveCityFromGeocode(cityName, adcode, fallbackLng, fallbackLat);
                }
            } catch (amapErr) {
                console.warn('[resolveCityFromNetwork] 高德回译失败，使用网络层城市名:', amapErr);
            }
        }

        // 高德回译也失败，直接用网络层城市名走动态开城逻辑
        return await resolveCityFromGeocode(networkCityName, null, fallbackLng ?? 0, fallbackLat ?? 0);
    } catch (err) {
        console.error('[resolveCityFromNetwork] 网络溯源失败:', err);
        return null;
    }
}

// ============================================================
// 终极兜底：硬编码 "地心" 城市 ID
// 仅在前三道防线全部被击穿时触发（理论上几乎不可能）
// 防止代码层面的 null 崩溃
// ============================================================
const EARTH_CORE_CITY_ID = 'EARTH_CORE_000';

async function ensureCityIdExists(
    resolvedCityId: string | null,
    pathPoints: { lng: number; lat: number }[]
): Promise<string> {
    if (resolvedCityId && resolvedCityId !== 'default_city' && resolvedCityId !== 'unknown') {
        return resolvedCityId;
    }

    console.warn('[ensureCityIdExists] 防线 1 失败，启动防线 2（最近邻空间查询）...');
    const firstPoint = pathPoints.length > 0 ? pathPoints[0] : null;
    
    if (firstPoint && Number.isFinite(firstPoint.lat) && Number.isFinite(firstPoint.lng)) {
        const spatialCityId = await resolveCityByNearestSpatial(firstPoint.lat, firstPoint.lng);
        if (spatialCityId) {
            return spatialCityId;
        }
    }

    console.warn('[ensureCityIdExists] 防线 2 失败，启动防线 3（网络 IP 溯源）...');
    const networkCityId = await resolveCityFromNetwork(
        firstPoint?.lng,
        firstPoint?.lat
    );
    if (networkCityId) {
        return networkCityId;
    }

    console.error(`[ensureCityIdExists] 三重防线全部失败！使用终极兜底城市 ID: ${EARTH_CORE_CITY_ID}`);
    return EARTH_CORE_CITY_ID;
}

// 用 Ramer-Douglas-Peucker 保留关键几何节点，不破坏环路

function haversineDistance(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  const R = 6371000; // 地球半径，单位：米
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointToSegmentDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): { dist: number; t: number } {
  // In small WGS84 neighborhoods, planar projection here is accurate enough.
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: haversineDistance(p, a), t: 0 };
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  const proj: [number, number] = [a[0] + t * dx, a[1] + t * dy];
  return { dist: haversineDistance(p, proj), t };
}

/**
 * 使用 CCW 向量叉乘算法判断两条线段是否相交
 * 增加共线重叠（Collinear Overlap）处理：当叉乘结果为 0 时，
 * 使用 onSegment 检查端点是否落在另一线段上
 */
function segmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  const ccw = (
    a: [number, number],
    b: [number, number],
    c: [number, number]
  ): number => {
    return (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0]);
  };

  const onSegment = (
    a: [number, number],
    b: [number, number],
    c: [number, number]
  ): boolean => {
    return (
      Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) &&
      Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1])
    );
  };

  const d1 = ccw(p3, p4, p1);
  const d2 = ccw(p3, p4, p2);
  const d3 = ccw(p1, p2, p3);
  const d4 = ccw(p1, p2, p4);

  // 标准相交判断：严格交叉
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // 共线重叠处理：叉乘为 0 时检查端点是否落在另一线段上
  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;

  return false;
}

function rdpSamplePath(points: any[], maxPoints: number): any[] {
    if (points.length <= maxPoints) return points;
    
    // 计算轨迹总长度用于自适应容差
    const line = turfLineString(points.map((p: any) => [p.lng, p.lat]));
    const totalLengthKm = turfLength(line, { units: 'kilometers' });
    
    // 根据路径长度动态设定 tolerance
    let tolerance = 0.00001; // ~1m at equator (默认高精度)
    if (totalLengthKm > 10) {
        tolerance = 0.0001;  // ~10m for long paths (>10km)
    } else if (totalLengthKm > 5) {
        tolerance = 0.00005; // ~5m for medium paths (5-10km)
    } else if (totalLengthKm > 2) {
        tolerance = 0.00002; // ~2m for short paths (2-5km)
    }
    
    // 使用 highQuality: true 保留领地转角
    const simplified = turfSimplify(line, { tolerance, highQuality: true });
    let result = simplified.geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng }));
    
    // 如果仍然超过 maxPoints，逐步增加 tolerance
    // 增加几何变化率监控：防止单次降低 tolerance 导致保留点数锐减超过 30%
    while (result.length > maxPoints && tolerance < 0.01) {
        const prevCount = result.length;
        tolerance *= 1.5;
        const resimplified = turfSimplify(line, { tolerance, highQuality: true });
        result = resimplified.geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng }));
        
        // 若单次降低 tolerance 导致保留点数锐减超过 30%，直接 break
        // 防止密集转角的拓扑被过度抹平
        if (result.length < prevCount * 0.70) {
            console.log(`[rdpSamplePath] 几何变化率监控触发：${prevCount} → ${result.length} 点（降幅 ${(1 - result.length / prevCount) * 100}%)，停止进一步降采样`);
            break;
        }
    }
    
    // 确保不超过 500 点
    if (result.length > maxPoints) {
        const step = Math.ceil(result.length / maxPoints);
        result = result.filter((_, idx) => idx % step === 0 || idx === result.length - 1);
    }
    
    return result;
}

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
    // Safety check
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

    // Attempt unkink
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

    // Fallback to convex hull
    try {
        const points = turfFeatureCollection(ring.map(p => turfPoint(p)));
        const hull = turfConvex(points);
        if (hull && hull.geometry?.coordinates?.[0]) {
            const hullRing = hull.geometry.coordinates[0];
            const finalArea = turfArea(hull);
            const areaInflationRatio = rawArea > 0 ? (finalArea / rawArea) : 1;

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

export interface SaveRunResult {
    runId?: string;
    runNumber?: number;
    totalReward?: { coins: number; xp: number };
    damageSummary?: any[];
    maintenanceSummary?: any[];
    settledTerritoriesCount?: number;
    isValid?: boolean;
    antiCheatLog?: string | null;
    totalSteps?: number;
    settlingAsync?: boolean;
    isDuplicate?: boolean;
    territories?: { id: string }[];
}

const isRunEventLog = (event: unknown): event is RunEventLog => {
    if (!event || typeof event !== 'object') return false;
    const value = event as Partial<RunEventLog>;
    return Boolean(
        typeof value.eventId === 'string' &&
        (value.eventType === 'CHASE' || value.eventType === 'ENERGY_SURGE') &&
        (value.status === 'SUCCESS' || value.status === 'FAILED') &&
        typeof value.triggeredAt === 'number' &&
        typeof value.resolvedAt === 'number'
    );
};

const getDefaultEventReward = (eventType: RunEventLog['eventType']) => {
    if (eventType === 'CHASE') return { xp: 50, stamina: 0 };
    return { xp: 30, stamina: 5 };
};

const PEDOMETER_STRICT_DISTANCE_METERS = 500;
const PEDOMETER_MIN_STEPS = 100;
const PEDOMETER_MAX_STRIDE_METERS = 1.5;


/**
 * Saves a run and evaluates/grants task rewards atomically.
 * Idempotency is verified via Validated UserTaskLog checks.
 */
export async function saveRunActivity(
    userId: string,
    runData: RunRecordDTO,
    clubId?: string | null
): Promise<ActionResponse<SaveRunResult>> {
    console.log(`[Territory-Diag-Init] saveRunActivity 被调用，当前时间戳: ${Date.now()}`);
    try {
        if (!userId) throw new Error('User ID is required');

        // ─── P4 服务端 800 点抽稀防爆 (Downsampling) ───
        const MAX_SERVER_RAW_POINTS = 800;
        let pathPoints = (runData.path as any[]) || [];
        if (pathPoints.length > MAX_SERVER_RAW_POINTS) {
            const totalPoints = pathPoints.length;
            const dpSimplified = simplifyPathDP(pathPoints, 2.0);
            let guarded = dpSimplified;
            if (dpSimplified.length > MAX_SERVER_RAW_POINTS) {
                guarded = dpSimplified.slice(0, MAX_SERVER_RAW_POINTS);
                // 强行补回原始轨迹的终点，防全局起终点自动闭合特征丢失
                guarded[guarded.length - 1] = pathPoints[pathPoints.length - 1];
            }
            runData.path = guarded;
            console.log(`[P4 Downsampling] Simplified and guarded path points from ${totalPoints} to ${runData.path.length}.`);
        }

        // ─── P0 时钟防穿越校正（整体时间轴平移策略） ───
        const serverNow = Date.now();
        const CLOCK_DRIFT_TOLERANCE_MS = 10_000; // 10秒容忍
        const rawPathForClockCheck = (runData.path as any[]) || [];

        // 1. 计算轨迹中最大的未来超前量
        const maxFutureDrift = Math.max(
            0,
            ...rawPathForClockCheck
                .filter((p: any) => p.timestamp)
                .map((p: any) => p.timestamp - serverNow)
        );

        // 2. 如果超前量大于容忍度，则对整个时间轴进行平移
        if (maxFutureDrift > CLOCK_DRIFT_TOLERANCE_MS) {
            console.warn(`[Clock-Defense] 客户端时间超前服务端 ${maxFutureDrift}ms，执行整体时间轴平移`);
            if (runData.timestamp) {
                runData.timestamp -= maxFutureDrift;
            }
            for (const point of rawPathForClockCheck) {
                if (point.timestamp) {
                    point.timestamp -= maxFutureDrift;
                }
            }
        }

        // ─── Phase 3C: 跑前体力拦截 ───
        const preRunProfile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { stamina: true, max_stamina: true }
        });
        const currentStamina = preRunProfile?.stamina ?? 0;
        if (currentStamina < 10) {
            throw new Error('体力不足，请休息后再试');
        }

        const eventsHistory = Array.isArray(runData.eventsHistory)
            ? runData.eventsHistory.filter(isRunEventLog)
            : [];
        const submittedTotalSteps = Math.max(0, Math.floor(Number(runData.totalSteps ?? runData.steps ?? 0)));
        let runnerClubId = clubId ?? runData.clubId ?? null;
        if (!runnerClubId && userId) {
            try {
                const profile = await prisma.profiles.findUnique({
                    where: { id: userId },
                    select: { club_id: true }
                });
                runnerClubId = profile?.club_id ?? null;
                
                if (!runnerClubId) {
                    const activeMembership = await prisma.club_members.findFirst({
                        where: { user_id: userId, status: 'active' },
                        orderBy: { joined_at: 'desc' },
                        select: { club_id: true }
                    });
                    if (activeMembership?.club_id) {
                        runnerClubId = activeMembership.club_id;
                        await prisma.profiles.update({
                            where: { id: userId },
                            data: { club_id: runnerClubId }
                        });
                        console.log(`[runnerClubId] Recovered club_id from club_members for user ${userId}`);
                    }
                }
            } catch (e) {
                console.warn('[runnerClubId] Failed to fetch from DB:', e);
            }
        }

        // Global City ID extraction — 三重真实地理防线
        const originalCityId = (runData as any).cityId as string | null | undefined;
        const resolvedCityId: string | null = originalCityId ?? await resolveRunCityId(runData);
        const resolveSource = originalCityId ? 'payload' : 'spatial';
        
        // 三重防线缝合：高德 → 最近邻空间查询 → 网络 IP 溯源 → 终极兜底
        const safeCityId = await ensureCityIdExists(
            resolvedCityId,
            (runData.path as any[]) || []
        );
        console.log(`[saveRunActivity] 最终 cityId=${safeCityId} (来源: ${resolveSource})`);

        // Rate Limiting
        const rateLimitResult = await checkRunRateLimit(userId);
        if (!rateLimitResult.allowed) {
            console.warn(`[saveRunActivity] Rate limit exceeded for user: ${userId}`);
            return {
                success: false,
                error: `Too many submissions. Please try again in ${rateLimitResult.retryAfter} seconds.`
            };
        }

        // 0. Strong Idempotency Check
        if (runData.idempotencyKey) {
            const existingRun = await prisma.runs.findUnique({
                where: { idempotency_key: runData.idempotencyKey }
            });
            if (existingRun) {
                console.log(`[saveRunActivity] Idempotent replay blocked for key: ${runData.idempotencyKey}`);
                return {
                    success: true,
                    message: "Run already processed securely.",
                    data: {
                        runId: existingRun.id,
                        isDuplicate: true,
                        runNumber: 0,
                        totalReward: { coins: 0, xp: 0 },
                        settlingAsync: false
                    }
                };
            }
        }
        
        // --- GIS-01: 強制降維採樣 (Path Simplification) ---
        // 應對 15000+ GPS 點導致的性能崩潰。在處理業務邏輯前，先行極速壓縮。
        const rawPathPointsForGIS = (runData.path as any[]) || [];
        if (rawPathPointsForGIS.length > 500) {
            const line = turfLineString(rawPathPointsForGIS.map((p: any) => [p.lng, p.lat]));
            // 0.0001 容差約為 10 米，能過濾大量抖動並極速壓縮點雲
            const simplified = turfSimplify(line, { tolerance: 0.0001, highQuality: false });
            
            // 保持 Location[] 類型兼容性，簡單帶上時間戳
            const startTime = rawPathPointsForGIS[0]?.timestamp || Date.now();
            const endTime = rawPathPointsForGIS[rawPathPointsForGIS.length - 1]?.timestamp || Date.now();
            const count = simplified.geometry.coordinates.length;
            
            runData.path = simplified.geometry.coordinates.map(([lng, lat]: any, idx: number) => ({ 
                lat, 
                lng,
                // 基於點順序大致模擬時間分佈
                timestamp: Math.floor(startTime + (endTime - startTime) * (idx / Math.max(1, count - 1)))
            }));
            console.log(`[GIS] Path simplified from ${rawPathPointsForGIS.length} to ${runData.path.length} points.`);
        }

        // --- P2 Anti-Cheat Pipeline & Territory Builder ---
        const isUserTester = await isTester(userId);
        
        const pipeline = new AntiCheatPipeline([
            new MockLocationValidator(),
            new TeleportValidator(),
            new PedometerValidator(),
            new PolygonLegitimacyValidator()
        ]);

        const pipelineContext: AntiCheatContext = {
            userId,
            runData: runData as any,
            isTester: isUserTester,
            pathPoints: runData.path as any[]
        };

        const pipelineResult = await pipeline.execute(pipelineContext);

        const isBlockedByAntiCheat = !pipelineResult.passed;
        const flagReason = pipelineResult.cheatFlags.length > 0 ? pipelineResult.cheatFlags[0] : undefined;

        let finalPolygons = pipelineContext.finalPolygons || [];
        let accurateAreaKm2 = pipelineContext.accurateAreaKm2 || 0;
        let diagData = pipelineContext.diagData || { status: 'Empty' };

        let finalRunStatus = isBlockedByAntiCheat ? 'flagged' : 'settling';
        let customFlagReason = flagReason;

        const isGeometryInvalid = diagData.areaInflationRatio && diagData.areaInflationRatio > 1.35;
        if (isGeometryInvalid) {
            finalRunStatus = 'flagged';
            customFlagReason = 'GEOMETRY_INVALID';
            finalPolygons = [];
        } else if (!safeCityId) {
            customFlagReason = undefined;
            if (finalPolygons.length === 0) {
                finalRunStatus = 'completed';
                console.log('[Territory-Diag] safeCityId=null 且无多边形，run 直接完成');
            } else {
                finalRunStatus = 'settling';
                console.log('[Territory-Diag] safeCityId=null 但有多边形，保持 settling 等待异步结算回写');
            }
        }

        const polygonsForSettlement = (isBlockedByAntiCheat || isGeometryInvalid) ? [] : finalPolygons;

        // 5. Transaction: Save Run + Process Rewards + Audit Logs
        const result = await prisma.$transaction(async (tx: any) => {
            const runnerProfile = await tx.profiles.findUnique({
                where: { id: userId },
                select: { faction: true }
            });
            const runnerFaction = runnerProfile?.faction ?? null;

            // A. Create Run Record (Always saved, even if flagged)
            const runEventsWithDiag = [
                ...eventsHistory,
                {
                    eventId: `diag_${Date.now()}`,
                    eventType: 'DIAGNOSTIC' as any,
                    status: 'SUCCESS',
                    triggeredAt: Date.now(),
                    resolvedAt: Date.now(),
                    data: {
                        originalCityId,
                        resolvedCityId,
                        safeCityId,
                        resolveSource,
                        geometryFixStrategy: diagData.strategy,
                        kinkCount: diagData.kinkCount,
                        rawArea: diagData.rawArea,
                        finalArea: diagData.finalArea,
                        areaInflationRatio: diagData.areaInflationRatio
                    }
                }
            ];

            const run = await tx.runs.create({
                data: {
                    user_id: userId,
                    club_id: runnerClubId,
                    distance: (pipelineContext.serverDistanceKm || 0) * 1000,
                    duration: pipelineContext.serverDurationSec || runData.duration,
                    area: accurateAreaKm2 * 1_000_000, // m² 精确面积
                    path: runData.path as any,
                    polygons: finalPolygons as any,
                    status: finalRunStatus,
                    created_at: new Date(runData.timestamp || Date.now()),
                    updated_at: new Date(),
                    idempotency_key: runData.idempotencyKey,
                    // Anti-Cheat Fields
                    risk_score: isUserTester ? 0 : pipelineResult.totalRisk,
                    risk_level: isUserTester ? 'LOW' : (pipelineResult.totalRisk >= 100 ? 'HIGH' : (pipelineResult.totalRisk > 0 ? 'MEDIUM' : 'LOW')),
                    cheat_flags: {
                        flags: pipelineResult.cheatFlags,
                        tester_bypass: isUserTester
                    } as any,
                    client_distance: runData.distance,
                    // New Validator Fields
                    is_flagged: isUserTester ? false : (isBlockedByAntiCheat || isGeometryInvalid),
                    flag_reason: isUserTester ? null : customFlagReason,
                    eventsLog: runEventsWithDiag as any,
                    totalSteps: submittedTotalSteps,
                    isValid: isUserTester ? true : (!isBlockedByAntiCheat && !isGeometryInvalid),
                    antiCheatLog: isUserTester ? null : flagReason,
                },
            });

            // B. Write new territory records directly if they exist
            if (polygonsForSettlement.length > 0 && !isBlockedByAntiCheat && !isGeometryInvalid) {
                const territoryRecords = polygonsForSettlement.map((polyPts: any) => {
                    const coords = polyPts.map((p: any) => [p.lng, p.lat]);
                    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                        coords.push([...coords[0]]);
                    }
                    const geojsonJson = {
                        type: 'Polygon',
                        coordinates: [coords]
                    };
                    let areaM2 = 0;
                    try {
                        const poly = turfPolygon([coords]);
                        areaM2 = turfArea(poly);
                    } catch (e) {
                        console.warn('[saveRunActivity] Failed to compute turf area for direct write:', e);
                    }

                    const newId = `terr_${uuidv4().replace(/-/g, '').substring(0, 24)}`;
                    return {
                        id: newId,
                        city_id: safeCityId || 'unknown_city',
                        owner_id: userId,
                        owner_club_id: runnerClubId,
                        owner_faction: runnerFaction,
                        geojson_json: geojsonJson as any,
                        source_run_id: run.id,
                        first_claimed_at: new Date(),
                        last_claimed_at: new Date(),
                        captured_at: new Date(),
                        last_maintained_at: new Date(),
                        max_hp: 1000,
                        current_hp: 1000,
                        health: 100,
                        territory_type: 'NORMAL' as any,
                        score_weight: 1.0,
                        status: 'ACTIVE' as any,
                        area_m2_exact: areaM2,
                    };
                });

                if (territoryRecords.length > 0) {
                    await tx.territories.createMany({
                        data: territoryRecords,
                        skipDuplicates: true,
                    });

                    // Update the PostGIS geojson geometry column from geojson_json for the newly created territories
                    await tx.$executeRaw`
                        UPDATE territories 
                        SET geojson = ST_SetSRID(ST_GeomFromGeoJSON(geojson_json::text), 4326) 
                        WHERE source_run_id = CAST(${run.id} AS UUID) AND geojson IS NULL;
                    `;

                    // Generate CREATED events for each territory
                    const territoryEvents = territoryRecords.map((t) => ({
                        territory_id: t.id,
                        event_type_old: 'CREATED',
                        user_id: userId,
                        old_owner_id: null,
                        new_owner_id: userId,
                        old_club_id: null,
                        new_club_id: runnerClubId,
                        old_faction: null,
                        new_faction: runnerFaction,
                        source_request_id: null,
                        action_id: `direct_run_${run.id}`,
                        processed_for_stats: false,
                        processed_at: new Date(),
                        source_run_id: run.id,
                        source_type: 'RUN' as any,
                        event_type: 'CREATED' as any,
                    }));

                    await tx.territory_events.createMany({
                        data: territoryEvents,
                        skipDuplicates: true,
                    });
                }
            }

            // Audit logging for suspicious runs
            if (isBlockedByAntiCheat || pathValidation.riskLevel !== 'LOW') {
                await tx.anti_cheat_audit_logs.create({
                    data: {
                        user_id: userId,
                        run_id: run.id,
                        risk_score: isPedometerInvalid ? Math.max(pathValidation.riskScore, 90) : pathValidation.riskScore,
                        cheat_flags: {
                            ...(pathValidation.cheatFlags as any),
                            pedometer_reason: pedometerAntiCheatLog
                        } as any,
                        raw_payload: runData as any,
                        action_taken: isPedometerInvalid ? 'pedometer_blocked' : (isFlagged ? 'shadowban' : 'polygons_neutralized'),
                    }
                });
            }

            if (isBlockedByAntiCheat) {
                return {
                    runId: run.id,
                    runNumber: 0,
                    totalReward: { coins: 0, xp: 0 },
                    isValid: false,
                    antiCheatLog: pedometerAntiCheatLog ?? 'BLOCKED_BY_ANTICHEAT_PATH_RISK',
                    totalSteps: submittedTotalSteps,
                    isFlagged: true
                };
            }

            let totalCoins = 0;
            let totalXp = 0;

            await updateMissionProgress(userId, 'DISTANCE', Math.round(pathValidation.serverDistance), tx);
            await updateMissionProgress(userId, 'RUN_COUNT', 1, tx);
            if (finalPolygons.length > 0) {
                await updateMissionProgress(userId, 'HEX_COUNT', finalPolygons.length, tx);
            }

            const successfulEvents = eventsHistory.filter(event => event.status === 'SUCCESS');
            const failedEvents = eventsHistory.filter(event => event.status === 'FAILED');
            const hasFailureEvent = failedEvents.length > 0;
            const penaltyMultiplier = hasFailureEvent
                ? Math.min(...failedEvents.map(event => event.penaltyMultiplier ?? 0.5))
                : 1;

            const eventReward = successfulEvents.reduce(
                (acc, event) => {
                    const defaults = getDefaultEventReward(event.eventType);
                    acc.xp += event.reward?.xp ?? defaults.xp;
                    acc.stamina += event.reward?.stamina ?? defaults.stamina;
                    return acc;
                },
                { xp: 0, stamina: 0 }
            );

            totalCoins = Math.floor(totalCoins * penaltyMultiplier);
            totalXp = Math.floor(totalXp * penaltyMultiplier) + eventReward.xp;

            // D. Update City Progress — accurateAreaKm2 pre-computed outside tx
            if (!isFlagged && safeCityId) {
                await tx.user_city_progress.upsert({
                    where: {
                        user_id_city_id: {
                            user_id: userId,
                            city_id: safeCityId
                        }
                    },
                    update: {
                        last_active_at: new Date()
                    },
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
                // safeCityId 允许为 null：run 与领地照常入库，仅跳过城市维度统计
                // ─── Phase 3C: 跑后体力扣减（边界保护）───
                const userProfile = await tx.profiles.findUniqueOrThrow({
                    where: { id: userId },
                    select: { stamina: true, max_stamina: true }
                });

                const distanceKm = pathValidation.serverDistance / 1000;
                const staminaCost = Math.max(0, Math.floor(10 + distanceKm * 10));
                const rewardStamina = eventReward?.stamina || 0;
                const currentStamina = userProfile.stamina ?? 0;
                const maxStamina = userProfile.max_stamina ?? 100;

                const finalStamina = Math.min(
                    maxStamina,
                    Math.max(0, currentStamina - staminaCost + rewardStamina)
                );

                const updatedProfile = await tx.profiles.update({
                    where: { id: userId },
                    data: {
                        coins: { increment: totalCoins },
                        xp: { increment: totalXp },
                        stamina: finalStamina,
                        total_distance_km: { increment: pathValidation.serverDistance / 1000 },
                        total_runs_count: { increment: 1 },
                        updated_at: new Date()
                    }
                });

                return {
                    runId: run.id,
                    runNumber: updatedProfile.total_runs_count,
                    totalReward: { coins: totalCoins, xp: totalXp },
                    isValid: true,
                    antiCheatLog: null,
                    totalSteps: submittedTotalSteps,
                    isFlagged: false
                };
            }

            return {
                runId: run.id,
                runNumber: 0,
                totalReward: { coins: totalCoins, xp: totalXp },
                isValid: true,
                antiCheatLog: null,
                totalSteps: submittedTotalSteps,
                isFlagged: true
            };
        }, { timeout: 30000, maxWait: 10000 });

        // Phase 3: 主事务外部异步结算领地与附属数据更新 (Trigger.dev 核心解耦)
        if (!isBlockedByAntiCheat && !isGeometryInvalid && polygonsForSettlement.length > 0) {
            try {
                console.log(`[Territory-Diag] 准备触发 Trigger, polygons: ${polygonsForSettlement.length}, cityId: ${safeCityId}`);
                const triggerPayload = {
                    runId: result.runId,
                    userId,
                    cityId: safeCityId,
                    clubId: runnerClubId,
                    polygons: polygonsForSettlement,
                    distance: pathValidation.serverDistance,
                    duration: pathValidation.serverDuration,
                    diag: diagData
                };
                console.log(`[Trigger.dev] Enqueuing 'settle-territories'. polygonCount=${polygonsForSettlement.length}, runId=${result.runId}`);
                console.log(`[Trigger.dev] payload: ${JSON.stringify({ runId: triggerPayload.runId, userId: triggerPayload.userId, cityId: triggerPayload.cityId, polygonCount: triggerPayload.polygons.length })}`);
                
                // 容错隔离：Trigger 服务故障绝不阻断用户跑步记录保存
                const handle = await tasks.trigger("settle-territories", triggerPayload);
                
                console.log(`[Territory-Diag-Trigger] 任务已推入队列，随机校验码: ${Math.random()}`);
                if (!handle || !(handle as any)?.id) {
                    throw new Error(`[Trigger.dev] tasks.trigger returned invalid handle (null/undefined id) for runId=${result.runId}`);
                }
                console.log(`[Trigger.dev] ✅ Task enqueued. Handle: ${(handle as any).id}`);
            } catch (err: any) {
                // 关键容错：打印详细错误但绝不向上抛出，确保用户跑步记录正常返回
                console.error('[Trigger.dev] 派发结算任务失败:', err);
                console.error(`[Trigger.dev] ❌ FAILED to enqueue 'settle-territories': ${err?.message ?? err}`);
                console.error(`[Trigger.dev] Full error:`, err);
                console.error(`[Trigger.dev] Error stack:`, err?.stack);
                console.warn(`[Trigger.dev] 领地结算任务派发失败，但不影响跑步记录保存。用户 runId=${result.runId}，可通过定时任务或手动重试补算领地。`);
                // 错误隔离：只打印日志，绝不向上抛出，主流程继续正常返回
            }
        } else if (!isBlockedByAntiCheat && !isGeometryInvalid && polygonsForSettlement.length === 0) {
            console.log('[Territory-Diag] polygonsForSettlement 为空，跳过城市Trigger');
        }

        revalidatePath('/dashboard');
        revalidatePath('/profile/me');
        revalidateTag('territories');
        revalidateTag('city-stats');
        revalidateTag('city-leaderboard');

        return {
            success: true,
            data: {
                runId: result.runId,
                runNumber: result.runNumber,
                totalReward: result.totalReward,
                damageSummary: [],
                maintenanceSummary: [],
                settledTerritoriesCount: 0,
                isValid: result.isValid,
                antiCheatLog: result.antiCheatLog,
                totalSteps: result.totalSteps,
                settlingAsync: (!result.isFlagged && polygonsForSettlement.length > 0) ? true : false,
                territories: []
            }
        };

    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        console.error('Failed to save run:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
/**
 * Updates the AI summary for a specific run record.
 */
export async function updateRunSummary(runId: string, summary: string): Promise<ActionResponse<void>> {
    try {
        if (!runId || !summary) throw new Error('Run ID and summary are required');
        
        await prisma.runs.update({
            where: { id: runId },
            data: { aiSummary: summary }
        });

        console.log(`[RunService] AI Summary updated for run: ${runId}`);
        return { success: true };
    } catch (error: any) {
        console.error('Failed to update run summary:', error);
        return { success: false, error: error.message };
    }
}

export async function getRunSettlementStatus(runId: string): Promise<ActionResponse<{ newTerritories: number; reinforcedTerritories: number; isSettled: boolean } | null>> {
    // 任务三：强制禁用 Next.js 数据缓存，确保每次轮询都读取最新 run.status
    // 若不注入 noStore()，Next.js App Router 可能对 Server Action 响应做 full-route cache，
    // 导致 status 永远是首次缓存的 'settling'，前端陷入轮询死锁。
    noStore();
    try {
        if (!runId) throw new Error('Run ID is required');
        const runRec = await prisma.runs.findUnique({
            where: { id: runId },
            select: { new_territories_count: true, reinforced_territories_count: true, status: true, updated_at: true, created_at: true }
        });
        
        if (!runRec) {
            return { success: false, error: 'Run not found' };
        }
        
        // isSettled = true when Trigger.dev background task has finished and written
        // back the 'completed' (or 'flagged') status. This lets the frontend exit
        // the polling loop even when territory capture counts are legitimately 0.
        const isSettled = runRec.status === 'completed' || runRec.status === 'flagged';

        return {
            success: true,
            data: {
                newTerritories: runRec.new_territories_count || 0,
                reinforcedTerritories: runRec.reinforced_territories_count || 0,
                isSettled,
            }
        };
    } catch (error: any) {
        console.error('Failed to fetch run settlement status:', error);
        return { success: false, error: error.message };
    }
}

export async function getTerritoriesByRunId(
  runId: string
): Promise<ActionResponse<{ territoryId: string | null }>> {
  noStore();
  try {
    if (!runId) throw new Error('Run ID is required');
    const territory = await prisma.territories.findFirst({
      where: { source_run_id: runId, status: 'ACTIVE' },
      select: { id: true },
      orderBy: { first_claimed_at: 'desc' },
    });
    return {
      success: true,
      data: { territoryId: territory?.id ?? null },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
