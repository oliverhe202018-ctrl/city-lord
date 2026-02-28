/**
 * AMapLocationBridge — 核心定位桥接层
 *
 * 职责：
 *  - native 环境走 AMapLocation 插件（GCJ-02 直写）
 *  - web 环境走 navigator.geolocation + gcoord WGS84→GCJ02
 *  - 隐私合规、并发控制（requestId）、stale watchdog、精度门槛、去重
 *
 * 禁止从外部直接操作 AMapLocation 插件，统一通过此 Bridge 调用。
 */

import type { PluginListenerHandle } from '@capacitor/core';
import type { AMapPosition, AMapLocationError } from '@/plugins/amap-location/definitions';
import type { GeoPoint } from '@/hooks/useSafeGeolocation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAG = '[AMapBridge]';

/** 默认精度门槛（米） — 超过此值拒绝更新地图中心 */
const DEFAULT_ACCURACY_THRESHOLD = 500;
/** 冷启动时允许的精度门槛（更宽松） */
const COLD_START_ACCURACY_THRESHOLD = 1500;
/** stale watchdog 超时（ms） */
const STALE_WATCHDOG_TIMEOUT_MS = 15_000;
/** 去重：两点之间最小时间差（ms） */
const DEDUP_MIN_TIME_DIFF_MS = 500;
/** 去重：两点之间最小距离差（米） */
const DEDUP_MIN_DISTANCE_M = 1;
/** 缓存最大年龄（ms），用于 localStorage */
const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 min
/** SDK 缓存 locationType（前次缓存 = 2，基站缓存 = 4） */
const SDK_CACHE_LOCATION_TYPES = [2, 4, 9];

/** Hight_Accuracy 临时模式窗口（ms）— 恢复窗口初始持续时间 */
const TEMP_MODE_WINDOW_MS = 10_000;
/** Hight_Accuracy 最大重试次数 — 窗口到期后可重新打开的次数 */
const TEMP_MODE_MAX_RETRIES = 2;
/** 恢复有效点精度门槛（米）— 低于此值视为成功恢复 */
const RECOVERY_ACCURACY_THRESHOLD = 100;
/** fastFix 重试间隔（ms）— 恢复循环中每次 getCurrentPosition 间隔 */
const RECOVERY_RETRY_INTERVAL_MS = 2000;
/** stopWatch 超时（ms）— 超过此时间未确认 stop 则 forceDestroy */
const STOP_TIMEOUT_MS = 2000;

// ---- 首次缓存判定（Cold-start initial cache acceptance）----
/** SDK 缓存首次接受最大年龄（ms），默认 60s — 便于后续远程配置 */
const INITIAL_CACHE_MAX_AGE_MS = 60_000;
/** 首次缓存接受后连续精度失败触发强制 fastFix 的次数 */
const INITIAL_CACHE_CONSECUTIVE_FAIL_LIMIT = 2;
/** 首次缓存接受精度门槛（米）— 宽松于运行时门槛 */
const INITIAL_CACHE_ACCURACY_THRESHOLD = 500;
/** 设备时间与 point.timestamp 最大允许差异（ms）— 超过 1h 拒绝缓存，防止时间回拨 */
const MAX_DEVICE_TIME_DRIFT_MS = 60 * 60 * 1000;
/** 拒绝的长期缓存 locationType 类型（前次缓存=2, 最后已知=9） */
const LONG_TERM_CACHE_LOCATION_TYPES = [2, 9];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LocationSource = 'cache' | 'amap-native' | 'amap-native-cache' | 'web-fallback' | 'gps-precise' | 'network-coarse';

/** 位置更新附带的元信息（可选） */
export interface LocationMeta {
    acceptedAsInitial?: boolean;
    source?: string;
    reason?: string;
}

export interface BridgeCallbacks {
    /** 有效定位更新（meta 为可选元信息，如首次缓存接受标记） */
    onLocationUpdate: (point: GeoPoint, meta?: LocationMeta) => void;
    /** 定位错误 */
    onError: (error: { code: string; message: string }) => void;
    /** 状态变更（locating / locked / error） */
    onStatusChange: (status: 'locating' | 'locked' | 'error') => void;
}

interface StructuredLog {
    requestId?: string;
    phase: string;
    source?: LocationSource;
    locationType?: number;
    timestamp?: number;
    accuracy?: number;
    reason?: string;
    lat?: number;
    lng?: number;
    retries?: number;
    acceptedAsInitial?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logInfo(log: StructuredLog) {
    console.log(`${TAG} ${JSON.stringify(log)}`);
}

function logWarn(log: StructuredLog) {
    console.warn(`${TAG} ${JSON.stringify(log)}`);
}

function logError(log: StructuredLog) {
    console.error(`${TAG} ${JSON.stringify(log)}`);
}

/** Haversine distance (meters) */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 简易 requestId 生成 */
function makeRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// AMapLocationBridge
// ---------------------------------------------------------------------------

export class AMapLocationBridge {
    private callbacks: BridgeCallbacks;
    private isNative = false;
    private initialized = false;
    private destroyed = false;

