"use client";

import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useLocationStore, saveLocationToCache } from '@/store/useLocationStore';
import { AMapLocationBridge, type LocationMeta } from '@/lib/amap-location-bridge';
import type { GeoPoint } from '@/hooks/useSafeGeolocation';

// ---------------------------------------------------------------------------
// Context for non-serializable values (retry + debug)
// ---------------------------------------------------------------------------

interface LocationContextValue {
    retry: () => void;
    getDebugData: () => any;
    /** Upgrade watch to running mode (called by running page mount) */
    upgradeToRunning: () => Promise<void>;
    /** Downgrade watch back to browse mode (called by running page unmount) */
    downgradeToBrowse: () => Promise<void>;
    /** Get bridge ref for advanced usage (running location hook) */
    getBridge: () => AMapLocationBridge | null;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Hook to access the location retry callback and debug data.
 * Must be used within a GlobalLocationProvider tree.
 */
export function useLocationContext(): LocationContextValue {
    const ctx = useContext(LocationContext);
    if (!ctx) {
        return {
            retry: () => console.warn('[useLocationContext] retry called outside GlobalLocationProvider'),
            getDebugData: () => ({}),
            upgradeToRunning: async () => console.warn('[useLocationContext] upgradeToRunning called outside provider'),
            downgradeToBrowse: async () => console.warn('[useLocationContext] downgradeToBrowse called outside provider'),
            getBridge: () => null,
        };
    }
    return ctx;
}

// ---------------------------------------------------------------------------
// GlobalLocationProvider
// ---------------------------------------------------------------------------
//
// The ONLY component in the app that manages GPS state.
// Mounted once in layout.tsx, it:
//   1. Instantiates AMapLocationBridge (native AMap SDK or web fallback)
//   2. Runs the startup sequence: cache hydrate → fast fix → browse watch
//   3. Manages stale watchdog, app resume, and cleanup
//   4. Syncs state into useLocationStore (Zustand)
//
// Replaces the previous useSafeGeolocation-based approach.
// ---------------------------------------------------------------------------

const TAG = '[GlobalLocationProvider]';

export function GlobalLocationProvider({ children }: { children: ReactNode }) {
    const bridgeRef = useRef<AMapLocationBridge | null>(null);
    const mountedRef = useRef(false);
    const initPromiseRef = useRef<Promise<void> | null>(null);

    // --- Startup sequence ---
    useEffect(() => {
        mountedRef.current = true;

        const bridge = new AMapLocationBridge({
            onLocationUpdate: (point: GeoPoint, meta?: LocationMeta) => {
                if (!mountedRef.current) return;

                const rawSource = (point.source ?? 'amap-native') as string;

                // Map bridge source → store locationSource
                const locationSource: 'gps' | 'amap-native' | 'amap-native-cache' | 'web-fallback' | 'cache' =
                    rawSource === 'amap-native' ? 'amap-native'
                        : rawSource === 'amap-native-cache' ? 'amap-native'
                            : rawSource === 'web-fallback' ? 'web-fallback'
                                : rawSource === 'cache' ? 'cache'
                                    : rawSource === 'gps-precise' || rawSource === 'network-coarse' ? 'gps'
                                        : 'amap-native';

                // Write to Zustand store — single source of truth
                useLocationStore.setState({
                    location: point,
                    locationSource,
                    locationMeta: meta ?? null,
                    loading: false,
                    error: null,
                    gpsSignalStrength: point.accuracy != null && point.accuracy <= 50 ? 'good'
                        : point.accuracy != null && point.accuracy <= 200 ? 'weak'
                            : 'none',
                });

                // Persist to localStorage for next cold start
                saveLocationToCache(point);
            },
            onError: (err) => {
                if (!mountedRef.current) return;
                console.error(`${TAG} Location error:`, err);

                const errorType = err.code === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED'
                    : err.code === 'TIMEOUT' ? 'TIMEOUT'
                        : err.code === 'UNAVAILABLE' ? 'UNAVAILABLE'
                            : 'UNKNOWN';

                useLocationStore.setState({
                    error: errorType,
                    loading: false,
                    gpsSignalStrength: 'none',
                });
            },
            onStatusChange: (status) => {
                if (!mountedRef.current) return;
                useLocationStore.setState({
                    status,
                    loading: status === 'locating',
                });
            },
        });

        bridgeRef.current = bridge;

        // Startup sequence (async)
        const startup = async () => {
            console.log(`${TAG} Startup sequence begin`);

            // Step 1: Init bridge (privacy compliance for native)
            await bridge.init();

            if (!mountedRef.current) return;

            // Step 2: Cache hydrate already handled by useLocationStore initial state
            // (Zustand store reads from localStorage on creation)
            const cachedLocation = useLocationStore.getState().location;
            if (cachedLocation) {
                console.log(`${TAG} Cache hydrate: lat=${cachedLocation.lat} lng=${cachedLocation.lng}`);
            }

            // Step 3: Fast fix (parallel to cache — will override cache if successful)
            console.log(`${TAG} Starting fast fix getCurrentPosition`);
            useLocationStore.setState({ loading: true, status: 'locating' });

            const fastResult = await bridge.getCurrentPosition({
                mode: 'fast',
                timeout: 8000,
                cacheMaxAge: 5000,
            });

            if (!mountedRef.current) return;

            if (fastResult) {
                console.log(`${TAG} Fast fix success: lat=${fastResult.lat} lng=${fastResult.lng} accuracy=${fastResult.accuracy}`);
            } else {
                console.warn(`${TAG} Fast fix returned null, keeping cache if available`);
                // Keep the cached location if we have one
                if (!useLocationStore.getState().location) {
                    useLocationStore.setState({ loading: false });
                }
            }

            // Step 4: Start browse watch (low power, home page)
            if (mountedRef.current) {
                console.log(`${TAG} Starting browse watch`);
                await bridge.startWatch({
                    mode: 'browse',
                    interval: 5000,
                    distanceFilter: 10,
                });
            }

            console.log(`${TAG} Startup sequence complete`);
        };

        initPromiseRef.current = startup();

        // --- App resume listener ---
        let appListenerHandle: { remove: () => void } | null = null;
        let isListenerMounted = true;

        (async () => {
            try {
                const { App } = await import('@capacitor/app');
                const handle = await App.addListener('appStateChange', async (state) => {
                    if (!mountedRef.current) return;

                    if (state.isActive) {
                        console.log(`${TAG} App resumed — triggering forceFastFix and ensuring watch`);

                        // Wait for init to complete first
                        await initPromiseRef.current;

                        if (!mountedRef.current || !bridgeRef.current) return;

                        // Force a fresh fix on resume
                        await bridgeRef.current.forceFastFix();

                        // Ensure watch is running
                        if (!bridgeRef.current.watching) {
                            await bridgeRef.current.startWatch({
                                mode: 'browse',
                                interval: 5000,
                                distanceFilter: 10,
                            });
                        }
                    }
                });

                if (!isListenerMounted) {
                    handle?.remove();
                } else {
                    appListenerHandle = handle;
                }
            } catch {
                // Not in Capacitor environment
            }
        })();

        // --- Cleanup ---
        return () => {
            mountedRef.current = false;
            isListenerMounted = false;

            console.log(`${TAG} Unmounting — destroying bridge`);

            if (appListenerHandle) {
                try { appListenerHandle.remove(); } catch { /* noop */ }
            }

            if (bridgeRef.current) {
                bridgeRef.current.destroy().catch((e) => {
                    console.warn(`${TAG} Bridge destroy error:`, e);
                });
                bridgeRef.current = null;
            }
        };
    }, []);

    // --- Context value (stable refs) ---
    const contextValue = React.useMemo<LocationContextValue>(() => ({
        retry: () => {
            console.log(`${TAG} Manual retry triggered`);
            bridgeRef.current?.forceFastFix().then((result) => {
                if (result) {
                    console.log(`${TAG} Retry success: lat=${result.lat} lng=${result.lng}`);
                } else {
                    console.warn(`${TAG} Retry returned no result`);
                }
            });
        },
        getDebugData: () => ({
            bridgeExists: bridgeRef.current !== null,
            isNative: bridgeRef.current?.isNativeMode ?? false,
            isWatching: bridgeRef.current?.watching ?? false,
            watchMode: bridgeRef.current?.currentWatchMode ?? null,
            storeState: useLocationStore.getState(),
        }),
        upgradeToRunning: async () => {
            console.log(`${TAG} Upgrading watch to RUNNING mode`);
            if (bridgeRef.current) {
                await bridgeRef.current.switchWatchMode('running', {
                    interval: 1000,
                    distanceFilter: 3,
                });
            }
        },
        downgradeToBrowse: async () => {
            console.log(`${TAG} Downgrading watch to BROWSE mode`);
            if (bridgeRef.current) {
                await bridgeRef.current.switchWatchMode('browse', {
                    interval: 5000,
                    distanceFilter: 10,
                });
            }
        },
        getBridge: () => bridgeRef.current,
    }), []);

    return (
        <LocationContext.Provider value={contextValue}>
            {children}
        </LocationContext.Provider>
    );
}
