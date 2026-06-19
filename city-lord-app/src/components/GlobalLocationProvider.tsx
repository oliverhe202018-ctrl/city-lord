"use client";

import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useLocationStore, saveLocationToCache, GPS_START_ANCHOR_ACCURACY_METERS, GPS_TRACKING_ACCURACY_METERS, GPS_DISPLAY_ACCURACY_METERS, GPS_COLD_START_ACCURACY_METERS, GPS_START_WARMUP_DISTANCE_FILTER_METERS, GPS_START_WARMUP_INTERVAL_MS, GPS_BROWSE_INTERVAL_MS,  } from '@/store/useLocationStore';
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
    /** 全生命周期预热：通知原生层开始高频预热流 */
    startPrewarm: () => void;
    /** 全生命周期预热：通知原生层恢复高频（用户开始跑步时） */
    resumeHighFreqPrewarm: () => void;
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
            startPrewarm: () => console.warn('[useLocationContext] startPrewarm called outside provider'),
            resumeHighFreqPrewarm: () => console.warn('[useLocationContext] resumeHighFreqPrewarm called outside provider'),
        };
    }
    return ctx;
}

// ---------------------------------------------------------------------------
// GlobalLocationProvider
// ---------------------------------------------------------------------------

const TAG = '[GlobalLocationProvider]';

/**
 * GPS accuracy thresholds (meters) — 展示流与记录流分离架构。
 *
 * GPS_COLD_START_ACCURACY_METERS (500m) — 冷启动首个点门槛
 *   应用刚启动时，只要 accuracy < 500m 且时间戳在 1 分钟内，立即推给 UI。
 *   目的：让用户瞬间看到蓝点，消除"卡死"焦虑。
 *
 * GPS_DISPLAY_ACCURACY_METERS (100m) — UI 展示门槛
 *   通过此门槛的点可更新地图中心点和蓝点位置。
 *   注意：展示 ≠ 记录，粗精度点不参与跑步距离结算。
 *
 * GPS_JITTER_DEAD_ZONE — 地图标记最小移动距离
 *   吸收 ±2-5m GPS 噪声，防止静止时蓝点抖动。
 */
