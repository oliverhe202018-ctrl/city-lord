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
import { validateRunData } from '@/lib/validators/run-validator';
import { validateRunLegitimacy } from '@/lib/anti-cheat/mvp-rules';
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
import { isLoopClosed, LOOP_CLOSURE_THRESHOLD_M, extractValidLoops, type Coord } from '@/lib/geometry-utils';
import { isTester } from '@/lib/constants/anti-cheat';
import { reverseGeocodeCity } from '@/lib/map/server-geocode';

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
        const rateLimitResult = checkRunRateLimit(userId);
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

        // --- P0 Anti-Cheat MVP Validation ---
        const pathPoints = (runData.path as any[]) || [];

        // P0 剥夺客户端距离计算权：服务端独立重算实际距离
        let actualDistanceKm: number;
        try {
            const serverPathCoords = pathPoints.map(p => [p.lng, p.lat] as [number, number]);
            if (serverPathCoords.length >= 2) {
                const serverLine = turfLineString(serverPathCoords);
                actualDistanceKm = turfLength(serverLine, { units: 'kilometers' });
                console.log(`[Distance-Defense] 服务端重算距离: ${actualDistanceKm.toFixed(4)}km, 客户端上报: ${(runData.distance / 1000).toFixed(4)}km`);
            } else {
                actualDistanceKm = runData.distance / 1000;
                console.warn(`[Distance-Defense] 轨迹点不足，回退客户端距离: ${actualDistanceKm.toFixed(4)}km`);
            }
        } catch (err) {
            actualDistanceKm = runData.distance / 1000;
            console.error(`[Distance-Defense] turfLength 计算失败，回退客户端距离`, err);
        }

        const legitimacyCheck = validateRunLegitimacy({
            distanceKm: actualDistanceKm,
            durationSeconds: runData.duration,
            pathPointsCount: pathPoints.length
        });

        // [God Mode] Bypass P0 legit check for white-listed testers
        const isUserTester = isTester(userId);
        if (isUserTester) {
            (legitimacyCheck as any).isValid = true;
            console.log(`[God Mode] P0 Legitimacy check bypassed for tester: ${userId}`);
        }

        if (!legitimacyCheck.isValid) {
            // 开发环境豁免：仅打印警告，不阻断主流程
            if (process.env.NODE_ENV === 'development') {
                console.warn('[Anti-Cheat] Bypassed for development environment. Reason:', legitimacyCheck.reason);
            } else {
                console.warn(`[Anti-Cheat MVP] Run blocked for user ${userId}. Reason: ${legitimacyCheck.reason}`);
                
                // Log the cheat attempt independently of the main transaction
                await prisma.anti_cheat_audit_logs.create({
                    data: {
                        user_id: userId,
                        risk_score: 100, // Blocking offense
                        cheat_flags: { mvp_reason: legitimacyCheck.reason },
                        raw_payload: runData as any,
                        action_taken: 'BLOCKED_SETTLEMENT'
                    }
                });

                return {
                    success: false,
                    error: "检测到数据异常，可能使用了交通工具，本次跑步无法作为有效占领记录。"
                };
            }
        }
        // ------------------------------------

        // 1. Metadata-based Anti-Cheat check (Speed, Stride, Teleportation)
        const metadataValidation = validateRunData({
            distanceMeters: runData.distance,
            durationSeconds: runData.duration,
            steps: submittedTotalSteps
        });

        // 2. Server-Side Path Analysis & Territory Rebuild (Existing Logic)
        const pathValidation: AntiCheatValidationResult = validateRunAndRebuildTerritories(runData.path as any);

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

        // Combined risk assessment
        let isFlagged = metadataValidation.isFlagged || pathValidation.riskLevel === 'HIGH';
        let isPedometerInvalid = pedometerAntiCheatLog !== null;

        // 任务二: Tester 权限覆盖 — 强制将 effectiveRiskLevel 降为 LOW
        // 防止 MEDIUM 虚拟定位风险在后续管道中清空多边形数组
        let effectiveRiskLevel = pathValidation.riskLevel;

        if (isUserTester) {
            isFlagged = false;
            isPedometerInvalid = false;
            pedometerAntiCheatLog = null;
            effectiveRiskLevel = 'LOW'; // 强制豁免高虚拟定位风险
            console.log(`[God Mode] effectiveRiskLevel forced to LOW for tester: ${userId}`);
        }

        const isBlockedByAntiCheat = isFlagged || isPedometerInvalid;
        const flagReason = metadataValidation.flagReason || (effectiveRiskLevel === 'HIGH' ? 'PATH_ANALYSIS_FAILED' : undefined);

        // 2. 轨迹采样降维 (防 O(N²) 爆算)
        const MAX_SERVER_PATH_POINTS = 600;
        const rawPathPoints = (runData.path as any[]) || [];
        const sampledPath = rdpSamplePath(rawPathPoints, MAX_SERVER_PATH_POINTS);

        // 3. 闭合检测与领地初步提取 (Rule 1 & Rule 2)
        let diagData: any = { status: 'init' };
        let finalPolygons: Coord[][] = [];
        const sampledPointsLngLat = sampledPath.map(p => [p.lng, p.lat] as [number, number]);
        diagData.points = sampledPointsLngLat?.length || 0;
        console.log('[闭合检测] sampledPath 点数:', sampledPointsLngLat.length);
        console.log(`[Territory-Diag] 轨迹总点数: ${sampledPointsLngLat.length}, 总距离: ${runData.distance}m`);

        if (sampledPointsLngLat.length >= 3) {
            const lastPoint = sampledPointsLngLat[sampledPointsLngLat.length - 1];
            const firstPoint = sampledPointsLngLat[0];
            
            let closingPath: [number, number][] | null = null;

            // 规则一：全局首尾闭合 (20米自动吸附)
            const distGlobal = haversineDistance(lastPoint, firstPoint);
            const START_END_SNAP_THRESHOLD_M = 20; // 与前端 LOOP_CLOSURE_THRESHOLD_M 严格对齐
            diagData.distGlobal = distGlobal;
            console.log(`[规则一] 首尾距离: ${distGlobal.toFixed(1)}m (阈值 ${START_END_SNAP_THRESHOLD_M}m)`);
            console.log(`[Territory-Diag] 规则一测算 - 首尾物理距离: ${distGlobal}m (阈值${START_END_SNAP_THRESHOLD_M}m)`);

            if (distGlobal <= START_END_SNAP_THRESHOLD_M && sampledPointsLngLat.length >= 4) {
                // 显式首尾吸附：将起点坐标副本 push 到末尾，形成合法 GeoJSON LinearRing
                const snappedPath = [...sampledPointsLngLat, [firstPoint[0], firstPoint[1]] as [number, number]];
                closingPath = snappedPath;
                console.log(`[规则一-吸附] 首尾距离 ${Math.round(distGlobal)}m ≤ ${START_END_SNAP_THRESHOLD_M}m，已自动闭合`);
            } else {
                // 规则二：P 形线段相交（替换旧的采样点碰撞逻辑）
                const MIN_LOOP_SEGMENT_INDEX = 10;
                const MAX_SEARCH_SEGMENT_INDEX = Math.min(
                    Math.floor(sampledPointsLngLat.length * 0.70),
                    sampledPointsLngLat.length - 2
                );
                const SEGMENT_CROSS_THRESHOLD_M = 15;
                console.log(`[Territory-Diag] 规则二搜索范围 [${MIN_LOOP_SEGMENT_INDEX}, ${MAX_SEARCH_SEGMENT_INDEX}], 总点数: ${sampledPointsLngLat.length}`);
                console.log(`[Territory-Diag] 规则二 - 总采样点: ${sampledPointsLngLat.length}, 搜索范围: [${MIN_LOOP_SEGMENT_INDEX}, ${MAX_SEARCH_SEGMENT_INDEX}]`);

                let bestIndex = -1;
                let minDist = SEGMENT_CROSS_THRESHOLD_M + 1;

                for (let i = MIN_LOOP_SEGMENT_INDEX; i < MAX_SEARCH_SEGMENT_INDEX; i++) {
                    const segA = sampledPointsLngLat[i];
                    const segB = sampledPointsLngLat[i + 1];
                    if (!segA || !segB) continue;
                    
                    // 使用真正的线段交叉验证（CCW 向量叉乘算法）
                    const prevPoint = sampledPointsLngLat[sampledPointsLngLat.length - 2];
                    if (segmentsIntersect(lastPoint, prevPoint, segA, segB)) {
                        minDist = 0; // 交叉距离为 0
                        bestIndex = i;
                        break; // 找到第一个交叉点即停
                    }
                }
                console.log(`[Territory-Diag] 规则二 - bestIndex: ${bestIndex}, minDist: ${minDist.toFixed(1)}m`);

                if (bestIndex !== -1) {
                    diagData.bestIndex = bestIndex;
                    diagData.minDist = minDist;
                    console.log(`[Territory-Diag] 规则二命中 - 线段交叉索引: ${bestIndex}, 距离: ${minDist.toFixed(1)}m`);
                    closingPath = sampledPointsLngLat.slice(bestIndex);
                } else {
                    console.log(`[Territory-Diag] 规则二未命中 - 无线段交叉点（U形/直线跑步，无领地）`);
                }
            }
            console.log('[闭合结果] closingPath 长度:', closingPath ? closingPath.length : 'null');
            console.log(`[Territory-Diag] closingPath 长度: ${closingPath?.length ?? 0}, finalPolygons 长度: ${finalPolygons.length}`);


            // 生成最终多边形环
            if (closingPath && closingPath.length >= 3) {
                const normResult = normalizeRunPolygon(closingPath);
                finalPolygons = normResult.polygons;
                diagData.strategy = normResult.strategy;
                diagData.kinkCount = normResult.kinkCount;
                diagData.rawArea = normResult.rawArea;
                diagData.finalArea = normResult.finalArea;
                diagData.areaInflationRatio = normResult.areaInflationRatio;
                console.log(`[Territory-Diag] Normalize strategy: ${normResult.strategy}, Kinks: ${normResult.kinkCount}, Inflation: ${normResult.areaInflationRatio?.toFixed(2)}`);
            }
            if (finalPolygons.length === 0) { console.log(`[Territory-Diag] 警告: 闭合条件均未满足或多边形构建失败。`); }
        }

        diagData.status = finalPolygons.length === 0 ? 'Polygons Empty' : 'Success';

        const isGeometryInvalid = diagData.areaInflationRatio && diagData.areaInflationRatio > 1.35;
        if (isGeometryInvalid) {
            console.warn(`[GIS] Convex fallback caused massive area inflation (${diagData.areaInflationRatio.toFixed(2)}x). Run blocked with GEOMETRY_INVALID.`);
        }

        // Settlement Gating — 使用 effectiveRiskLevel 代替原始 pathValidation.riskLevel
        if (isBlockedByAntiCheat || isGeometryInvalid) {
            finalPolygons = [];
            console.warn(`[Anti-Cheat] Settlement blocked for user ${userId}. Reason: ${flagReason ?? pedometerAntiCheatLog}`);
        } else if (effectiveRiskLevel === 'MEDIUM' && !isUserTester) {
            finalPolygons = [];
            console.log(`[saveRunActivity] MEDIUM risk run. Polygons neutralized for user: ${userId}`);
        }

        // 4. 大圈吞噬小圈核心算法 (BBox 加速) - 使用 Unkink 解結算法替代 Convex Hull
        function deduplicateByContainment(polygons: any[]): any[] {
            if (polygons.length <= 1) return polygons;

            const withData = polygons.flatMap(polyPts => {
                const coords = polyPts.map((p: any) => [p.lng, p.lat] as [number, number]);
                
                try {
                    // FIX: 廢除凸包，引入解結算法 (Unkink Polygon)
                    // 確保能精確還原 U 型彎、折返路，而不是拉一個包裹所有點的大框
                    if (coords.length < 3) return [];
                    const ring = [...coords];
                    if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) {
                        ring.push([...ring[0]]);
                    }
                    const cleanRing = deduplicateRingPoints(ring);
                    if (cleanRing.length < 4) return [];
                    
                    const rawPoly = turfPolygon([cleanRing]);
                    const unkinked = turfUnkinkPolygon(rawPoly);
                    
                    // 任务二 (GIS 溢出修复): 双重硬性拦截——等周率 + 绝对面积上限
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
                            // 凸包面积比校验：拒绝L形/U形等高凹度伪多边形
                            try {
                                const hull = turfConvex(f);
                                if (hull) {
                                    const hullArea = turfArea(hull);
                                    const convexityRatio = hullArea > 0 ? (area / hullArea) : 1;
                                    if (convexityRatio < 0.55) return false;
                                }
                            } catch { /* 无法计算凸包时保留 */  }
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

            // 优化1：按面積降序排列
            const sorted = withData.sort((a, b) => b.area - a.area);

            const survivors: typeof sorted = [];
            for (const candidate of sorted) {
                let isContained = false;
                for (const big of survivors) {
                    // 优化2：BBox (包围盒) 快速拒绝
                    if (
                        candidate.bbox[0] >= big.bbox[0] && candidate.bbox[1] >= big.bbox[1] &&
                        candidate.bbox[2] <= big.bbox[2] && candidate.bbox[3] <= big.bbox[3]
                    ) {
                        // 优化3：计算重叠
                        try {
                            const intersection = turfIntersect(turfFeatureCollection([big.f, candidate.f]));
                            if (intersection) {
                                const overlapRatio = turfArea(intersection) / candidate.area;
                                if (overlapRatio > 0.90) {
                                    isContained = true;
                                    break;
                                }
                            }
                        } catch (e) { /* skip */ }
                    }
                }
                if (!isContained) survivors.push(candidate);
            }
            // 返回原始路徑點
            return survivors.map(s => s.original);
        }

        const polygonsForSettlement = (isBlockedByAntiCheat || (effectiveRiskLevel === 'MEDIUM' && !isUserTester)) ? [] : deduplicateByContainment(finalPolygons);

        // 5. 直接在内存中累加真实占领的领地面积 - 使用 Unkink 替代 Convex
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
                            if (area > 200_000) return; // MAX_TERRITORY_AREA_M2 硬拦截
                            try {
                                const perimeterM = turfLength(f) * 1000;
                                if (perimeterM > 0) {
                                    const isoRatio = (4 * Math.PI * area) / (perimeterM * perimeterM);
                                    if (isoRatio < 0.003) return;
                                }
                            } catch { /* 无法计算时保留 */ }
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
                        const combined = turfUnion(turfFeatureCollection([merged, validPolys[i]]));
                        if (combined) {
                            merged = combined as Feature<Polygon | MultiPolygon>;
                        }
                    }
                    accurateAreaKm2 = turfArea(merged) / 1000000;
                } catch (e) {
                    console.error('[GIS] Final union for area calculation failed:', e);
                }
            }
        }

        let finalRunStatus = isBlockedByAntiCheat ? 'flagged' : 'settling';
        let customFlagReason = flagReason;
        
        if (isGeometryInvalid) {
            finalRunStatus = 'flagged';
            customFlagReason = 'GEOMETRY_INVALID';
        } else if (!safeCityId) {
            customFlagReason = undefined;
            if (polygonsForSettlement.length === 0) {
                finalRunStatus = 'completed';
                console.log('[Territory-Diag] safeCityId=null 且无多边形，run 直接完成');
            } else {
                // 关键：有多边形时必须保持 settling，避免前端因 completed 过早停止轮询
                finalRunStatus = 'settling';
                console.log('[Territory-Diag] safeCityId=null 但有多边形，保持 settling 等待异步结算回写');
            }
        }

        // 5. Transaction: Save Run + Process Rewards + Audit Logs
        const result = await prisma.$transaction(async (tx: any) => {
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
                    distance: pathValidation.serverDistance,
                    duration: pathValidation.serverDuration,
                    area: accurateAreaKm2 * 1_000_000, // m² 精确面积
                    path: runData.path as any,
                    polygons: finalPolygons as any,
                    status: finalRunStatus,
                    created_at: new Date(runData.timestamp || Date.now()),
                    updated_at: new Date(),
                    idempotency_key: runData.idempotencyKey,
                    // Anti-Cheat Fields
                    risk_score: isUserTester ? 0 : pathValidation.riskScore,
                    risk_level: isUserTester ? 'LOW' : pathValidation.riskLevel,
                    cheat_flags: {
                        ...(pathValidation.cheatFlags as any),
                        ...(isUserTester ? { tester_bypass: true } : {})
                    } as any,
                    client_distance: runData.distance,
                    // New Validator Fields
                    is_flagged: isUserTester ? false : (isFlagged || isGeometryInvalid),
                    flag_reason: isUserTester ? null : customFlagReason,
                    eventsLog: runEventsWithDiag as any,
                    totalSteps: submittedTotalSteps,
                    isValid: isUserTester ? true : (!isPedometerInvalid && !isGeometryInvalid),
                    antiCheatLog: isUserTester ? null : pedometerAntiCheatLog,
                },
            });

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
