/**
 * RunningLocationFilter — 跑步轨迹点过滤器
 *
 * 职责：
 *  - 精度门槛：冷启动首次 fix ≤200m（宽松），lock 后 ≤100m（收紧）
 *  - 距离滤波：最小更新距离（minUpdateDistanceM）
 *  - 速度异常检测：超过最大跑步速度则丢弃（防 GPS 跳点）
 *  - 加速度异常检测：瞬间速度变化超阈值则丢弃
 *  - 结构化日志：每个点含 lat/lng/accuracy/speed/timestamp/reason
 *
 * 所有坐标假定为 GCJ-02，直接用于轨迹 store。
 */

import type { GeoPoint } from '@/hooks/useSafeGeolocation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAG = '[RunningFilter]';

/** 跑步精度门槛（米）— 首次 fix 后收紧 */
const RUNNING_ACCURACY_THRESHOLD = 100;
/** 冷启动精度门槛（更宽松，允许首次 fix 快速写入） */
const COLD_START_ACCURACY_THRESHOLD = 200;
/** 最小更新距离（米） */
const MIN_UPDATE_DISTANCE_M = 2;
/** 最大合理跑步速度（m/s）— 约 45km/h，防交通工具 */
const MAX_RUNNING_SPEED_MS = 12.5;
/** 最大合理加速度（m/s²）— 人类极限约 5m/s²，留余量 */
const MAX_ACCELERATION_MS2 = 8.0;
/** 静止抖动半径（米）— 低于此距离视为 GPS 抖动 */
const JITTER_RADIUS_M = 1.5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilteredPoint extends GeoPoint {
    /** 是否通过过滤 */
    accepted: boolean;
    /** 拒绝原因（仅 accepted=false 时有值） */
    rejectReason?: string;
    /** 与上一个接受点的距离（米） */
    distanceFromLast?: number;
    /** 瞬时速度（m/s），基于两点距离/时间差计算 */
    calculatedSpeed?: number;
}

export interface FilterState {
    /** 已有初始 GPS fix */
    hasFreshFix: boolean;
    /** 上一个被接受的点 */
    lastAcceptedPoint: GeoPoint | null;
    /** 上一个被接受点的时间戳 */
    lastAcceptedTime: number;
    /** 上一个计算速度 */
    lastSpeed: number;
    /** 累计接受点数 */
    acceptedCount: number;
    /** 累计拒绝点数 */
    rejectedCount: number;
}

// ---------------------------------------------------------------------------
// Structured Log Types
// ---------------------------------------------------------------------------

export interface FilterLog {
    tag: typeof TAG;
    event: 'point_accepted' | 'point_rejected' | 'weak_point' | 'filter_reset';
    lat?: number;
    lng?: number;
    accuracy?: number;
    speed?: number;
    calculatedSpeed?: number;
    timestamp?: number;
    reason?: string;
    distanceFromLast?: number;
    acceptedCount?: number;
    rejectedCount?: number;
}

/**
 * 可选远程日志上报回调。
 * 设置后每条结构化日志都会调用此函数，可用于远程日志系统对接。
 */
export type RemoteLogReporter = (log: FilterLog) => void;

interface ReporterOptions {
    sampleRate?: number;
    batchSize?: number;
    fuzzPrecision?: number;
}

class RemoteReportQueue {
    enabled = false;
    private reporter: RemoteLogReporter | null = null;
    private options: Required<ReporterOptions> = {
        sampleRate: 0.01,
        batchSize: 20,
        fuzzPrecision: 3,
    };

    private queue: FilterLog[] = [];
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private flushPromise: Promise<void> | null = null;

    setReporter(reporter: RemoteLogReporter | null, opts?: ReporterOptions) {
        this.reporter = reporter;
        this.enabled = !!reporter;
        if (opts) {
            this.options = { ...this.options, ...opts };
        }
        if (!this.enabled) {
            this.clearTimer();
            this.queue = [];
        }
    }

