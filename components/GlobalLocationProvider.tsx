"use client";

import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import {
    useLocationStore,
    saveLocationToCache,
    GPS_START_ANCHOR_ACCURACY_METERS,
    GPS_TRACKING_ACCURACY_METERS,
    GPS_START_WARMUP_DISTANCE_FILTER_METERS,
    GPS_START_WARMUP_INTERVAL_MS,
    GPS_BROWSE_INTERVAL_MS,
} from '@/store/useLocationStore';
import { AMapLocationBridge, type LocationMeta } from '@/lib/amap-location-bridge';
import { safeRequestGeolocationPermission } from '@/lib/capacitor/safe-plugins';
import { useGameStore } from '@/store/useGameStore';
import type { GeoPoint } from '@/hooks/useSafeGeolocation';
import { useHydration } from '@/hooks/useHydration';

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
    /** [NEW] Manually trigger permission check and bridge startup */
    initializeLocationSystem: (options?: { onlyIfGranted?: boolean }) => Promise<void>;
    setStartWarmupActive: (active: boolean) => Promise<void>;
    clearWarmupState: () => void;
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
            initializeLocationSystem: async (options?: { onlyIfGranted?: boolean }) => console.warn('[useLocationContext] initializeLocationSystem called outside provider'),
            setStartWarmupActive: async (active: boolean) => console.warn('[useLocationContext] setStartWarmupActive called outside provider', active),
            clearWarmupState: () => console.warn('[useLocationContext] clearWarmupState called outside provider'),
        };
    }
    return ctx;
}

// ---------------------------------------------------------------------------
// GlobalLocationProvider
// ---------------------------------------------------------------------------

const TAG = '[GlobalLocationProvider]';

/**
 * GPS accuracy thresholds (meters).
 *
 * GPS_ACCEPT_ACCURACY  — hard ceiling for accepting a location update.
 *   - 30m covers good outdoor GPS (3-10m) and acceptable network-assist (15-25m).
 *   - Points above 30m are almost always indoor WiFi/cell-tower fallbacks that
 *     produce the visible "jitter" on the map. They are silently dropped.
 *
 * GPS_JITTER_DEAD_ZONE — minimum distance (meters) between consecutive points
 *   before the map marker is allowed to move. This absorbs the ±2-5m GPS noise
 *   seen even in good outdoor conditions.
 */
const GPS_ACCEPT_ACCURACY = 30;   // ← was 100m; tightened to kill indoor jitter
const GPS_JITTER_DEAD_ZONE = 3;   // ← was 0.1m (10cm); raised to 3m

