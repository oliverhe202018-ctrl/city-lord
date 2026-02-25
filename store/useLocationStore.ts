"use client";

import { create } from 'zustand';
import type { GeoPoint, LocationStatus } from '@/hooks/useSafeGeolocation';

// ---------------------------------------------------------------------------
// useLocationStore — Global GPS state (runtime-only, NOT persisted)
// ---------------------------------------------------------------------------
//
// Single source of truth for the current GPS position.
// Written to ONLY by GlobalLocationProvider.
// Read by MapRoot, RunningMap, useRunningTracker, etc.
// ---------------------------------------------------------------------------

export type GeoErrorType = 'PERMISSION_DENIED' | 'TIMEOUT' | 'UNAVAILABLE' | 'UNKNOWN' | null;

export interface LocationStoreState {
    /** Latest validated GCJ-02 position (may come from cache on cold start) */
    location: GeoPoint | null;

    /** Distinguishes fresh GPS fix from stale localStorage cache */
    locationSource: 'gps' | 'cache' | null;

    loading: boolean;
    error: GeoErrorType;

    /** State machine: initializing → locating → locked → (locating if signal lost) → error */
    status: LocationStatus;

    gpsSignalStrength: 'good' | 'weak' | 'none';
}

// ---------------------------------------------------------------------------
// Cold-start fallback: read localStorage for instant initial value
// ---------------------------------------------------------------------------
function getInitialLocation(): { location: GeoPoint | null; status: LocationStatus } {
    if (typeof window === 'undefined') {
        return { location: null, status: 'initializing' };
    }

    try {
        const cached = localStorage.getItem('last_known_location');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (
                parsed &&
                typeof parsed.lat === 'number' &&
                typeof parsed.lng === 'number' &&
                parsed.lat !== 0 &&
                parsed.lng !== 0
            ) {
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
}));