    // 并发控制
    private currentRequestId: string | null = null;
    private fastFixInFlight = false;
    /** switchWatchMode 原子性 requestId */
    private switchRequestId: string | null = null;

    // Watch 状态
    private isWatching = false;
    private watchMode: 'browse' | 'running' | null = null;

    // 临时模式恢复状态（Hight_Accuracy rollback）
    private tempModeRequest: {
        id: string;
        startedAt: number;
        retries: number;
        originalMode: 'running' | 'browse';
    } | null = null;

    // stale watchdog
    private lastAcceptedTime = 0;
    private staleWatchdogTimer: ReturnType<typeof setTimeout> | null = null;

    // 去重
    private lastAcceptedPoint: { lat: number; lng: number; timestamp: number } | null = null;

    // 冷启动标志
    private hasFreshFix = false;

    // 首次缓存接受追踪
    /** 冷启动时 SDK 缓存是否已被接受为初始位置 */
    private initialCacheAccepted = false;
    /** 首次缓存接受后连续精度不达标次数（连续 2 次后触发强制 fastFix） */
    private postInitialCacheFailCount = 0;

    // Native listener handles
    private locationUpdateHandle: PluginListenerHandle | null = null;
    private locationErrorHandle: PluginListenerHandle | null = null;

    // Lazy-loaded modules
    private _AMapLocation: typeof import('@/plugins/amap-location/definitions').AMapLocation | null = null;
    private _gcoord: typeof import('gcoord').default | null = null;

    constructor(callbacks: BridgeCallbacks) {
        this.callbacks = callbacks;
    }

    // =========================================================================
    // Init
    // =========================================================================

    async init(): Promise<void> {
        if (this.initialized) return;

        logInfo({ phase: 'init-start', reason: 'Checking platform' });

        // 判断平台
        try {
            const { Capacitor } = await import('@capacitor/core');
            this.isNative = Capacitor.isNativePlatform();
        } catch {
            this.isNative = false;
        }

        if (this.isNative) {
            try {
                const mod = await import('@/plugins/amap-location/definitions');
                this._AMapLocation = mod.AMapLocation;

                // 隐私合规 — 必须在定位前调用
                logInfo({ phase: 'privacy-compliance', reason: 'Calling updatePrivacyShow + updatePrivacyAgree' });
                await this._AMapLocation.updatePrivacyShow({ isContains: true, isShow: true });
                await this._AMapLocation.updatePrivacyAgree({ isAgree: true });
                logInfo({ phase: 'privacy-compliance', reason: 'Privacy compliance confirmed' });

                // 注册事件监听
                this.locationUpdateHandle = await this._AMapLocation.addListener(
                    'locationUpdate',
                    (pos: AMapPosition) => this.handleNativeUpdate(pos),
                );
                this.locationErrorHandle = await this._AMapLocation.addListener(
                    'locationError',
                    (err: AMapLocationError) => this.handleNativeError(err),
                );

                logInfo({ phase: 'init-complete', source: 'amap-native', reason: 'Native plugin initialized with listeners' });
            } catch (e) {
                logError({ phase: 'init-native-fail', reason: String(e) });
                this.isNative = false; // 降级到 web
            }
        }

        if (!this.isNative) {
            // Web fallback: 预加载 gcoord
            try {
                const gcoordMod = await import('gcoord');
                this._gcoord = gcoordMod.default;
                logInfo({ phase: 'init-complete', source: 'web-fallback', reason: 'Web fallback with gcoord ready' });
            } catch (e) {
                logWarn({ phase: 'init-gcoord-fail', reason: String(e) });
            }
        }

        this.initialized = true;
    }

    // =========================================================================
    // getCurrentPosition
    // =========================================================================

    async getCurrentPosition(options: {
        mode: 'fast' | 'precise';
        timeout?: number;
        cacheMaxAge?: number;
    }): Promise<GeoPoint | null> {
        if (this.destroyed) return null;

        const requestId = makeRequestId();
        this.currentRequestId = requestId;
        this.fastFixInFlight = true;
        const timeout = options.timeout ?? 8000;
        const cacheMaxAge = options.cacheMaxAge ?? 5000;

        logInfo({
            requestId,
            phase: 'getCurrentPosition-start',
            reason: `mode=${options.mode} timeout=${timeout} cacheMaxAge=${cacheMaxAge}`,
        });

        this.callbacks.onStatusChange('locating');

        try {
            if (this.isNative && this._AMapLocation) {
                return await this.getNativePosition(requestId, options.mode, timeout, cacheMaxAge);
            } else {
                return await this.getWebPosition(requestId, timeout);
            }
        } catch (e) {
            logError({ requestId, phase: 'getCurrentPosition-error', reason: String(e) });
            // 错误不阻断后续 watch
            return null;
        } finally {
            this.fastFixInFlight = false;
        }
    }

