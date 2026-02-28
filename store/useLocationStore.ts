"use client";

import { create } from 'zustand';
import type { GeoPoint, LocationStatus } from '@/hooks/useSafeGeolocation';

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

    /** 位置元数据（首次缓存接受标记等，来自 bridge） */
    locationMeta: {
        acceptedAsInitial?: boolean;
        source?: string;
        reason?: string;
    } | null;
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

export const useLocationStore = create<LocationStoreState>()(() => ({
    location: initial.location,
    locationSource: initial.location ? 'cache' : null,
    loading: true,
    error: null,
    status: initial.status,
    gpsSignalStrength: 'none',
    locationMeta: null,
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
