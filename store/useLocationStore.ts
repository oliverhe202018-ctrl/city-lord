"use client";

import { create } from 'zustand';
import type { GeoPoint, LocationStatus } from '@/hooks/useSafeGeolocation';

export const GPS_START_ANCHOR_ACCURACY_METERS = 80;
export const GPS_TRACKING_ACCURACY_METERS = 30;
export const GPS_DISPLAY_ACCURACY_METERS = 100;
export const GPS_COLD_START_ACCURACY_METERS = 500;
export const GPS_START_WARMUP_INTERVAL_MS = 1000;
export const GPS_BROWSE_INTERVAL_MS = 1000;
export const GPS_START_WARMUP_DISTANCE_FILTER_METERS = 3;
const WARMUP_BUFFER_LIMIT = 12;

// ---------------------------------------------------------------------------
// useLocationStore — Global GPS state (runtime-only, NOT persisted)
// ---------------------------------------------------------------------------
//
// Single source of truth for the current GPS position.
// Written to ONLY by GlobalLocationProvider (via AMapLocationBridge).
// Read by MapRoot, RunningMap, useRunningTracker, etc.
// ---------------------------------------------------------------------------

export type GeoErrorType = 'PERMISSION_DENIED' | 'TIMEOUT' | 'UNAVAILABLE' | 'UNKNOWN' | null;

/** 缓存最大有效期（ms） */
export const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 min

/** 预热历史缓冲区最大长度（FIFO 队列上限） */
const PREWARM_HISTORY_MAX_LENGTH = 30;

/** 预热历史检索时间窗口（ms） */
const PREWARM_HISTORY_WINDOW_MS = 30 * 1000; // 30 seconds

const STORAGE_KEY = 'last_known_location';

export interface LocationStoreState {
    /** Latest validated GCJ-02 position (may come from cache on cold start) */
    location: GeoPoint | null;

    /**
     * Distinguishes source:
     * - 'gps'          : legacy GPS fix (from useSafeGeolocation)
     * - 'amap-native'  : Android 高德原生 SDK
     * - 'web-fallback' : navigator.geolocation + gcoord
     * - 'cache'        : localStorage cold-start hydrate
     */
    locationSource: 'gps' | 'amap-native' | 'amap-native-cache' | 'web-fallback' | 'cache' | null;

    loading: boolean;
    error: GeoErrorType;

    /** State machine: initializing → locating → locked → (locating if signal lost) → error */
    status: LocationStatus;

    gpsSignalStrength: 'good' | 'weak' | 'none';

    warmupSamples: GeoPoint[];

    /** 基站定位与缓存位置的偏差距离（米），用于触发强制地图飞跃 */
    locationDrift?: number;

    /** 位置元数据（首次缓存接受标记等，来自 bridge） */
    locationMeta: {
        acceptedAsInitial?: boolean;
        source?: string;
        reason?: string;
    } | null;

    /** 最近一次收到有效定位点的时间戳（毫秒），用于亮屏恢复时增量补帧 */
    lastLocationTimestamp: number;

    /** 当前跑步会话 ID，用于 Room DB 查询补帧 */
    currentRunId: string | null;

    /** 全生命周期预热历史缓冲区（FIFO 队列，最多 30 个点） */
    prewarmHistory: GeoPoint[];

    appendWarmupSample: (point: GeoPoint) => void;
    clearWarmupState: () => void;
    setLastLocationTimestamp: (ts: number) => void;
    setCurrentRunId: (id: string | null) => void;
    injectOfflinePoint: (point: GeoPoint) => void;

    /**
     * 从预热历史中筛选黄金坐标点。
     * @param maxAccuracy 最大允许精度（米）
     * @returns 精度最高（accuracy 数值最小）且满足条件的点，若无则返回 null
     */
    getBestAccuracySample: (maxAccuracy: number) => GeoPoint | null;
}

