'use client';

import { useGameStore } from '@/store/useGameStore';

export type LocationStatusType = 'ready' | 'error' | 'stale';

export interface LocationStatusResult {
    status: LocationStatusType;
    cityLabel: string;
    canRetry: boolean;
    lat: number | null;
    lng: number | null;
}

/**
 * Thin wrapper around Zustand geolocation state.
 * Provides a simplified status for the HomeTopBar.
 */
export function useLocationStatus(): LocationStatusResult {
    const lat = useGameStore((s) => s.latitude);
    const lng = useGameStore((s) => s.longitude);
    const gpsError = useGameStore((s) => s.gpsError);
    const cityName = useGameStore((s) => s.cityName);
    const countyName = useGameStore((s) => s.countyName);
    const lastUpdate = useGameStore((s) => s.lastUpdate);

    // Determine status
    let status: LocationStatusType = 'ready';
    if (gpsError) {
        status = 'error';
    } else if (!lat || !lng) {
        status = 'stale';
    } else if (lastUpdate && Date.now() - lastUpdate > 5 * 60 * 1000) {
        status = 'stale'; // >5 min since last update
    }

    // Build city label
    const cityLabel = countyName && cityName
        ? `${cityName} · ${countyName}`
        : cityName || '定位中…';

    return {
        status,
        cityLabel,
        canRetry: status !== 'ready',
        lat,
        lng,
    };
}
