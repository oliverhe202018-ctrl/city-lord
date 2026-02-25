"use client";

import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useSafeGeolocation } from '@/hooks/useSafeGeolocation';
import { useLocationStore } from '@/store/useLocationStore';

// ---------------------------------------------------------------------------
// Context for non-serializable values (retry + getDebugData)
// These MUST NOT be stored in Zustand (stale closures, DevTools issues).
// ---------------------------------------------------------------------------

interface LocationContextValue {
    retry: () => void;
    getDebugData: () => any;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Hook to access the location retry callback and debug data.
 * Must be used within a GlobalLocationProvider tree.
 */
export function useLocationContext(): LocationContextValue {
    const ctx = useContext(LocationContext);
    if (!ctx) {
        // Graceful fallback for components rendered outside the provider
        return {
            retry: () => console.warn('[useLocationContext] retry called outside GlobalLocationProvider'),
            getDebugData: () => ({}),
        };
    }
    return ctx;
}

// ---------------------------------------------------------------------------
// GlobalLocationProvider
// ---------------------------------------------------------------------------
//
// The ONLY component in the app that calls useSafeGeolocation.
// Mounted once in layout.tsx, it:
//   1. Maintains the single GPS watcher (high accuracy)
//   2. Syncs state into useLocationStore (Zustand)
//   3. Exposes retry/getDebugData via React Context
//
// Replaces EarlyGeolocationPreloader (which is now deleted).
// ---------------------------------------------------------------------------

export function GlobalLocationProvider({ children }: { children: ReactNode }) {
    const { location, loading, error, status, gpsSignalStrength, retry, getDebugData } =
        useSafeGeolocation({
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0,
        });

    // Sync GPS state → Zustand store
    // locationSource uses `status` as the reliable signal, NOT GeoPoint.source,
    // because setLocation and setStatus are separate useState calls inside
    // useSafeGeolocation, so GeoPoint.source can arrive before status updates.
    useEffect(() => {
        useLocationStore.setState({
            location: location ?? useLocationStore.getState().location, // Keep cache if GPS null
            loading,
            error,
            gpsSignalStrength,
        });
    }, [location, loading, error, gpsSignalStrength]);

    // Separate effect for locationSource — depends ONLY on status
    // to avoid atomicity issues (location may update before status in the same cycle)
    useEffect(() => {
        useLocationStore.setState({
            status,
            locationSource: status === 'locked' ? 'gps'
                : (useLocationStore.getState().location ? 'cache' : null),
        });
    }, [status]);

    return (
        <LocationContext.Provider value={{ retry, getDebugData }}>
            {children}
        </LocationContext.Provider>
    );
}
