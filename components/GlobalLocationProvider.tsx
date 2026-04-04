"use client";

import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import {
    useLocationStore,
    saveLocationToCache,
    GPS_START_ANCHOR_ACCURACY_METERS,
    GPS_TRACKING_ACCURACY_METERS,
    GPS_START_WARMUP_DISTANCE_FILTER_METERS,
    GPS_START_WARMUP_INTERVAL_MS,
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
//
// The ONLY component in the app that manages GPS state.
// Mounted once in layout.tsx, it:
//   1. Instantiates AMapLocationBridge (native AMap SDK or web fallback)
//   2. Wait for manual trigger via initializeLocationSystem()
//   3. Runs the startup sequence: permission request -> cache hydrate → fast fix → browse watch
//   4. Manages stale watchdog, app resume, and cleanup
//   5. Syncs state into useLocationStore (Zustand)
//
// Replaces the previous useSafeGeolocation-based approach.
// ---------------------------------------------------------------------------

const TAG = '[GlobalLocationProvider]';

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

    // Startup sequence (async)
    /**
     * [NEW] Manually trigger permission check and bridge startup.
     * @param options.onlyIfGranted If true, will NOT show permission request popup if not already granted.
     */
    const initializeLocationSystem = async (options?: { onlyIfGranted?: boolean }) => {
        if (initPromiseRef.current) return initPromiseRef.current;

        const onlyIfGranted = options?.onlyIfGranted ?? false;

        const startup = async () => {
            console.log(`${TAG} initializeLocationSystem: initializing basics (onlyIfGranted: ${onlyIfGranted})...`);

            // [NEW] 注册一个 8s 的超时降级，防止桥接初始化由于某种原因挂起导致登录界面锁死
            const timeoutHandle = setTimeout(() => {
                const isInit = useGameStore.getState().locationInitialized;
                if (!isInit) {
                    console.warn(`${TAG} Initialization guardian timeout (8s). Forcing locationInitialized = true.`);
                    useGameStore.getState().setLocationInitialized(true);
                }
            }, 8000);

            try {
                const { safeCheckGeolocationPermission, safeRequestGeolocationPermission, isNativePlatform } = await import('@/lib/capacitor/safe-plugins');
                
                // Step 1: 隐私合规初始化 (高德隐私合规)
                if (!bridgeRef.current) {
                    console.error(`${TAG} Bridge not instantiated during startup!`);
                    return;
                }
                await bridgeRef.current.init();

                if (!mountedRef.current) return;

                // Step 2: 权限核对与申请
                let hasPerm = false;
                if (await isNativePlatform()) {
                    const currentPerm = await safeCheckGeolocationPermission();
                    if (currentPerm === 'granted') {
                        hasPerm = true;
                    } else if (!onlyIfGranted) {
                        console.log(`${TAG} Requesting foreground location permission...`);
                        
                        // [NEW] 加锁阻止登录弹窗
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
                            // [NEW] 无论成功失败，在权限弹窗结束后立即解锁
                            useGameStore.getState().setIsPermissionRequesting(false);
                        }
                    } else {
                        console.log(`${TAG} onlyIfGranted is true and no permission. Staying silent.`);
                    }
                } else {
                    // Web 环境默认视为已处理
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
                // [NEW] 无论流程最终结果（允许或拒绝），只要初始化这一轮尝试过了，就释放准入信号
                useGameStore.getState().setLocationInitialized(true);
            }
        };

        const p = startup();
        initPromiseRef.current = p;
        return p;
    };

    // [New Effect] 稳定态核心同步器：解决 Android 14+ 权限弹窗返回后立即启动 FGS 导致的闪退
    // 只有在满足所有稳定物理条件时，才真正发起桥接启动
    useEffect(() => {
        if (!mountedRef.current || !bridgeRef.current) return;
        
        const isWatching = bridgeRef.current?.watching ?? false;
        const canStart = 
            hydrated &&
            isAppActive && 
            pageVisible && 
            permissionGranted && 
            pendingStartLocation && 
            !isWatching;
        
        if (canStart) {
            console.log(`${TAG} All stable conditions met (Hydrated+Active+Visible+Granted+Pending). Starting bridge...`);
            
            (async () => {
                try {
                    useLocationStore.setState({ loading: true, status: 'locating' });
                    
                    // 1. 获取首位点，确认硬件通路
                    await bridgeRef.current!.getCurrentPosition({
                        mode: 'fast',
                        timeout: 8000,
                        cacheMaxAge: 5000,
                    });

                    if (!mountedRef.current) return;

                    // 2. 正式启动监控 (FGS)
                    console.log(`${TAG} Conditions verified. Executing bridge.startWatch...`);
                    await bridgeRef.current!.startWatch({
                        mode: isStartWarmupActive ? 'running' : 'browse',
                        interval: isStartWarmupActive ? GPS_START_WARMUP_INTERVAL_MS : 5000,
                        distanceFilter: isStartWarmupActive ? GPS_START_WARMUP_DISTANCE_FILTER_METERS : 10,
                    });
                    
                    // 启动成功后清除等待标记，防止并发重复触发
                    setPendingStartLocation(false);
                    console.log(`${TAG} Location watch started successfully in stable state.`);
                } catch (err) {
                    console.error(`${TAG} Async bridge startup failed:`, err);
                    // 启动失败时不清除 pending，以便重试
                }
            })();
        }
    }, [hydrated, isAppActive, pageVisible, permissionGranted, pendingStartLocation, isStartWarmupActive, bridgeRef.current?.watching]);

    // --- Startup sequence ---
    useEffect(() => {
        mountedRef.current = true;

        const bridge = new AMapLocationBridge({
            onLocationUpdate: (point: GeoPoint, meta?: LocationMeta) => {
                if (!mountedRef.current) return;

                // [NEW] 核心熔断器：如果坐标精度超过 100米，强制丢弃，防止地图蓝点和全局状态漂移
                if (point.accuracy != null && point.accuracy > 100) {
                    console.warn(`${TAG} Dropped location due to low accuracy: ${point.accuracy}m > 100m`);
                    // 虽然丢弃坐标，但更新信号状态为 weak 或 none
                    useLocationStore.setState({
                        gpsSignalStrength: 'none',
                    });
                    return;
                }

                const rawSource = (point.source ?? 'amap-native') as string;

                // Map bridge source → store locationSource
                const locationSource: 'gps' | 'amap-native' | 'amap-native-cache' | 'web-fallback' | 'cache' =
                    rawSource === 'amap-native' ? 'amap-native'
                        : rawSource === 'amap-native-cache' ? 'amap-native-cache'
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
                    gpsSignalStrength: point.accuracy != null && point.accuracy <= GPS_START_ANCHOR_ACCURACY_METERS ? 'good'
                        : point.accuracy != null && point.accuracy <= GPS_TRACKING_ACCURACY_METERS ? 'weak'
                            : 'none',
                });
                useLocationStore.getState().appendWarmupSample(point);

                // Persist to localStorage for next cold start
                saveLocationToCache(point);

                // Sync to useGameStore so MapHeader/HomeTopBar can read lat/lng/gpsStatus
                useGameStore.getState().updateLocation(point.lat, point.lng);
                useGameStore.getState().setGpsStatus('success');
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

                // Sync error to useGameStore
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

        // [IMPORTANT] REMOVED automatic startup() call from useEffect hook.
        // It's now triggered manually by the Home Page component via initializeLocationSystem().

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

                        // [P2] 触发 AMap Context 自检事件，交由 MapRoot 执行防崩保护
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new Event('amap-context-check'));
                        }

                        // If already initialized and permission granted but watch stopped, 
                        // re-mark for pending start to trigger the stable Effect
                        if (initPromiseRef.current && bridgeRef.current && !bridgeRef.current.watching) {
                            const currentPerm = await (await import('@/lib/capacitor/safe-plugins')).safeCheckGeolocationPermission();
                            if (currentPerm === 'granted') {
                                setPendingStartLocation(true);
                            }
                        }
                    } else {
                        setIsAppActive(false);
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
        initializeLocationSystem,
        setStartWarmupActive: async (active: boolean) => {
            setIsStartWarmupActiveState(active);

            const bridge = bridgeRef.current;
            if (!bridge || !permissionGranted) {
                if (active) {
                    setPendingStartLocation(true);
                }
                return;
            }

            if (!bridge.watching) {
                if (active) {
                    setPendingStartLocation(true);
                }
                return;
            }

            const nextMode = active ? 'running' : 'browse';
            const nextInterval = active ? GPS_START_WARMUP_INTERVAL_MS : 5000;
            const nextDistanceFilter = active ? GPS_START_WARMUP_DISTANCE_FILTER_METERS : 10;

            if (bridge.currentWatchMode === nextMode) {
                return;
            }

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
    }), [initializeLocationSystem, permissionGranted]);

    return (
        <LocationContext.Provider value={contextValue}>
            {children}
        </LocationContext.Provider>
    );
}