const GPS_JITTER_DEAD_ZONE = 5;

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
    const warmupTimerRef = useRef<NodeJS.Timeout | null>(null);

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
                    useLocationStore.setState({ loading: false, error: 'UNAVAILABLE', status: 'error' });
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

                // ── 展示流与记录流分离：两层精度门控 ──────────────────────────────
                // 第一层：冷启动快速响应（accuracy < 500m 且时间戳在 1 分钟内）
                //   立即推给 UI，让地图中心点瞬间移动过去并展示蓝点
                // 第二层：常规展示门槛（accuracy <= 100m）
                //   通过此门槛的点可正常更新地图中心点和蓝点位置
                // 注意：展示 ≠ 记录！粗精度点由 useRunningTracker 的 warm-up 逻辑拦截，
                //       绝对不会写入 pathRef 参与距离结算。
                const isColdStartFirstPoint =
                    !useLocationStore.getState().location &&
                    point.accuracy != null &&
                    point.accuracy < GPS_COLD_START_ACCURACY_METERS &&
                    point.timestamp != null &&
                    (Date.now() - point.timestamp) < 600_000;

                const passesDisplayGate =
                    isColdStartFirstPoint ||
                    (point.accuracy != null && point.accuracy <= GPS_DISPLAY_ACCURACY_METERS);

                if (!passesDisplayGate) {
                    console.warn(
                        `${TAG} Dropped low-accuracy point: ${point.accuracy?.toFixed(0)}m ` +
                        `(display threshold: ${GPS_DISPLAY_ACCURACY_METERS}m)`
                    );
                    const currentState = useLocationStore.getState();
                    const timeSinceLastGoodLocation = Date.now() - currentState.lastLocationTimestamp;
                    
                    if (!currentState.location) {
                        useLocationStore.setState({ gpsSignalStrength: 'none' });
                        useLocationStore.setState({ loading: false, status: 'locating' });
                    } else if (timeSinceLastGoodLocation > 15000) {
                        useLocationStore.setState({ gpsSignalStrength: 'weak' });
                    }
                    return;
                }

                if (isColdStartFirstPoint) {
                    console.log(
                        `${TAG} 🚀 Cold-start fast response: accuracy ${point.accuracy?.toFixed(0)}m < ${GPS_COLD_START_ACCURACY_METERS}m, pushing to UI immediately`
                    );
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
                            : point.accuracy != null && point.accuracy <= GPS_DISPLAY_ACCURACY_METERS ? 'weak'
                                : 'none',
                });
                useLocationStore.getState().setLastLocationTimestamp(point.timestamp ?? Date.now());

                // P0 #2 — Mock 虚拟定位拦截：不写入预热历史、不更新地图（开发环境放行以支持模拟器测试）
                const isDev = process.env.NODE_ENV === 'development' ||
                              import.meta.env?.DEV ||
                              point.isDebug === true ||
                              point.isEmulator === true;
                if (point.isMock === true && !isDev) {
                    console.warn(`${TAG} [AntiCheat] Mock location rejected at bridge level`);
                    useLocationStore.setState({ gpsSignalStrength: 'none' });
                    return;
                }

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
                    
                    const currentState = useLocationStore.getState();
                    const timeSinceLastGoodLocation = Date.now() - currentState.lastLocationTimestamp;
                    if (!currentState.location || timeSinceLastGoodLocation > 15000) {
                        useLocationStore.setState({ gpsSignalStrength: 'none', loading: false });
                    } else {
                        useLocationStore.setState({ loading: false });
                    }
                    useGameStore.getState().setGpsStatus('weak');

                    // 如果是海外IP或授权失败(Code 7)，弹Toast引导用户关闭代理/VPN
                    const isAbroadError = err.code === '7' || 
                                          String(err.code) === '7' || 
                                          String(err.message ?? '').includes('INSUFFICIENT_ABROAD_PRIVILEGES');
                    if (isAbroadError) {
                        import('sonner').then(({ toast }) => {
                            toast.error('高德定位授权失败(Code 7)。如果开启了代理或 VPN，请关闭后重试。', {
                                id: 'amap-abroad-error-toast',
                                duration: 8000
                            });
                        }).catch(() => {});
                    }
                    return;
                }

                console.error(`${TAG} Location error:`, err);

                const errorType = err.code === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED'
                    : err.code === 'TIMEOUT' ? 'TIMEOUT'
                        : err.code === 'UNAVAILABLE' ? 'UNAVAILABLE'
                            : 'UNKNOWN';

                const currentState = useLocationStore.getState();
                const timeSinceLastGoodLocation = Date.now() - currentState.lastLocationTimestamp;

                if (!currentState.location || timeSinceLastGoodLocation > 15000) {
                    useLocationStore.setState({
                        error: errorType,
                        loading: false,
                        gpsSignalStrength: 'none',
                    });
                } else {
                    useLocationStore.setState({
                        error: errorType,
                        loading: false,
                    });
                }

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

        // --- 全生命周期预热：App 启动即通知原生层开始高频预热流 ---
        const startPrewarmOnMount = () => {
            if (typeof window !== 'undefined' && 'Capacitor' in window) {
                try {
                    const { Capacitor } = window as any;
                    // [P1 Fix] 增加强制空值校验，防止原生插件空指针导致 Crash
                    Capacitor?.Plugins?.AMapLocationPlugin?.sendPrewarmCommand?.({ command: 'start_prewarm' });
                    console.log(`${TAG} [SmartPrewarm] App mount — prewarm signal sent to native layer`);
                } catch (err) {
                    console.warn(`${TAG} [SmartPrewarm] Failed to send prewarm on mount:`, err);
                }
            }
        };
        startPrewarmOnMount();

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
        let systemEventListenerHandle: { remove: () => void } | null = null;
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

                        // 追帧职责已统一收拢到 useRunningTracker.hydrateOfflinePoints
                        // 此处不再执行追帧，避免双重追帧竞态和数据重复注入

                        // 假设原生 watch 可能被 OS 杀死，重置状态让 stable-state Effect 重建
                        if (initPromiseRef.current && bridgeRef.current) {
                            const { safeCheckGeolocationPermission } = await import('@/lib/capacitor/safe-plugins');
                            const currentPerm = await safeCheckGeolocationPermission();
                            if (currentPerm === 'granted') {
                                setIsWatching(false);
                                setPendingStartLocation(true);
                            }
                        }
                    } else {
                        setIsAppActive(false);
                        // 保留前台服务在原生层持续运行，不再主动 setIsWatching(false)
                        // 原生 LocationForegroundService + Room DB 会继续记录坐标
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

        // --- P1 #3 电池优化白名单引导监听 ---
        (async () => {
            try {
                const { Capacitor } = await import('@capacitor/core');
                if (Capacitor.isNativePlatform()) {
                    const { AMapLocation } = await import('@/plugins/amap-location/definitions');
                    const handle = await AMapLocation.addListener('systemEvent', (data) => {
                        if (!mountedRef.current) return;
                        if (data.eventName === 'battery_optimization_needed') {
                            console.warn(`${TAG} [BatteryOpt] Native layer requests battery optimization whitelist`);
                            // 通过 toast 引导用户加入电池优化白名单
                            if (typeof window !== 'undefined') {
                                // [P1 Fix] 彻底移除 require('sonner')，替换为标准动态导入，防止 ESM 运行时崩溃
                                import('sonner').then(({ toast }) => {
                                    toast.warning('为保持定位稳定，请将本应用加入电池优化白名单', {
                                        duration: 10000,
                                        action: {
                                            label: '去设置',
                                            onClick: async () => {
                                                try {
                                                    // [P1 Fix] 增加强制空值校验，防止原生插件空指针导致 Crash
                                                    await Capacitor.Plugins?.AMapLocation?.openBatteryOptimizationSettings?.();
                                                } catch {
                                                    toast.error('无法打开设置页面');
                                                }
                                            },
                                        },
                                    });
                                }).catch(() => {});
                            }
                        }
                    });
                    if (isListenerMounted) {
                        systemEventListenerHandle = handle;
                    } else {
                        handle.remove();
                    }
                }
            } catch {
                // Not in Capacitor environment
            }
        })();

        // --- Cleanup ---
        return () => {
            mountedRef.current = false;
            isListenerMounted = false;

            if (warmupTimerRef.current) {
                clearTimeout(warmupTimerRef.current);
                warmupTimerRef.current = null;
            }

            console.log(`${TAG} Unmounting — destroying bridge`);

            document.removeEventListener('visibilitychange', handleVisibility);

            if (appListenerHandle) {
                try { appListenerHandle.remove(); } catch { /* noop */ }
            }

            if (systemEventListenerHandle) {
                try { systemEventListenerHandle.remove(); } catch { /* noop */ }
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

            if (warmupTimerRef.current) {
                clearTimeout(warmupTimerRef.current);
                warmupTimerRef.current = null;
            }

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

            if (active) {
                warmupTimerRef.current = setTimeout(async () => {
                    const hasActiveRun = useLocationStore.getState().currentRunId !== null;
                    if (!hasActiveRun && mountedRef.current && bridgeRef.current) {
                        console.log(`${TAG} [SmartPrewarm] 3 minutes idle warmup on start tab, auto-throttling to browse mode to save battery`);
                        try {
                            await bridgeRef.current.switchWatchMode('browse', {
                                interval: GPS_BROWSE_INTERVAL_MS,
                                distanceFilter: 5,
                            });
                            setIsStartWarmupActiveState(false);
                            import('sonner').then(({ toast }) => {
                                toast.info("GPS 预热已自动降频以节省电量");
                            });
                        } catch (err) {
                            console.warn(`${TAG} Failed to auto-throttle warmup mode:`, err);
                        }
                    }
                }, 3 * 60 * 1000);
            }

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
        startPrewarm: () => {
            console.log(`${TAG} [SmartPrewarm] Notifying native layer to start prewarm`);
            if (typeof window !== 'undefined' && 'Capacitor' in window) {
                try {
                    const { Capacitor } = window as any;
                    // [P1 Fix] 增加强制空值校验，防止原生插件空指针导致 Crash
                    Capacitor?.Plugins?.AMapLocationPlugin?.sendPrewarmCommand?.({ command: 'start_prewarm' });
                } catch (err) {
                    console.warn(`${TAG} Failed to send prewarm command:`, err);
                }
            }
        },
        resumeHighFreqPrewarm: () => {
            console.log(`${TAG} [SmartPrewarm] Notifying native layer to resume high-freq`);
            if (typeof window !== 'undefined' && 'Capacitor' in window) {
                try {
                    const { Capacitor } = window as any;
                    // [P1 Fix] 增加强制空值校验，防止原生插件空指针导致 Crash
                    Capacitor?.Plugins?.AMapLocationPlugin?.sendPrewarmCommand?.({ command: 'resume_high_freq' });
                } catch (err) {
                    console.warn(`${TAG} Failed to send resume command:`, err);
                }
            }
        },
    }), [initializeLocationSystem, permissionGranted, isWatching]);

    return (
        <LocationContext.Provider value={contextValue}>
            {children}
        </LocationContext.Provider>
    );
}