    push(log: FilterLog) {
        if (!this.enabled) return;

        // Sampling
        const isAnomaly = log.event !== 'point_accepted';
        if (!isAnomaly && Math.random() > this.options.sampleRate) {
            return;
        }

        // Fuzz coordinates
        const fuzzedLog = { ...log };
        if (fuzzedLog.lat != null) fuzzedLog.lat = Number(fuzzedLog.lat.toFixed(this.options.fuzzPrecision));
        if (fuzzedLog.lng != null) fuzzedLog.lng = Number(fuzzedLog.lng.toFixed(this.options.fuzzPrecision));

        this.queue.push(fuzzedLog);

        // Queue length cap
        if (this.queue.length > 200) {
            this.queue.shift(); // Drop oldest
            console.warn(`${TAG} Remote queue overflow, dropping oldest log`);
        }

        if (this.queue.length >= this.options.batchSize || isAnomaly) {
            this.triggerFlush();
        } else {
            this.scheduleFlush();
        }
    }

    private scheduleFlush() {
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.triggerFlush(), 5000);
        }
    }

    private clearTimer() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
    }

    private async triggerFlush() {
        this.clearTimer();
        if (this.queue.length === 0 || !this.reporter || this.flushPromise) return;

        const batch = [...this.queue];
        this.queue = [];

        this.flushPromise = this.flushWithRetry(batch, 1, 3);
        await this.flushPromise;
        this.flushPromise = null;

        // Check if more items accumulated during flush
        if (this.queue.length > 0) {
            this.scheduleFlush();
        }
    }

    private async flushWithRetry(batch: FilterLog[], attempt: number, maxRetries: number): Promise<void> {
        if (!this.reporter) return;

        try {
            // For interface compatibility, we send logs individually to the reporter callback
            // In a real batch API, the reporter signature would accept FilterLog[]
            for (const log of batch) {
                await Promise.resolve(this.reporter(log));
            }
        } catch (err) {
            console.error(`${TAG} flush attempt ${attempt} failed:`, err);
            if (attempt <= maxRetries) {
                const backoffMs = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                return this.flushWithRetry(batch, attempt + 1, maxRetries);
            } else {
                console.error(`${TAG} batch dropped after ${maxRetries} retries`);
            }
        }
    }
}

const reportQueue = new RemoteReportQueue();

/** 设置远程日志上报器（全局单例） */
export function setFilterRemoteReporter(reporter: RemoteLogReporter | null, opts?: ReporterOptions): void {
    reportQueue.setReporter(reporter, opts);
}

function emitLog(log: FilterLog): void {
    if (log.event === 'point_rejected' || log.event === 'weak_point') {
        console.debug(`${TAG} ${JSON.stringify(log)}`);
    } else {
        console.log(`${TAG} ${JSON.stringify(log)}`);
    }
    reportQueue.push(log);
}

// ---------------------------------------------------------------------------
// Haversine
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// RunningLocationFilter
// ---------------------------------------------------------------------------

export class RunningLocationFilter {
    private state: FilterState = {
        hasFreshFix: false,
        lastAcceptedPoint: null,
        lastAcceptedTime: 0,
        lastSpeed: 0,
        acceptedCount: 0,
        rejectedCount: 0,
    };

