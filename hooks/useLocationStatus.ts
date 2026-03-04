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
    const streetName = useGameStore((s) => s.streetName);
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

    // Build city label: countyName + streetName for specificity
    let cityLabel = '定位中…';
    if (countyName && streetName) {
        cityLabel = `${countyName} · ${streetName}`;
    } else if (countyName) {
        cityLabel = countyName;
    } else if (cityName) {
        cityLabel = cityName;
    } else {
        // Fallback: try localStorage cached district from MapHeader
        if (typeof window !== 'undefined') {
            try {
                const cached = localStorage.getItem('last_known_district');
                if (cached) cityLabel = cached;
            } catch { /* ignore */ }
        }
    }

    return {
        status,
        cityLabel,
        canRetry: status !== 'ready',
        lat,
        lng,
    };
}