    private async getNativePosition(
        requestId: string,
        mode: 'fast' | 'precise',
        timeout: number,
        cacheMaxAge: number,
    ): Promise<GeoPoint | null> {
        const result = await this._AMapLocation!.getCurrentPosition({
            mode,
            timeout,
            cacheMaxAge: mode === 'fast' ? cacheMaxAge : 0,
        });

        // 验证 requestId 仍为最新
        if (this.currentRequestId !== requestId) {
            logWarn({ requestId, phase: 'getCurrentPosition-stale-request', reason: 'Newer request superseded this one' });
            return null;
        }

        // 判断是否为 SDK 缓存
        const isSdkCache = SDK_CACHE_LOCATION_TYPES.includes(result.locationType);
        const source: LocationSource = isSdkCache ? 'amap-native-cache' : 'amap-native';

        // --- 冷启动首次缓存判定 ---
        if (!this.hasFreshFix && isSdkCache) {
            const cacheResult = this.acceptInitialCacheIfValid(result, INITIAL_CACHE_MAX_AGE_MS);
            if (cacheResult.acceptedAsInitial) {
                const point = this.amapPositionToGeoPoint(result, source);
                logInfo({
                    requestId,
                    phase: 'cold_start_cache_accepted',
                    source,
                    locationType: result.locationType,
                    timestamp: result.timestamp,
                    accuracy: result.accuracy,
                    lat: result.lat,
                    lng: result.lng,
                    acceptedAsInitial: true,
                    reason: cacheResult.reason,
                });
                this.acceptPoint(point, { acceptedAsInitial: true, reason: cacheResult.reason });
                return point;
            } else {
                logWarn({
                    requestId,
                    phase: 'cold_start_cache_rejected',
                    locationType: result.locationType,
                    accuracy: result.accuracy,
                    timestamp: result.timestamp,
                    reason: cacheResult.reason,
                });
                // 不 return null — 继续走正常精度判断，可能仍为可用点
            }
        }

        // 精度门槛
        const accuracyThreshold = this.hasFreshFix
            ? DEFAULT_ACCURACY_THRESHOLD
            : COLD_START_ACCURACY_THRESHOLD;

        if (result.accuracy > accuracyThreshold) {
            logWarn({
                requestId,
                phase: 'getCurrentPosition-accuracy-reject',
                accuracy: result.accuracy,
                reason: `Exceeds threshold ${accuracyThreshold}m`,
            });

            // 首次缓存接受后的连续精度失败追踪
            if (this.initialCacheAccepted && !this.hasFreshFix) {
                this.postInitialCacheFailCount++;
                logWarn({
                    requestId,
                    phase: 'post_initial_cache_fail',
                    accuracy: result.accuracy,
                    retries: this.postInitialCacheFailCount,
                    reason: `Consecutive precision fail ${this.postInitialCacheFailCount}/${INITIAL_CACHE_CONSECUTIVE_FAIL_LIMIT}`,
                });

                if (this.postInitialCacheFailCount >= INITIAL_CACHE_CONSECUTIVE_FAIL_LIMIT) {
                    logWarn({
                        requestId,
                        phase: 'post_initial_cache_force_retry',
                        reason: `${INITIAL_CACHE_CONSECUTIVE_FAIL_LIMIT} consecutive precision fails after initial cache, forcing fresh fastFix`,
                    });
                    this.postInitialCacheFailCount = 0;
                    // 触发一次强制 precise fix（不接受缓存）
                    // 注意：不在此递归调用以避免循环，而是返回 null 让上层重试
                }
            }

            return null;
        }

        // 精度达标：重置连续失败计数
        this.postInitialCacheFailCount = 0;

        const point = this.amapPositionToGeoPoint(result, source);

        logInfo({
            requestId,
            phase: 'getCurrentPosition-success',
            source,
            locationType: result.locationType,
            timestamp: result.timestamp,
            accuracy: result.accuracy,
            lat: result.lat,
            lng: result.lng,
            reason: isSdkCache ? 'Accepted SDK cache (cold start)' : 'Fresh GPS fix',
        });

        this.acceptPoint(point);
        return point;
    }

