/**
 * useHealthKit
 *
 * Bridges native Apple HealthKit (via @perfood/capacitor-healthkit)
 * to the CityLord `syncWatchRunData` Server Action.
 *
 * Features:
 *  - Platform guard (iOS only via Capacitor.isNativePlatform)
 *  - Permission request for WORKOUT_TYPE + HEART_RATE
 *  - Query recent running workouts (last 24 h)
 *  - Map HealthKit records → WatchSyncPayload (incl. externalId for dedup)
 *  - GPS fallback: 10 evenly-spaced phantom points when route data unavailable
 *  - appStateChange listener for silent background sync on foreground
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { syncWatchRunData } from '@/app/actions/watch-sync';
import type { WatchSyncResult } from '@/types/watch-sync';

// ─────────────────────────────────────────────────────────────
// Dynamic imports so the web bundle never pulls in native code
// ─────────────────────────────────────────────────────────────

async function getHealthkitPlugin() {
    if (!Capacitor.isNativePlatform()) return null;
    const mod = await import('@perfood/capacitor-healthkit');
    return mod.CapacitorHealthkit;
}

async function getAppPlugin() {
    if (!Capacitor.isNativePlatform()) return null;
    const { App } = await import('@capacitor/app');
    return App;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** HKWorkoutActivityTypeRunning = 37 */
const RUNNING_ACTIVITY_TYPE = 37;
const MIN_POINTS = 10; // Zod schema minimum
const SOURCE_APP = 'HealthKit';

// ─────────────────────────────────────────────────────────────
// Types (subset of @perfood/capacitor-healthkit result shapes)
// ─────────────────────────────────────────────────────────────

interface HKWorkoutSample {
    uuid: string;
    startDate: string;
    endDate: string;
    duration: number;       // seconds
    totalDistance?: number; // metres
    workoutActivityType?: number;
}

interface HKHeartRateSample {
    uuid: string;
    startDate: string;
    quantity: number;       // bpm
}

interface HKStepSample {
    startDate: string;
    quantity: number;
}

interface HKQueryResult<T> {
    resultData: T[];
    countReturn: number;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function lastNHoursRange(n: number) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - n * 60 * 60 * 1000);
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
}

/**
 * Generate N evenly-distributed phantom track points.
 * Lat/lng are placeholders (0,0) — the activity will not create a territory.
 */
function phantomPoints(
    startIso: string,
    endIso: string,
    count: number,
    hrSamples: HKHeartRateSample[],
) {
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    const step = count <= 1 ? 0 : (endMs - startMs) / (count - 1);

    return Array.from({ length: count }, (_, i) => {
        const ts = Math.round(startMs + i * step);
        const hr = hrSamples.find(s => Math.abs(new Date(s.startDate).getTime() - ts) < 60_000);
        return {
            lat: 0,
            lng: 0,
            timestamp: ts,
            heartRate: hr ? Math.round(hr.quantity) : undefined,
            pace: undefined,
        };
    });
}

// ─────────────────────────────────────────────────────────────
// Hook public interface
// ─────────────────────────────────────────────────────────────

export interface SyncOptions {
    /** When true: suppress error toasts; show only a subtle success micro-notification. */
    silent?: boolean;
    /** How many hours back to query. Default: 24. */
    hoursBack?: number;
}

export interface UseHealthKitState {
    isLoading: boolean;
    isPermissionGranted: boolean | null;
    lastResult: WatchSyncResult | null;
    error: string | null;
}

export interface UseHealthKitReturn extends UseHealthKitState {
    /** Request HealthKit read permissions. */
    init: () => Promise<boolean>;
    /** Fetch recent running workouts and sync to server. */
    sync: (opts?: SyncOptions) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useHealthKit(): UseHealthKitReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [isPermissionGranted, setIsPermissionGranted] = useState<boolean | null>(null);
    const [lastResult, setLastResult] = useState<WatchSyncResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // ── init ───────────────────────────────────────────────────

    const init = useCallback(async (): Promise<boolean> => {
        if (!Capacitor.isNativePlatform()) {
            toast.error('HealthKit 仅在 iOS 设备上可用');
            return false;
        }

        const plugin = await getHealthkitPlugin();
        if (!plugin) return false;

        try {
            // @perfood/capacitor-healthkit expects SampleType strings
            await plugin.requestAuthorization({
                all: [],
                read: ['workouts', 'heart_rate', 'steps'],
                write: [],
            });
            setIsPermissionGranted(true);
            return true;
        } catch (e) {
            const msg = e instanceof Error ? e.message : '权限请求失败';
            toast.error(`HealthKit 权限：${msg}`);
            setIsPermissionGranted(false);
            return false;
        }
    }, []);

    // ── sync ───────────────────────────────────────────────────