export function GlobalLocationProvider({ children }: { children: ReactNode }) {
    const bridgeRef = useRef<AMapLocationBridge | null>(null);
    const mountedRef = useRef(false);
    const initPromiseRef = useRef<Promise<void> | null>(null);
    const hydrated = useHydration();

    const [permissionGranted, setPermissionGranted] = React.useState(false);
    const [pendingStartLocation, setPendingStartLocation] = React.useState(false);
    const [isAppActive, setIsAppActive] = React.useState(true);
    const [pageVisible, setPageVisible] = React.useState(true);
    const [isStartWarmupActive, setIsStartWarmupActiveState] = React.useState(false);
    const [isWatching, setIsWatching] = React.useState(false);
    const isWatchingRef = useRef(false);

    // Keep ref in sync with React state
    useEffect(() => {
        isWatchingRef.current = isWatching;
    }, [isWatching]);

    // ---------------------------------------------------------------------------
    // initializeLocationSystem
    // ---------------------------------------------------------------------------
    const initializeLocationSystem = async (options?: { onlyIfGranted?: boolean }) => {
        if (initPromiseRef.current) return initPromiseRef.current;

        const onlyIfGranted = options?.onlyIfGranted ?? false;

        const startup = async () => {
            console.log(`${TAG} initializeLocationSystem: initializing basics (onlyIfGranted: ${onlyIfGranted})...`);

            const timeoutHandle = setTimeout(() => {
                const isInit = useGameStore.getState().locationInitialized;
                if (!isInit) {
                    console.warn(`${TAG} Initialization guardian timeout (8s). Forcing locationInitialized = true.`);
                    useGameStore.getState().setLocationInitialized(true);
                }
            }, 8000);

            try {
                const { safeCheckGeolocationPermission, safeRequestGeolocationPermission, isNativePlatform } = await import('@/lib/capacitor/safe-plugins');

                if (!bridgeRef.current) {
                    console.error(`${TAG} Bridge not instantiated during startup!`);
                    return;
                }
                await bridgeRef.current.init();

                if (!mountedRef.current) return;

                let hasPerm = false;
                if (await isNativePlatform()) {
                    const currentPerm = await safeCheckGeolocationPermission();
                    if (currentPerm === 'granted') {
                        hasPerm = true;
                    } else if (!onlyIfGranted) {
                        console.log(`${TAG} Requesting foreground location permission...`);
                        useGameStore.getState().setIsPermissionRequesting(true);
                        try {
                            const newPerm = await safeRequestGeolocationPermission();
                            if (newPerm === 'granted') {
                                hasPerm = true;
                            } else {
                                console.warn(`${TAG} Foreground permission denied.`);
                                useLocationStore.setState({ error: 'PERMISSION_DENIED', loading: false });
                            }
                        } finally {
                            useGameStore.getState().setIsPermissionRequesting(false);
                        }
                    } else {
                        console.log(`${TAG} onlyIfGranted is true and no permission. Staying silent.`);
                    }
                } else {
                    hasPerm = true;
                }

                if (hasPerm && mountedRef.current) {
                    console.log(`${TAG} Permission OK, marking granted & pending start...`);
                    setPermissionGranted(true);
                    setPendingStartLocation(true);
                }
            } catch (err) {
                console.error(`${TAG} Critical initialization error:`, err);
            } finally {
                clearTimeout(timeoutHandle);
                useGameStore.getState().setLocationInitialized(true);
            }
        };

        const p = startup();
        initPromiseRef.current = p;
        return p;
    };

    // ---------------------------------------------------------------------------
    // Stable-state core synchroniser
    // Starts the bridge only when all physical conditions are met.
    // ---------------------------------------------------------------------------
    useEffect(() => {
        if (!mountedRef.current || !bridgeRef.current) return;

        const canStart =
            hydrated &&
            isAppActive &&
            pageVisible &&
            permissionGranted &&
            pendingStartLocation &&
            !isWatching;

        if (canStart) {
            console.log(`${TAG} All stable conditions met. Starting bridge...`);

            (async () => {
                try {
                    useLocationStore.setState({ loading: true, status: 'locating' });

                    // 并行发起 fast-fix，接受 60 秒内的缓存（与 bridge 内部对齐）
                    bridgeRef.current!.getCurrentPosition({
                        mode: 'fast',
                        timeout: 5000,
                        cacheMaxAge: 60000,
                    }).catch(() => { /* 静默捕获，不影响后续 watch */ });

                    // 并行启动 watch
                    const watchPromise = bridgeRef.current!.startWatch({
                        mode: isStartWarmupActive ? 'running' : 'browse',
                        interval: isStartWarmupActive ? GPS_START_WARMUP_INTERVAL_MS : GPS_BROWSE_INTERVAL_MS,
                        distanceFilter: isStartWarmupActive ? GPS_START_WARMUP_DISTANCE_FILTER_METERS : 5,
                    });

                    await watchPromise; // 只阻塞等待 watch 建立
                    setPendingStartLocation(false);
                    setIsWatching(true);
                    console.log(`${TAG} Location watch started successfully.`);
                } catch (err) {
                    console.error(`${TAG} Async bridge startup failed:`, err);
                    // Do NOT clear pendingStartLocation so the effect retries on next state change
                }
            })();
        }
    }, [hydrated, isAppActive, pageVisible, permissionGranted, pendingStartLocation, isStartWarmupActive, isWatching]);

    // ---------------------------------------------------------------------------
    // Main setup effect
    // ---------------------------------------------------------------------------
    useEffect(() => {
        mountedRef.current = true;

        const bridge = new AMapLocationBridge({
            onLocationUpdate: (point: GeoPoint, meta?: LocationMeta) => {
                if (!mountedRef.current) return;

                // ── Accuracy gate ──────────────────────────────────────────────────
                // Drop any point whose accuracy is worse than GPS_ACCEPT_ACCURACY.
                // Indoor WiFi/cell fixes typically report 40-200m and are the primary
                // cause of the "jitter" seen on the map when GPS signal is lost.
                if (point.accuracy != null && point.accuracy > GPS_ACCEPT_ACCURACY) {
                    console.warn(
                        `${TAG} Dropped low-accuracy point: ${point.accuracy.toFixed(0)}m ` +
                        `(threshold: ${GPS_ACCEPT_ACCURACY}m)`
                    );
                    useLocationStore.setState({ gpsSignalStrength: 'none' });
                    return;
                }

                // ── Jitter dead-zone (with cosine latitude scaling) ────────────────
                // Skip updates where the reported position has not moved more than
                // GPS_JITTER_DEAD_ZONE metres. This absorbs the ±2-5m noise that GPS
                // chips produce even under open sky.
                // Uses cosine latitude scaling because 1° longitude ≈ 111km × cos(lat).
                const currentState = useLocationStore.getState();
                if (currentState.location) {
                    const dLat = (point.lat - currentState.location.lat) * 111000;
                    const dLng = (point.lng - currentState.location.lng) * 111000 * Math.cos(point.lat * Math.PI / 180);
                    const approxDistanceMeters = Math.sqrt(dLat * dLat + dLng * dLng);
                    if (approxDistanceMeters < GPS_JITTER_DEAD_ZONE) {
                        return;
                    }
                }

                // ── 缓存偏差主动检测 ─────────────────────────────────────────────
                // 当收到 amap-native 数据时，与缓存位置对比，若偏差 > 500m 则写入 drift
                const cachedLoc = useLocationStore.getState().location;
                if (cachedLoc && point.source === 'amap-native') {
                    const dLat = (point.lat - cachedLoc.lat) * 111000;
                    const dLng = (point.lng - cachedLoc.lng) * 111000 * Math.cos(point.lat * Math.PI / 180);
                    const distFromCache = Math.sqrt(dLat * dLat + dLng * dLng);

                    if (distFromCache > 500) {
                        useLocationStore.setState({ locationDrift: distFromCache });
                    }
                }

                const rawSource = (point.source ?? 'amap-native') as string;
                const locationSource: 'gps' | 'amap-native' | 'amap-native-cache' | 'web-fallback' | 'cache' =
                    rawSource === 'amap-native' ? 'amap-native'
                        : rawSource === 'amap-native-cache' ? 'amap-native-cache'
                            : rawSource === 'web-fallback' ? 'web-fallback'
                                : rawSource === 'cache' ? 'cache'
                                    : rawSource === 'gps-precise' || rawSource === 'network-coarse' ? 'gps'
                                        : 'amap-native';

                useLocationStore.setState({
                    location: point,
                    locationSource,
                    locationMeta: meta ?? null,
                    loading: false,
                    error: null,
                    status: 'locked',
                    gpsSignalStrength:
                        point.accuracy != null && point.accuracy <= GPS_START_ANCHOR_ACCURACY_METERS ? 'good'
                            : point.accuracy != null && point.accuracy <= GPS_TRACKING_ACCURACY_METERS ? 'weak'
                                : 'none',
                });
                useLocationStore.getState().appendWarmupSample(point);
                saveLocationToCache(point);
                useGameStore.getState().updateLocation(point.lat, point.lng);
                useGameStore.getState().setGpsStatus('success');
            },
            onError: (err) => {
                if (!mountedRef.current) return;

                const isSuppressedError =
                    err.code === '7' ||
                    String(err.code) === '7' ||
                    err.code === 'RECOVERY_FAILED' ||
                    String(err.code) === 'RECOVERY_FAILED' ||
                    String(err.message ?? '').includes('INSUFFICIENT_ABROAD_PRIVILEGES') ||
                    String(err.message ?? '').includes('auth fail') ||
                    String(err.message ?? '').includes('KEY错误') ||
                    String(err.message ?? '').includes('native-location-error');

                if (isSuppressedError) {
                    console.warn(`[GlobalLocationProvider] Suppressed error in onError:`, err);
                    useLocationStore.setState({ gpsSignalStrength: 'none', loading: false });
                    useGameStore.getState().setGpsStatus('weak');
                    return;
                }

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

                useGameStore.getState().setGpsStatus('error', errorType);
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

        // --- Visibility Listener ---
        const handleVisibility = () => {
            if (mountedRef.current) {
                setPageVisible(document.visibilityState === 'visible');
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        setPageVisible(document.visibilityState === 'visible');

        // --- App resume listener ---
        let appListenerHandle: { remove: () => void } | null = null;
        let isListenerMounted = true;

        (async () => {
            try {
                const { App } = await import('@capacitor/app');
                const handle = await App.addListener('appStateChange', async (state) => {
                    if (!mountedRef.current) return;

                    if (state.isActive) {
                        setIsAppActive(true);
                        console.log(`${TAG} App resumed (isActive: true)`);

                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new Event('amap-context-check'));
                        }

                        // FIX: When the app resumes, always assume the native watch
                        // may have been killed by the OS while in background.
                        // Reset isWatching to false so the stable-state Effect will
                        // unconditionally restart it if permission is still granted.
                        // This closes the race where isWatchingRef.current stays true
                        // even though the underlying AMap watch is already dead.
                        if (initPromiseRef.current && bridgeRef.current) {
                            const { safeCheckGeolocationPermission } = await import('@/lib/capacitor/safe-plugins');
                            const currentPerm = await safeCheckGeolocationPermission();
                            if (currentPerm === 'granted') {
                                // Reset watching state + pending — let the stable Effect decide
                                setIsWatching(false);
                                setPendingStartLocation(true);
                            }
                        }
                    } else {
                        setIsAppActive(false);
                        // Mark watch as no longer active when going to background,
                        // because the OS may suspend it at any point.
                        setIsWatching(false);
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

            document.removeEventListener('visibilitychange', handleVisibility);

            if (appListenerHandle) {
                try { appListenerHandle.remove(); } catch { /* noop */ }
            }

            // Capture the bridge reference locally before nullifying it so that
            // the async destroy() call does not race with a potential remount
            // that would create a new bridge and overwrite bridgeRef.current.
            const bridgeToDestroy = bridgeRef.current;
            bridgeRef.current = null;

            if (bridgeToDestroy) {
                bridgeToDestroy.destroy().catch((e) => {
                    console.warn(`${TAG} Bridge destroy error:`, e);
                });
            }

            setIsWatching(false);
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
            isWatching,
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
                    interval: GPS_BROWSE_INTERVAL_MS,
                    distanceFilter: 5,
                });
            }
        },
        getBridge: () => bridgeRef.current,
        initializeLocationSystem,
        setStartWarmupActive: async (active: boolean) => {
            setIsStartWarmupActiveState(active);

            const bridge = bridgeRef.current;
            if (!bridge || !permissionGranted) {
                if (active) setPendingStartLocation(true);
                return;
            }

            if (!isWatching) {
                if (active) setPendingStartLocation(true);
                return;
            }

            const nextMode = active ? 'running' : 'browse';
            const nextInterval = active ? GPS_START_WARMUP_INTERVAL_MS : GPS_BROWSE_INTERVAL_MS;
            const nextDistanceFilter = active ? GPS_START_WARMUP_DISTANCE_FILTER_METERS : 5;

            if (bridge.currentWatchMode === nextMode) return;

            try {
                await bridge.switchWatchMode(nextMode, {
                    interval: nextInterval,
                    distanceFilter: nextDistanceFilter,
                });
            } catch (err) {
                console.warn(`${TAG} Failed to switch start warmup mode:`, err);
            }
        },
        clearWarmupState: () => {
            useLocationStore.getState().clearWarmupState();
        },
    }), [initializeLocationSystem, permissionGranted, isWatching]);

    return (
        <LocationContext.Provider value={contextValue}>
            {children}
        </LocationContext.Provider>
    );
}