// ---------------------------------------------------------------------------
// Cold-start fallback: read localStorage for instant initial value
// ---------------------------------------------------------------------------
function getInitialLocation(): { location: GeoPoint | null; status: LocationStatus } {
    if (typeof window === 'undefined') {
        return { location: null, status: 'initializing' };
    }

    try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (
                parsed &&
                typeof parsed.lat === 'number' &&
                typeof parsed.lng === 'number' &&
                parsed.lat !== 0 &&
                parsed.lng !== 0
            ) {
                // cacheMaxAge 检查
                const fetchedAt = parsed.fetchedAt || parsed.timestamp || 0;
                if (fetchedAt > 0 && (Date.now() - fetchedAt) > CACHE_MAX_AGE_MS) {
                    // 缓存过期，不使用
                    console.debug('[useLocationStore] Cache expired, age:', Date.now() - fetchedAt, 'ms');
                    return { location: null, status: 'initializing' };
                }

                return {
                    location: {
                        lat: parsed.lat,
                        lng: parsed.lng,
                        accuracy: parsed.accuracy,
                        heading: parsed.heading,
                        speed: parsed.speed,
                        timestamp: parsed.timestamp || Date.now(),
                        source: 'cache' as const,
                        coordSystem: parsed.coordSystem || 'gcj02',
                    },
                    status: 'locating', // Have a cached value, but GPS not locked yet
                };
            }
        }
    } catch {
        // Silently ignore parse errors
    }

    return { location: null, status: 'initializing' };
}

const initial = getInitialLocation();

export const useLocationStore = create<LocationStoreState>()((set) => ({
    location: initial.location,
    locationSource: initial.location ? 'cache' : null,
    loading: true,
    error: null,
    status: initial.status,
    gpsSignalStrength: 'none',
    warmupSamples: [],
    prewarmHistory: [],
    locationMeta: null,
    lastLocationTimestamp: initial.location?.timestamp ?? 0,
    currentRunId: null,
    appendWarmupSample: (point) => set((state) => {
        const newHistory = [...state.prewarmHistory.slice(-(PREWARM_HISTORY_MAX_LENGTH - 1)), point];
        return {
            warmupSamples: [...state.warmupSamples.slice(-(WARMUP_BUFFER_LIMIT - 1)), point],
            prewarmHistory: newHistory,
        };
    }),
    clearWarmupState: () => set({
        locationMeta: null,
        warmupSamples: [],
        prewarmHistory: [],
    }),
    setLastLocationTimestamp: (ts) => set({ lastLocationTimestamp: ts }),
    setCurrentRunId: (id) => set({ currentRunId: id }),
    injectOfflinePoint: (point) => set({
        location: point,
        locationSource: 'amap-native',
        lastLocationTimestamp: point.timestamp ?? Date.now(),
        loading: false,
        status: 'locked',
    }),
    getBestAccuracySample: (maxAccuracy: number): GeoPoint | null => {
        const state = useLocationStore.getState();
        const now = Date.now();
        const cutoff = now - PREWARM_HISTORY_WINDOW_MS;

        // Filter: within time window AND accuracy <= maxAccuracy
        const validSamples = state.prewarmHistory.filter(
            (p: GeoPoint) => {
                const ts = p.timestamp ?? 0;
                const acc = p.accuracy ?? Infinity;
                return ts >= cutoff && acc <= maxAccuracy;
            }
        );

        if (validSamples.length === 0) return null;

        // Return the one with minimum accuracy (most precise)
        let best: GeoPoint = validSamples[0];
        for (let i = 1; i < validSamples.length; i++) {
            if ((validSamples[i].accuracy ?? Infinity) < (best.accuracy ?? Infinity)) {
                best = validSamples[i];
            }
        }

        console.log(
            `[SmartPrewarm] Anchor successfully bound to hot high-accuracy sample (Accuracy: ${best.accuracy?.toFixed(1)}m)`
        );
        return best;
    },
}));

// ---------------------------------------------------------------------------
// Helper: save location to localStorage cache
// ---------------------------------------------------------------------------
export function saveLocationToCache(point: GeoPoint): void {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...point, fetchedAt: Date.now() }),
        );
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.warn('[useLocationStore] Quota exceeded, clearing old cache');
            try {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify({ ...point, fetchedAt: Date.now() }),
                );
            } catch {
                console.error('[useLocationStore] Cache rewrite failed');
            }
        }
    }
}