    const sync = useCallback(async (opts: SyncOptions = {}): Promise<void> => {
        const { silent = false, hoursBack = 24 } = opts;

        if (!Capacitor.isNativePlatform()) {
            if (!silent) toast.error('HealthKit 仅在 iOS 设备上可用');
            return;
        }

        const plugin = await getHealthkitPlugin();
        if (!plugin) return;

        // Auto-request permissions if not yet requested
        if (isPermissionGranted === null || isPermissionGranted === false) {
            const granted = await init();
            if (!granted) return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { startDate, endDate } = lastNHoursRange(hoursBack);

            // 1. Query workouts
            const workoutRes = await plugin.queryHKitSampleType({
                sampleName: 'workoutType',
                startDate,
                endDate,
                limit: 10,
            }) as HKQueryResult<HKWorkoutSample>;

            const runningWorkouts = (workoutRes.resultData ?? [])
                .filter(w => w.workoutActivityType === RUNNING_ACTIVITY_TYPE)
                .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

            if (runningWorkouts.length === 0) {
                if (!silent) toast.info(`过去 ${hoursBack} 小时内没有跑步记录`);
                setIsLoading(false);
                return;
            }

            // Process most recent workout
            const workout = runningWorkouts[0];

            // 2. Heart rate samples
            let hrSamples: HKHeartRateSample[] = [];
            try {
                const hrRes = await plugin.queryHKitSampleType({
                    sampleName: 'heart_rate',
                    startDate: workout.startDate,
                    endDate: workout.endDate,
                    limit: 300,
                }) as HKQueryResult<HKHeartRateSample>;
                hrSamples = hrRes.resultData ?? [];
            } catch {
                // non-fatal
            }

            // 3. Step count
            let totalSteps = 0;
            try {
                const stepRes = await plugin.queryHKitSampleType({
                    sampleName: 'stepCount',
                    startDate: workout.startDate,
                    endDate: workout.endDate,
                    limit: 1000,
                }) as HKQueryResult<HKStepSample>;
                totalSteps = (stepRes.resultData ?? []).reduce((s, r) => s + Math.round(r.quantity), 0);
            } catch {
                // non-fatal
            }

            // 4. GPS route (best-effort — plugin may not support this)
            let points: { lat: number; lng: number; timestamp: number; heartRate?: number; pace?: number }[] = [];
            let hasRealRoute = false;
            try {
                interface RoutePoint { latitude: number; longitude: number; timestamp: string; speed?: number }
                const routeRes = await plugin.queryHKitSampleType({
                    sampleName: 'workoutRoute',
                    startDate: workout.startDate,
                    endDate: workout.endDate,
                    limit: 3000,
                }) as HKQueryResult<RoutePoint>;

                const routePoints = routeRes.resultData ?? [];
                if (routePoints.length >= MIN_POINTS) {
                    const hrMap = new Map(hrSamples.map(s => [new Date(s.startDate).getTime(), s.quantity]));
                    points = routePoints.map(p => {
                        const ts = new Date(p.timestamp).getTime();
                        // Find nearest HR within 60 s
                        let nearestHR: number | undefined;
                        let minDiff = Infinity;
                        hrMap.forEach((bpm, t) => {
                            const d = Math.abs(t - ts);
                            if (d < minDiff) { minDiff = d; nearestHR = d < 60_000 ? bpm : undefined; }
                        });
                        return {
                            lat: p.latitude,
                            lng: p.longitude,
                            timestamp: ts,
                            heartRate: nearestHR ? Math.round(nearestHR) : undefined,
                            // HealthKit speed is m/s → km/h
                            pace: p.speed != null ? p.speed * 3.6 : undefined,
                        };
                    });
                    hasRealRoute = true;
                }
            } catch {
                // plugin doesn't support workoutRoute — fall through to phantom
            }

            // 5. Fallback: phantom points
            if (!hasRealRoute) {
                points = phantomPoints(workout.startDate, workout.endDate, MIN_POINTS, hrSamples);
                if (!silent) toast.warning('无 GPS 轨迹数据，使用摘要上传（领地不会被创建）');
            }

            // 6. Build payload
            const payload = {
                points,
                summary: {
                    totalDistance: workout.totalDistance ?? 0,
                    totalSteps,
                    startTime: workout.startDate,
                    endTime: workout.endDate,
                },
                externalId: workout.uuid,   // ← dedup key
                sourceApp: SOURCE_APP,
            };

            // 7. Call Server Action
            if (!silent) toast.loading('正在同步 HealthKit 数据…', { id: 'hk-sync' });

            const result = await syncWatchRunData(payload);
            setLastResult(result);

            if (result.success) {
                // Check if duplicate
                if (result.warnings?.some(w => w.toLowerCase().includes('duplicate'))) {
                    if (!silent) toast.dismiss('hk-sync');
                    // Silently ignore duplicates even in non-silent mode
                    return;
                }

                const detail = result.territoryCreated
                    ? `，新增领地 ${((result.territoryArea ?? 0) / 10000).toFixed(2)} 公顷`
                    : '';
                if (silent) {
                    toast.success(`已同步最新跑步记录${detail}`, { duration: 2500 });
                } else {
                    toast.success(`同步成功${detail}`, { id: 'hk-sync' });
                }
            } else {
                setError(result.error ?? '未知错误');
                if (!silent) {
                    toast.error(`同步失败：${result.error ?? '未知错误'}`, { id: 'hk-sync' });
                }
            }

            // Surface non-fatal warnings (filter out dedup messages)
            result.warnings
                ?.filter(w => !w.toLowerCase().includes('duplicate'))
                .forEach(w => toast.warning(w));

        } catch (e) {
            const msg = e instanceof Error ? e.message : '未知错误';
            setError(msg);
            if (!silent) toast.error(`HealthKit 同步出错：${msg}`, { id: 'hk-sync' });
            console.error('[useHealthKit] sync error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [isPermissionGranted, init]);

    // ── Auto-sync on foreground ────────────────────────────────

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let removeListener: (() => void) | null = null;

        getAppPlugin().then(App => {
            if (!App) return;
            App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) {
                    // App came to foreground — trigger silent sync
                    sync({ silent: true });
                }
            }).then(handle => {
                removeListener = () => handle.remove();
            });
        });

        return () => {
            removeListener?.();
        };
    }, [sync]);

    return { isLoading, isPermissionGranted, lastResult, error, init, sync };
}
