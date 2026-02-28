"use client";

/**
 * useRunningLocation — 跑步页面专用定位 Hook
 *
 * 职责：
 *  1. Mount 时升级 bridge watch 到 running 模式（高频高精度）
 *  2. Unmount 时降级回 browse 模式（低功耗）
 *  3. 提供 precise fix 启动序列（cache → precise fix → running watch）
 *  4. 通过 RunningLocationFilter 过滤轨迹点（精度、距离、速度/加速度）
 *  5. 管理前后台切换恢复（resume → fastFix + 确认 running watch）
 *  6. 结构化日志（每个点、状态机切换、异常点）+ 可选远程上报
 *
 * 与 GlobalLocationProvider 共享同一 bridge 实例，避免重复初始化或竞态。
 *
 * Foreground Service 集成点（TODO）：
 *  - enabled=true 时 → enableBackgroundLocation()
 *  - enabled=false 时 → disableBackgroundLocation()
 *  当前标记为 TODO，待集成 @capacitor-community/foreground-service。
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocationStore } from '@/store/useLocationStore';
import { useLocationContext } from '@/components/GlobalLocationProvider';
import { RunningLocationFilter, type FilteredPoint, type FilterLog, type RemoteLogReporter, setFilterRemoteReporter } from '@/lib/running-location-filter';
import type { GeoPoint } from '@/hooks/useSafeGeolocation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * 跑步定位状态机：
 *  initializing → acquiring → tracking ⇄ stale → recovering → tracking
 *                                                                  ↓
 *                                                               stopped
 */
export type RunningLocationState =
    | 'initializing'   // 等待 bridge 就绪
    | 'acquiring'      // 正在获取初始精确 fix
    | 'tracking'       // 运行中，高频定位
    | 'stale'          // 15s+ 无有效点
    | 'recovering'     // stale 后正在恢复（fastFix）
    | 'stopped';       // 已停止

export interface RunningLocationStats {
    acceptedPoints: number;
    rejectedPoints: number;
    lastRejectReason: string | null;
    currentSpeedKmh: number | null;
    state: RunningLocationState;
}

export interface UseRunningLocationOptions {
    /** 是否启用（跑步开始时为 true，停止后为 false） */
    enabled: boolean;
    /** 新轨迹点回调（仅通过过滤的点） */
    onTrajectoryPoint?: (point: FilteredPoint) => void;
    /** 状态变化回调 */
    onStateChange?: (state: RunningLocationState) => void;
    /** 可选远程日志上报器 */
    remoteReporter?: RemoteLogReporter | null;
}

// ---------------------------------------------------------------------------
// Constants & Structured Log
// ---------------------------------------------------------------------------

const TAG = '[RunningLocation]';
const STALE_CHECK_INTERVAL_MS = 3000;
const STALE_TIMEOUT_MS = 15_000;

interface HookLog {
    tag: typeof TAG;
    event: 'state_change' | 'trajectory_point' | 'stale_trigger' | 'recovery' | 'lifecycle';
    oldState?: RunningLocationState;
    newState?: RunningLocationState;
    requestId?: string;
    timestamp: number;
    lat?: number;
    lng?: number;
    accuracy?: number;
    speed?: number;
    reason?: string;
}

let _hookRemoteReporter: RemoteLogReporter | null = null;

function emitHookLog(log: HookLog): void {
    console.log(`${TAG} ${JSON.stringify(log)}`);
    // 复用 FilterLog 的 reporter 通道
    _hookRemoteReporter?.(log as any);
}

function makeRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRunningLocation(options: UseRunningLocationOptions) {
    const { enabled, onTrajectoryPoint, onStateChange, remoteReporter } = options;
    const { upgradeToRunning, downgradeToBrowse, getBridge } = useLocationContext();

    const [stats, setStats] = useState<RunningLocationStats>({
        acceptedPoints: 0,
        rejectedPoints: 0,
        lastRejectReason: null,
        currentSpeedKmh: null,
        state: 'initializing',
    });

    const filterRef = useRef(new RunningLocationFilter());
    const stateRef = useRef<RunningLocationState>('initializing');
    const lastAcceptedTimeRef = useRef(Date.now());
    const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const enabledRef = useRef(enabled);
    const mountedRef = useRef(true);
    const sessionRequestIdRef = useRef<string>(makeRequestId());

    enabledRef.current = enabled;

    // --- 设置远程日志上报器 ---
    useEffect(() => {
        setFilterRemoteReporter(remoteReporter ?? null, {
            sampleRate: 0.01,
            batchSize: 20,
            fuzzPrecision: 3,
        });
        _hookRemoteReporter = remoteReporter ?? null;
        return () => {
            setFilterRemoteReporter(null);
            _hookRemoteReporter = null;
        };
    }, [remoteReporter]);

    // --- State setter with structured logging ---
    const setState = useCallback((newState: RunningLocationState) => {
        const oldState = stateRef.current;
        if (oldState === newState) return;
        stateRef.current = newState;

        emitHookLog({
            tag: TAG,
            event: 'state_change',
            oldState,
            newState,
            requestId: sessionRequestIdRef.current,
            timestamp: Date.now(),
            reason: `${oldState} → ${newState}`,
        });

        setStats(prev => ({ ...prev, state: newState }));
        onStateChange?.(newState);
    }, [onStateChange]);

    // --- Trajectory point handler ---
    const handleLocationUpdate = useCallback((point: GeoPoint) => {
        if (!enabledRef.current || !mountedRef.current) return;

        const filtered = filterRef.current.filter(point);

        if (filtered.accepted) {
            lastAcceptedTimeRef.current = Date.now();

            if (stateRef.current === 'stale' || stateRef.current === 'recovering') {
                setState('tracking');
            }

            setStats(prev => ({
                ...prev,
                acceptedPoints: prev.acceptedPoints + 1,
                currentSpeedKmh: filtered.calculatedSpeed != null
                    ? Math.round(filtered.calculatedSpeed * 3.6 * 10) / 10
                    : prev.currentSpeedKmh,
                state: stateRef.current,
            }));

            onTrajectoryPoint?.(filtered);
        } else {
            setStats(prev => ({
                ...prev,
                rejectedPoints: prev.rejectedPoints + 1,
                lastRejectReason: filtered.rejectReason ?? null,
            }));
        }
    }, [onTrajectoryPoint, setState]);

    // --- Stale watchdog ---
    const stopStaleWatchdog = useCallback(() => {
        if (staleTimerRef.current !== null) {
            clearInterval(staleTimerRef.current);
            staleTimerRef.current = null;
        }
    }, []);

    const startStaleWatchdog = useCallback(() => {
        stopStaleWatchdog();

        staleTimerRef.current = setInterval(async () => {
            if (!enabledRef.current || !mountedRef.current) return;
            if (stateRef.current === 'stopped' || stateRef.current === 'initializing') return;

            const elapsed = Date.now() - lastAcceptedTimeRef.current;
            if (elapsed >= STALE_TIMEOUT_MS) {
                const recoveryId = makeRequestId();

                emitHookLog({
                    tag: TAG,
                    event: 'stale_trigger',
                    requestId: recoveryId,
                    timestamp: Date.now(),
                    reason: `${elapsed}ms since last accepted point (threshold: ${STALE_TIMEOUT_MS}ms)`,
                });

                setState('stale');

                const bridge = getBridge();
                if (bridge) {
                    setState('recovering');

                    emitHookLog({
                        tag: TAG,
                        event: 'recovery',
                        requestId: recoveryId,
                        timestamp: Date.now(),
                        reason: 'Delegating recovery to bridge fastFixWithRecoveryWindow',
                    });

                    // 委托 bridge 的 fastFixWithRecoveryWindow 处理完整恢复流程
                    const result = await bridge.fastFixWithRecoveryWindow({
                        initialWindowMs: 10000,
                        retryIntervalMs: 2000,
                        maxRetries: 2,
                        validAccuracy: 100,
                    });

                    if (!mountedRef.current || !enabledRef.current) return;

                    if (result.success) {
                        lastAcceptedTimeRef.current = Date.now();
                        emitHookLog({
                            tag: TAG,
                            event: 'recovery',
                            requestId: recoveryId,
                            timestamp: Date.now(),
                            lat: result.point?.lat,
                            lng: result.point?.lng,
                            accuracy: result.point?.accuracy,
                            reason: 'Recovery success via fastFixWithRecoveryWindow',
                        });
                        setState('tracking');
                    } else {
                        emitHookLog({
                            tag: TAG,
                            event: 'recovery',
                            requestId: recoveryId,
                            timestamp: Date.now(),
                            reason: `Recovery failed: ${result.reason}`,
                        });

                        // 触发 remoteReporter 异常上报
                        _hookRemoteReporter?.({
                            tag: TAG,
                            event: 'recovery' as any,
                            reason: `recovery_failed: ${result.reason}`,
                            timestamp: Date.now(),
                        } as any);

                        // 保持 recovering 状态，等待后续 bridge watchdog 重试
                    }
                }
            }
        }, STALE_CHECK_INTERVAL_MS);
    }, [getBridge, setState, stopStaleWatchdog]);

    // --- Main lifecycle ---
    useEffect(() => {
        mountedRef.current = true;
        const sessionId = makeRequestId();
        sessionRequestIdRef.current = sessionId;

        if (!enabled) {
            setState('stopped');
            stopStaleWatchdog();

            // TODO: disableBackgroundLocation()
            // 后续集成 @capacitor-community/foreground-service 时：
            // AMapLocation.disableBackgroundLocation?.();

            downgradeToBrowse();

            emitHookLog({
                tag: TAG,
                event: 'lifecycle',
                requestId: sessionId,
                timestamp: Date.now(),
                reason: 'Running location disabled, downgraded to browse',
            });
            return;
        }

        let cancelled = false;

        const start = async () => {
            setState('initializing');
            filterRef.current.reset();
            lastAcceptedTimeRef.current = Date.now();

            emitHookLog({
                tag: TAG,
                event: 'lifecycle',
                requestId: sessionId,
                timestamp: Date.now(),
                reason: 'Running location start sequence begin',
            });

            // 等待 bridge 就绪
            const bridge = getBridge();
            if (!bridge) {
                await new Promise<void>((resolve) => {
                    const check = setInterval(() => {
                        if (getBridge() || cancelled) {
                            clearInterval(check);
                            resolve();
                        }
                    }, 200);
                });
            }

            if (cancelled) return;

            // TODO: enableBackgroundLocation()
            // 后续集成 @capacitor-community/foreground-service 时：
            // await AMapLocation.enableBackgroundLocation?.({
            //     title: '城市领主',
            //     body: '跑步记录中...',
            //     icon: 'ic_notification',
            // });

            // Step 1: Precise fix
            setState('acquiring');

            emitHookLog({
                tag: TAG,
                event: 'lifecycle',
                requestId: sessionId,
                timestamp: Date.now(),
                reason: 'Requesting precise fix (timeout: 10s, cacheMaxAge: 0)',
            });

            const bridgeNow = getBridge();
            if (bridgeNow) {
                const fix = await bridgeNow.getCurrentPosition({
                    mode: 'precise',
                    timeout: 10000,
                    cacheMaxAge: 0,
                });

                if (cancelled) return;

                if (fix) {
                    emitHookLog({
                        tag: TAG,
                        event: 'lifecycle',
                        requestId: sessionId,
                        timestamp: Date.now(),
                        lat: fix.lat,
                        lng: fix.lng,
                        accuracy: fix.accuracy,
                        reason: 'Precise fix obtained',
                    });
                    handleLocationUpdate(fix);
                } else {
                    emitHookLog({
                        tag: TAG,
                        event: 'lifecycle',
                        requestId: sessionId,
                        timestamp: Date.now(),
                        reason: 'Precise fix failed, proceeding with watch',
                    });
                }
            }

            if (cancelled) return;

            // Step 2: Upgrade to running mode
            await upgradeToRunning();

            if (cancelled) return;

            setState('tracking');
            startStaleWatchdog();

            emitHookLog({
                tag: TAG,
                event: 'lifecycle',
                requestId: sessionId,
                timestamp: Date.now(),
                reason: 'Running location fully started (tracking)',
            });
        };

        start();

        return () => {
            cancelled = true;
            mountedRef.current = false;
            stopStaleWatchdog();

            emitHookLog({
                tag: TAG,
                event: 'lifecycle',
                requestId: sessionId,
                timestamp: Date.now(),
                reason: 'Running location cleanup — downgrading to browse',
            });

            // TODO: disableBackgroundLocation()

            downgradeToBrowse().catch((e) => {
                console.warn(`${TAG} downgradeToBrowse error:`, e);
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    // --- Store subscription for trajectory filtering ---
    useEffect(() => {
        if (!enabled) return;

        const unsubscribe = useLocationStore.subscribe((state) => {
            if (!enabledRef.current || !mountedRef.current) return;
            if (!state.location) return;
            if (state.locationSource === 'cache') return;

            handleLocationUpdate(state.location);
        });

        return () => { unsubscribe(); };
    }, [enabled, handleLocationUpdate]);

    // --- App resume handler ---
    useEffect(() => {
        if (!enabled) return;

        let handle: { remove: () => void } | null = null;
        let isActive = true;

        (async () => {
            try {
                const { App } = await import('@capacitor/app');
                const h = await App.addListener('appStateChange', async (state) => {
                    if (!isActive || !enabledRef.current || !mountedRef.current) return;

                    if (state.isActive) {
                        const resumeId = makeRequestId();

                        emitHookLog({
                            tag: TAG,
                            event: 'lifecycle',
                            requestId: resumeId,
                            timestamp: Date.now(),
                            reason: 'App resumed during running — triggering recovery',
                        });

                        const bridge = getBridge();
                        if (!bridge) return;

                        setState('recovering');
                        const fix = await bridge.forceFastFix();

                        if (!isActive || !mountedRef.current) return;

                        if (fix) {
                            lastAcceptedTimeRef.current = Date.now();
                            emitHookLog({
                                tag: TAG,
                                event: 'recovery',
                                requestId: resumeId,
                                timestamp: Date.now(),
                                lat: fix.lat,
                                lng: fix.lng,
                                reason: 'Resume fastFix success',
                            });
                        }

                        // 确保仍在 running 模式
                        if (bridge.currentWatchMode !== 'running') {
                            emitHookLog({
                                tag: TAG,
                                event: 'recovery',
                                requestId: resumeId,
                                timestamp: Date.now(),
                                reason: `Resume: watch was ${bridge.currentWatchMode}, upgrading to running`,
                            });
                            await bridge.switchWatchMode('running', { interval: 1000, distanceFilter: 3 });
                        }

                        setState('tracking');
                    }
                });

                if (!isActive) {
                    h?.remove();
                } else {
                    handle = h;
                }
            } catch {
                // Not in Capacitor environment
            }
        })();

        return () => {
            isActive = false;
            handle?.remove();
        };
    }, [enabled, getBridge, setState]);

    return {
        stats,
        resetFilter: useCallback(() => {
            filterRef.current.reset();
            setStats(prev => ({
                ...prev,
                acceptedPoints: 0,
                rejectedPoints: 0,
                lastRejectReason: null,
                currentSpeedKmh: null,
            }));
        }, []),
        getFilterState: useCallback(() => filterRef.current.getState(), []),
    };
}