    /**
     * 过滤一个定位点。返回 FilteredPoint，包含 accepted 标志和拒绝原因。
     * 仅 accepted=true 的点应写入轨迹 store。
     */
    filter(point: GeoPoint): FilteredPoint {
        const now = point.timestamp ?? Date.now();

        // --- 1. 精度门槛 ---
        // 冷启动首次 fix：≤200m（宽松，避免全部丢弃）
        // 首次 fix 后：≤100m（收紧，保证轨迹质量）
        const accuracyThreshold = this.state.hasFreshFix
            ? RUNNING_ACCURACY_THRESHOLD
            : COLD_START_ACCURACY_THRESHOLD;

        if (point.accuracy != null && point.accuracy > accuracyThreshold) {
            return this.reject(point, 'accuracy', `accuracy ${point.accuracy}m > ${accuracyThreshold}m threshold`);
        }

        // 首次有效点
        if (!this.state.lastAcceptedPoint) {
            return this.accept(point, now);
        }

        const lastPt = this.state.lastAcceptedPoint;
        const dist = haversineDistance(lastPt.lat, lastPt.lng, point.lat, point.lng);
        const timeDiffMs = now - this.state.lastAcceptedTime;
        const timeDiffS = timeDiffMs / 1000;

        // --- 2. 距离滤波 ---
        if (dist < MIN_UPDATE_DISTANCE_M) {
            if (dist < JITTER_RADIUS_M) {
                return this.reject(point, 'jitter', `jitter: ${dist.toFixed(1)}m < ${JITTER_RADIUS_M}m`);
            }
            return this.reject(point, 'distance', `distance ${dist.toFixed(1)}m < ${MIN_UPDATE_DISTANCE_M}m min`);
        }

        // --- 3. 速度异常检测 ---
        if (timeDiffS > 0.5) {
            const speed = dist / timeDiffS;

            if (speed > MAX_RUNNING_SPEED_MS) {
                return this.reject(point, 'speed',
                    `speed ${(speed * 3.6).toFixed(1)}km/h > ${(MAX_RUNNING_SPEED_MS * 3.6).toFixed(1)}km/h max`);
            }

            // --- 4. 加速度异常检测 ---
            if (this.state.lastSpeed > 0 && timeDiffS > 0.5) {
                const acceleration = Math.abs(speed - this.state.lastSpeed) / timeDiffS;
                if (acceleration > MAX_ACCELERATION_MS2) {
                    return this.reject(point, 'acceleration',
                        `acceleration ${acceleration.toFixed(1)}m/s² > ${MAX_ACCELERATION_MS2}m/s² max ` +
                        `(speed jump: ${(this.state.lastSpeed * 3.6).toFixed(1)} → ${(speed * 3.6).toFixed(1)} km/h)`);
                }
            }

            this.state.lastSpeed = speed;
            return this.accept(point, now, dist, speed);
        }

        return this.reject(point, 'time', `time diff too short: ${timeDiffMs}ms`);
    }

    /** 重置过滤器状态（跑步开始时调用） */
    reset(): void {
        this.state = {
            hasFreshFix: false,
            lastAcceptedPoint: null,
            lastAcceptedTime: 0,
            lastSpeed: 0,
            acceptedCount: 0,
            rejectedCount: 0,
        };
        emitLog({ tag: TAG, event: 'filter_reset', reason: 'Running session start' });
    }

    /** 获取当前过滤器状态（调试用） */
    getState(): Readonly<FilterState> {
        return { ...this.state };
    }

    // --- Internal ---

    private accept(point: GeoPoint, timestamp: number, dist?: number, speed?: number): FilteredPoint {
        this.state.hasFreshFix = true;
        this.state.lastAcceptedPoint = point;
        this.state.lastAcceptedTime = timestamp;
        this.state.acceptedCount++;

        emitLog({
            tag: TAG,
            event: 'point_accepted',
            lat: point.lat,
            lng: point.lng,
            accuracy: point.accuracy,
            speed: point.speed ?? undefined,
            calculatedSpeed: speed,
            timestamp,
            distanceFromLast: dist,
            reason: this.state.acceptedCount === 1 ? 'first_fix' : 'passed_all_filters',
            acceptedCount: this.state.acceptedCount,
        });

        return {
            ...point,
            accepted: true,
            distanceFromLast: dist,
            calculatedSpeed: speed,
        };
    }

    private reject(
        point: GeoPoint,
        weakType: 'accuracy' | 'distance' | 'jitter' | 'speed' | 'acceleration' | 'time',
        reason: string,
    ): FilteredPoint {
        this.state.rejectedCount++;

        emitLog({
            tag: TAG,
            event: 'weak_point',
            lat: point.lat,
            lng: point.lng,
            accuracy: point.accuracy,
            speed: point.speed ?? undefined,
            timestamp: point.timestamp,
            reason: `[${weakType}] ${reason}`,
            rejectedCount: this.state.rejectedCount,
        });

        return {
            ...point,
            accepted: false,
            rejectReason: reason,
        };
    }
}