    private async getWebPosition(requestId: string, timeout: number): Promise<GeoPoint | null> {
        return new Promise<GeoPoint | null>((resolve) => {
            if (typeof navigator === 'undefined' || !navigator.geolocation) {
                logWarn({ requestId, phase: 'web-fallback-unavailable', reason: 'navigator.geolocation not available' });
                resolve(null);
                return;
            }

            const timer = setTimeout(() => {
                logWarn({ requestId, phase: 'web-fallback-timeout', reason: `Timeout after ${timeout}ms` });
                resolve(null);
            }, timeout);

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    clearTimeout(timer);
                    if (this.currentRequestId !== requestId) {
                        resolve(null);
                        return;
                    }

                    let lat = pos.coords.latitude;
                    let lng = pos.coords.longitude;

                    // Web fallback: WGS-84 → GCJ-02
                    if (this._gcoord) {
                        const transformed = this._gcoord.transform([lng, lat], this._gcoord.WGS84, this._gcoord.GCJ02);
                        lng = transformed[0];
                        lat = transformed[1];
                    }

                    const point: GeoPoint = {
                        lat,
                        lng,
                        accuracy: pos.coords.accuracy,
                        heading: pos.coords.heading,
                        speed: pos.coords.speed,
                        timestamp: pos.timestamp,
                        source: 'network-coarse',
                        coordSystem: 'gcj02',
                    };

                    if (pos.coords.accuracy > DEFAULT_ACCURACY_THRESHOLD) {
                        logWarn({
                            requestId,
                            phase: 'web-fallback-accuracy-reject',
                            accuracy: pos.coords.accuracy,
                            reason: `Exceeds threshold ${DEFAULT_ACCURACY_THRESHOLD}m`,
                        });
                        resolve(null);
                        return;
                    }

                    logInfo({
                        requestId,
                        phase: 'getCurrentPosition-success',
                        source: 'web-fallback',
                        accuracy: pos.coords.accuracy,
                        lat,
                        lng,
                        reason: 'Web geolocation with gcoord transform',
                    });

                    this.acceptPoint(point);
                    resolve(point);
                },
                (err) => {
                    clearTimeout(timer);
                    logError({ requestId, phase: 'web-fallback-error', reason: err.message });
                    resolve(null);
                },
                { enableHighAccuracy: true, timeout, maximumAge: 5000 },
            );
        });
    }

    // =========================================================================
    // startWatch / stopWatch
    // =========================================================================

    async startWatch(options: {
        mode: 'browse' | 'running';
        interval?: number;
        distanceFilter?: number;
    }): Promise<void> {
        if (this.destroyed) return;

        // 幂等：如果已在相同模式 watch，不重复启动
        if (this.isWatching && this.watchMode === options.mode) {
            logInfo({ phase: 'startWatch-skip', reason: `Already watching in ${options.mode} mode` });
            return;
        }

        // 如果正在 watch，先 stop
        if (this.isWatching) {
            await this.stopWatch();
        }

        const interval = options.interval ?? (options.mode === 'browse' ? 5000 : 1000);
        const distanceFilter = options.distanceFilter ?? (options.mode === 'browse' ? 10 : 3);

        logInfo({
            phase: 'startWatch',
            reason: `mode=${options.mode} interval=${interval} distanceFilter=${distanceFilter}`,
        });

        try {
            if (this.isNative && this._AMapLocation) {
                await this._AMapLocation.startWatch({
                    mode: options.mode,
                    interval,
                    distanceFilter,
                });
            } else {
                this.startWebWatch(interval);
            }

            this.isWatching = true;
            this.watchMode = options.mode;
            this.lastAcceptedTime = Date.now();
            this.startStaleWatchdog();

            this.callbacks.onStatusChange('locating');
        } catch (e) {
            logError({ phase: 'startWatch-error', reason: String(e) });
        }
    }

    async stopWatch(): Promise<void> {
        logInfo({ phase: 'stopWatch', reason: 'Stopping watch and clearing watchdog' });

        this.stopStaleWatchdog();
        this.isWatching = false;
        this.watchMode = null;

        await this.safeStopWatch(makeRequestId());
    }

    // =========================================================================
    // safeStopWatch — stop 超时保护 + forceDestroy
    // =========================================================================

    private async safeStopWatch(requestId: string): Promise<void> {
        try {
            if (this.isNative && this._AMapLocation) {
                let stopped = false;

                const stopPromise = this._AMapLocation.stopWatch().then(() => {
                    stopped = true;
                    logInfo({ requestId, phase: 'stop_confirmed', timestamp: Date.now() });
                }).catch((err) => {
                    logError({ requestId, phase: 'stop_error', reason: String(err) });
                });

                // 等待停止确认或超时
                const timer = new Promise<void>((resolve) => setTimeout(resolve, STOP_TIMEOUT_MS));
                await Promise.race([stopPromise, timer]);

                if (!stopped) {
                    logWarn({ requestId, phase: 'stop_timeout', reason: `stopWatch not confirmed in ${STOP_TIMEOUT_MS}ms, forcing destroy` });

                    // 强制销毁
                    try {
                        await this._AMapLocation.forceDestroy();
                        // 最终清理：移除所有 native listener，防止 stale 回调
                        try {
                            await this._AMapLocation.removeAllListeners();
                        } catch {
                            // removeAllListeners 失败不阻断流程
                        }
                        logInfo({
                            requestId,
                            phase: 'force_destroy',
                            reason: 'forceDestroy + removeAllListeners cleanup completed',
                            timestamp: Date.now(),
                        });
                    } catch (e) {
                        logError({ requestId, phase: 'force_destroy_failed', reason: String(e) });
                    }
                }
            } else {
                this.stopWebWatch();
            }
        } catch (e) {
            logWarn({ requestId, phase: 'safeStopWatch-error', reason: String(e) });
        }
    }

    // ---- Web watch fallback ----
    private webWatchId: number | null = null;

    private startWebWatch(interval: number) {
        this.stopWebWatch();
        if (typeof navigator === 'undefined' || !navigator.geolocation) return;

        this.webWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                let lat = pos.coords.latitude;
                let lng = pos.coords.longitude;

                // WGS-84 → GCJ-02
                if (this._gcoord) {
                    const t = this._gcoord.transform([lng, lat], this._gcoord.WGS84, this._gcoord.GCJ02);
                    lng = t[0];
                    lat = t[1];
                }

                const point: GeoPoint = {
                    lat,
                    lng,
                    accuracy: pos.coords.accuracy,
                    heading: pos.coords.heading,
                    speed: pos.coords.speed,
                    timestamp: pos.timestamp,
                    source: 'network-coarse',
                    coordSystem: 'gcj02',
                };

                this.handleWatchUpdate(point);
            },
            (err) => {
                this.callbacks.onError({ code: 'UNAVAILABLE', message: err.message });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: interval },
        );
    }

    private stopWebWatch() {
        if (this.webWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.clearWatch(this.webWatchId);
            this.webWatchId = null;
        }
    }

    // =========================================================================
    // Native event handlers
    // =========================================================================

    private handleNativeUpdate(pos: AMapPosition) {
        if (this.destroyed) return;

        const source: LocationSource = SDK_CACHE_LOCATION_TYPES.includes(pos.locationType)
            ? 'amap-native-cache'
            : 'amap-native';

        const point = this.amapPositionToGeoPoint(pos, source);
        this.handleWatchUpdate(point, pos.locationType);
    }

    private handleNativeError(err: AMapLocationError) {
        if (this.destroyed) return;

        logError({
            phase: 'native-location-error',
            reason: `code=${err.code} message=${err.message}`,
        });

        this.callbacks.onError({
            code: String(err.code),
            message: err.message,
        });
    }

    // =========================================================================
    // Shared update processing (for both native watch and web watch)
    // =========================================================================

    private handleWatchUpdate(point: GeoPoint, locationType?: number) {
        // 精度门槛
        const accuracyThreshold = this.hasFreshFix
            ? DEFAULT_ACCURACY_THRESHOLD
            : COLD_START_ACCURACY_THRESHOLD;

        if (point.accuracy && point.accuracy > accuracyThreshold) {
            logWarn({
                phase: 'watch-accuracy-reject',
                accuracy: point.accuracy,
                locationType,
                reason: `Exceeds threshold ${accuracyThreshold}m`,
            });
            return;
        }

        // 去重：lat/lng/timestamp
        if (this.isDuplicate(point)) {
            return; // 静默跳过
        }

        // 距离滤波（最小更新距离）
        if (this.lastAcceptedPoint && this.isWatching) {
            const dist = haversineDistance(
                this.lastAcceptedPoint.lat,
                this.lastAcceptedPoint.lng,
                point.lat,
                point.lng,
            );
            const minDist = this.watchMode === 'running' ? 3 : 5;
            if (dist < minDist) {
                return; // 距离过近，静默跳过
            }
        }

        logInfo({
            phase: 'watch-update-accepted',
            source: point.source as LocationSource,
            locationType,
            timestamp: point.timestamp,
            accuracy: point.accuracy,
            lat: point.lat,
            lng: point.lng,
        });

        this.acceptPoint(point);
    }

    // =========================================================================
    // Point acceptance & dedup
    // =========================================================================

    private acceptPoint(point: GeoPoint, meta?: LocationMeta) {
        this.hasFreshFix = true;
        this.lastAcceptedTime = Date.now();
        this.lastAcceptedPoint = {
            lat: point.lat,
            lng: point.lng,
            timestamp: point.timestamp ?? Date.now(),
        };

        // 重置 stale watchdog
        this.resetStaleWatchdog();

        // 通知上层（附带可选 meta）
        this.callbacks.onLocationUpdate(point, meta);
        this.callbacks.onStatusChange('locked');
    }

    private isDuplicate(point: GeoPoint): boolean {
        if (!this.lastAcceptedPoint) return false;

        const timeDiff = Math.abs((point.timestamp ?? Date.now()) - this.lastAcceptedPoint.timestamp);
        if (timeDiff < DEDUP_MIN_TIME_DIFF_MS) {
            const dist = haversineDistance(
                this.lastAcceptedPoint.lat,
                this.lastAcceptedPoint.lng,
                point.lat,
                point.lng,
            );
            if (dist < DEDUP_MIN_DISTANCE_M) {
                return true;
            }
        }

        return false;
    }

    // =========================================================================
    // Stale Watchdog
    // =========================================================================

    private startStaleWatchdog() {
        this.stopStaleWatchdog();

        this.staleWatchdogTimer = setInterval(() => {
            if (this.destroyed || !this.isWatching) return;

            const elapsed = Date.now() - this.lastAcceptedTime;
            if (elapsed >= STALE_WATCHDOG_TIMEOUT_MS) {
                logWarn({
                    phase: 'stale-watchdog-triggered',
                    reason: `${elapsed}ms since last accepted update (threshold: ${STALE_WATCHDOG_TIMEOUT_MS}ms)`,
                });

                this.handleStaleWatchdog();
            }
        }, 5000); // 每 5s 检查一次
    }

    private stopStaleWatchdog() {
        if (this.staleWatchdogTimer !== null) {
            clearInterval(this.staleWatchdogTimer);
            this.staleWatchdogTimer = null;
        }
    }

    private resetStaleWatchdog() {
        // 直接更新 lastAcceptedTime 即可，watchdog 会自动检测
        this.lastAcceptedTime = Date.now();
    }

    private async handleStaleWatchdog() {
        if (this.fastFixInFlight) {
            logInfo({ phase: 'stale-watchdog-skip', reason: 'fastFix already in flight' });
            return;
        }

        // 如果已在临时模式恢复中，跳过
        if (this.tempModeRequest) {
            logInfo({ phase: 'stale-watchdog-skip', reason: `Recovery already in progress: ${this.tempModeRequest.id}` });
            return;
        }

        const wasRunning = this.watchMode === 'running';
        const requestId = makeRequestId();

        // 1. 先尝试 fastFix
        logInfo({ requestId, phase: 'stale-watchdog-fastfix', reason: 'Attempting fast fix before restart' });
        const result = await this.getCurrentPosition({ mode: 'fast', timeout: 6000, cacheMaxAge: 3000 });

        if (result) {
            logInfo({ requestId, phase: 'stale-watchdog-fastfix-success', lat: result.lat, lng: result.lng });
            // fastFix 成功，重启当前模式即可
            if (this.isWatching && this.watchMode) {
                const mode = this.watchMode;
                await this.stopWatch();
                await this.startWatch({ mode });
            }
            return;
        }

        logWarn({ requestId, phase: 'stale-watchdog-fastfix-failed', reason: 'No fix obtained' });

        // 2. 如果是 running 模式，启动 Hight_Accuracy 恢复窗口
        if (wasRunning) {
            const recoveryResult = await this.fastFixWithRecoveryWindow({
                initialWindowMs: TEMP_MODE_WINDOW_MS,
                retryIntervalMs: RECOVERY_RETRY_INTERVAL_MS,
                maxRetries: TEMP_MODE_MAX_RETRIES,
                validAccuracy: RECOVERY_ACCURACY_THRESHOLD,
            });

            if (!recoveryResult.success) {
                logError({
                    requestId,
                    phase: 'recovery_failed',
                    reason: recoveryResult.reason,
                    timestamp: Date.now(),
                });
                // 触发 remoteReporter 异常上报（通过 onError 通道）
                this.callbacks.onError({
                    code: 'RECOVERY_FAILED',
                    message: `Stale recovery failed: ${recoveryResult.reason}`,
                });
            }
        } else {
            // Browse 模式——直接重启
            if (this.isWatching && this.watchMode) {
                logInfo({ requestId, phase: 'stale-watchdog-restart-watch', reason: `Restarting watch in ${this.watchMode} mode` });
                const mode = this.watchMode;
                await this.stopWatch();
                await this.startWatch({ mode });
            }
        }
    }

    // =========================================================================
    // acceptInitialCacheIfValid — 首次缓存判定
    // =========================================================================

    /**
     * 判断 SDK 缓存是否可作为冷启动首次位置。
     *
     * 边界保护：
     *  1. locationType 不能是长期缓存类型（前次缓存=2, 最后已知=9）
     *  2. 设备时间与 point.timestamp 差异不超过 1h（防止时间回拨/漂移）
     *  3. 缓存年龄不超过 cacheMaxAgeMs
     *  4. 精度不超过 INITIAL_CACHE_ACCURACY_THRESHOLD
     *
     * @param point SDK 返回的 AMapPosition
     * @param cacheMaxAgeMs 缓存最大年龄（ms），默认 60s，便于后续远程配置
     */
    private acceptInitialCacheIfValid(
        point: AMapPosition,
        cacheMaxAgeMs: number = INITIAL_CACHE_MAX_AGE_MS,
    ): { acceptedAsInitial: boolean; reason: string } {
        // 1. locationType 检查：拒绝长期缓存类型
        if (LONG_TERM_CACHE_LOCATION_TYPES.includes(point.locationType)) {
            return {
                acceptedAsInitial: false,
                reason: `Rejected: locationType=${point.locationType} is long-term cache`,
            };
        }

        // 2. 设备时间漂移检查
        const timeDrift = Math.abs(Date.now() - point.timestamp);
        if (timeDrift > MAX_DEVICE_TIME_DRIFT_MS) {
            return {
                acceptedAsInitial: false,
                reason: `Rejected: device time drift ${timeDrift}ms > ${MAX_DEVICE_TIME_DRIFT_MS}ms (1h)`,
            };
        }

        // 3. 缓存年龄检查
        const cacheAge = Date.now() - point.timestamp;
        if (cacheAge > cacheMaxAgeMs) {
            return {
                acceptedAsInitial: false,
                reason: `Rejected: cache age ${cacheAge}ms > ${cacheMaxAgeMs}ms`,
            };
        }

        // 4. 精度检查
        if (point.accuracy > INITIAL_CACHE_ACCURACY_THRESHOLD) {
            return {
                acceptedAsInitial: false,
                reason: `Rejected: accuracy ${point.accuracy}m > ${INITIAL_CACHE_ACCURACY_THRESHOLD}m`,
            };
        }

        // 全部通过：接受
        this.initialCacheAccepted = true;
        this.postInitialCacheFailCount = 0;

        return {
            acceptedAsInitial: true,
            reason: `Accepted: locationType=${point.locationType} age=${cacheAge}ms accuracy=${point.accuracy}m`,
        };
    }

    // =========================================================================
    // Hight_Accuracy Recovery Window — fastFixWithRecoveryWindow
    // =========================================================================

    /**
     * fastFixWithRecoveryWindow — stale 后的 Hight_Accuracy 恢复策略
     *
     * 当 running-mode watch 变 stale 时调用：
     *  1. 生成 requestId 并设置 tempModeRequest
     *  2. 切换到 Hight_Accuracy（browse mode）
     *  3. 循环：每 retryIntervalMs 调用 getCurrentPosition({mode:'fast'})
     *     - 收到有效恢复点 → 切回 Device_Sensors 并 resolve success
     *     - 窗口到期 → 累加 retries；重试耗尽 → 强制回切并 resolve failure
     *  4. 每步验证 requestId，旧请求静默丢弃
     *
     * @param opts { initialWindowMs?, retryIntervalMs?, maxRetries?, validAccuracy? }
     */
    async fastFixWithRecoveryWindow(opts?: {
        initialWindowMs?: number;
        retryIntervalMs?: number;
        maxRetries?: number;
        validAccuracy?: number;
    }): Promise<{ success: boolean; reason: string; point?: GeoPoint }> {
        const initialWindowMs = opts?.initialWindowMs ?? TEMP_MODE_WINDOW_MS;
        const retryIntervalMs = opts?.retryIntervalMs ?? RECOVERY_RETRY_INTERVAL_MS;
        const maxRetries = opts?.maxRetries ?? TEMP_MODE_MAX_RETRIES;
        const validAccuracy = opts?.validAccuracy ?? RECOVERY_ACCURACY_THRESHOLD;

        const reqId = makeRequestId();
        this.tempModeRequest = {
            id: reqId,
            startedAt: Date.now(),
            retries: 0,
            originalMode: (this.watchMode as 'running' | 'browse') ?? 'running',
        };

        logInfo({
            requestId: reqId,
            phase: 'recovery_begin',
            reason: 'Switching from Device_Sensors to Hight_Accuracy for network-assisted recovery',
            timestamp: Date.now(),
        });

        try {
            // Step 1: 切到 Hight_Accuracy（browse 模式实现）
            await this.switchWatchMode('browse', { interval: 2000, distanceFilter: 3 });

            logInfo({ requestId: reqId, phase: 'recovery_switched_to_high', timestamp: Date.now() });

            let windowStart = Date.now();

            // Step 2: 恢复重试循环
            while (this.tempModeRequest && this.tempModeRequest.id === reqId && !this.destroyed) {
                // 2a. 发起 fastFix
                let point: GeoPoint | null = null;
                try {
                    point = await this.getCurrentPosition({ mode: 'fast', timeout: 5000, cacheMaxAge: 2000 });
                } catch (e) {
                    logError({ requestId: reqId, phase: 'recovery_fastfix_error', reason: String(e) });
                }

                // 2b. 验证 requestId 未被 superseded
                if (!this.tempModeRequest || this.tempModeRequest.id !== reqId) {
                    logWarn({ requestId: reqId, phase: 'recovery_superseded', timestamp: Date.now() });
                    return { success: false, reason: 'superseded' };
                }

                // 2c. 有效恢复点检查 → 立即回切 Device_Sensors
                if (point && (point.accuracy ?? Infinity) <= validAccuracy) {
                    logInfo({
                        requestId: reqId,
                        phase: 'recovery_point_accepted',
                        accuracy: point.accuracy,
                        lat: point.lat,
                        lng: point.lng,
                        timestamp: Date.now(),
                        reason: `Valid recovery point (accuracy ${point.accuracy}m ≤ ${validAccuracy}m)`,
                    });

                    // 写入 store 作为恢复点
                    this.acceptPoint(point, { source: 'amap-native', reason: 'recovery' });
                    this.tempModeRequest = null;

                    await this.switchWatchMode('running', { interval: 1000, distanceFilter: 3 });

                    logInfo({ requestId: reqId, phase: 'recovery_success', timestamp: Date.now() });
                    return { success: true, reason: 'recovered', point };
                }

                // 2d. 检查窗口到期和重试逻辑
                const elapsedSinceWindowStart = Date.now() - windowStart;
                if (elapsedSinceWindowStart >= initialWindowMs) {
                    this.tempModeRequest.retries += 1;

                    logInfo({
                        requestId: reqId,
                        phase: 'recovery_window_expired',
                        retries: this.tempModeRequest.retries,
                        timestamp: Date.now(),
                    });

                    if (this.tempModeRequest.retries > maxRetries) {
                        // 重试耗尽：回切并标记失败
                        logWarn({
                            requestId: reqId,
                            phase: 'recovery_failed',
                            retries: this.tempModeRequest.retries,
                            reason: `Max retries (${maxRetries}) exhausted, forcing restore to Device_Sensors`,
                            timestamp: Date.now(),
                        });

                        this.tempModeRequest = null;
                        await this.switchWatchMode('running', { interval: 1000, distanceFilter: 3 });
                        return { success: false, reason: 'retries_exhausted' };
                    } else {
                        // 延长窗口并继续重试
                        windowStart = Date.now();
                        logInfo({
                            requestId: reqId,
                            phase: 'recovery_extend',
                            retries: this.tempModeRequest.retries,
                            reason: `Window expired, extending (retry ${this.tempModeRequest.retries}/${maxRetries})`,
                            timestamp: Date.now(),
                        });
                    }
                }

                // 2e. 等待间隔再重试
                await this.sleep(retryIntervalMs);
            }

            // 循环退出：被 superseded 或清除
            logInfo({ requestId: reqId, phase: 'recovery_ended', reason: 'cleared_or_superseded', timestamp: Date.now() });
            return { success: false, reason: 'cleared_or_superseded' };
        } catch (err) {
            logError({ requestId: reqId, phase: 'recovery_exception', reason: String(err), timestamp: Date.now() });

            // 确保回切尝试
            try {
                await this.switchWatchMode('running', { interval: 1000, distanceFilter: 3 });
            } catch (e) {
                logError({ requestId: reqId, phase: 'recovery_rollback_failed', reason: String(e) });
            }

            this.tempModeRequest = null;
            return { success: false, reason: 'exception' };
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // =========================================================================
    // forceFastFix（供 app resume 等场景调用）
    // =========================================================================

    async forceFastFix(): Promise<GeoPoint | null> {
        logInfo({ phase: 'forceFastFix', reason: 'Triggered by app resume or manual retry' });
        return this.getCurrentPosition({ mode: 'fast', timeout: 6000, cacheMaxAge: 3000 });
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private amapPositionToGeoPoint(pos: AMapPosition, source: LocationSource): GeoPoint {
        return {
            lat: pos.lat,
            lng: pos.lng,
            accuracy: pos.accuracy,
            heading: pos.bearing >= 0 ? pos.bearing : null,
            speed: pos.speed >= 0 ? pos.speed : null,
            timestamp: pos.timestamp,
            source,
            coordSystem: 'gcj02', // AMap 原生固定 GCJ-02，禁止再转换
        };
    }

    /** 当前是否使用原生插件 */
    get isNativeMode(): boolean {
        return this.isNative;
    }

    /** 当前是否正在 watch */
    get watching(): boolean {
        return this.isWatching;
    }

    /** 当前 watch 模式 */
    get currentWatchMode(): 'browse' | 'running' | null {
        return this.watchMode;
    }

    // =========================================================================
    // switchWatchMode（跑步页升级/降级 watch 模式）
    // =========================================================================

    /**
     * 安全切换 watch 模式。原子性保证：
     *  - 使用 switchRequestId 确保只有最新请求的回调有效
     *  - 先 stopWatch 再 startWatch，避免旧回调覆盖新数据
     *  - 全程结构化日志（旧模式、新模式、requestId、时间戳）
     */
    async switchWatchMode(
        mode: 'browse' | 'running',
        options?: { interval?: number; distanceFilter?: number },
    ): Promise<void> {
        if (this.destroyed) return;

        const requestId = makeRequestId();
        const oldMode = this.watchMode;

        if (oldMode === mode) {
            logInfo({
                requestId,
                phase: 'switchWatchMode-skip',
                reason: `Already in ${mode} mode`,
                timestamp: Date.now(),
            });
            return;
        }

        // 标记本次切换为最新
        this.switchRequestId = requestId;

        logInfo({
            requestId,
            phase: 'switchWatchMode-begin',
            reason: `${oldMode ?? 'none'} → ${mode}`,
            timestamp: Date.now(),
        });

        // Step 1: stop 旧 watch (with timeout protection)
        await this.safeStopWatch(requestId);

        // Step 2: 验证本次切换仍为最新（防止并发切换覆盖）
        if (this.switchRequestId !== requestId) {
            logWarn({
                requestId,
                phase: 'switchWatchMode-superseded',
                reason: `Newer switch ${this.switchRequestId} superseded this request`,
                timestamp: Date.now(),
            });
            return;
        }

        // Step 3: start 新 watch
        await this.startWatch({
            mode,
            interval: options?.interval ?? (mode === 'running' ? 1000 : 5000),
            distanceFilter: options?.distanceFilter ?? (mode === 'running' ? 3 : 10),
        });

        logInfo({
            requestId,
            phase: 'switchWatchMode-complete',
            reason: `${oldMode ?? 'none'} → ${mode} done`,
            timestamp: Date.now(),
        });
    }

    // =========================================================================
    // Destroy
    // =========================================================================

    async destroy(): Promise<void> {
        if (this.destroyed) return;
        this.destroyed = true;

        logInfo({ phase: 'destroy', reason: 'Cleaning up AMapLocationBridge' });

        // 1. stop watch
        await this.stopWatch();

        // 2. remove event listeners
        try {
            if (this.locationUpdateHandle) {
                await this.locationUpdateHandle.remove();
                this.locationUpdateHandle = null;
            }
            if (this.locationErrorHandle) {
                await this.locationErrorHandle.remove();
                this.locationErrorHandle = null;
            }
            if (this.isNative && this._AMapLocation) {
                await this._AMapLocation.removeAllListeners();
            }
        } catch (e) {
            logWarn({ phase: 'destroy-listener-cleanup', reason: String(e) });
        }

        // 3. stop web watch fallback
        this.stopWebWatch();

        // 4. clear timers
        this.stopStaleWatchdog();

        logInfo({ phase: 'destroy-complete', reason: 'All resources released' });
    }
}
