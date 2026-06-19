import { useState, useEffect, useRef, useCallback } from 'react';
import { mutate } from 'swr';
import { LocationService } from '@/utils/locationService';
import * as turf from '@turf/turf';
import { KalmanFilter1D } from '@/lib/kalman-filter';
import { simplifyPath } from '@/lib/geo/simplify-path';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { toast } from 'sonner';
import { syncManager } from '@/lib/sync/SyncManager';
import { v4 as uuidv4 } from 'uuid';
import { isNativePlatform, safeGetBatteryInfo } from '@/lib/capacitor/safe-plugins';
import type { GeoPoint } from '@/hooks/useSafeGeolocation';
import { useLocationStore, GPS_START_ANCHOR_ACCURACY_METERS, GPS_TRACKING_ACCURACY_METERS, GPS_DISPLAY_ACCURACY_METERS,  } from '@/store/useLocationStore';
import { getDistanceFromLatLonInMeters, LOOP_CLOSURE_THRESHOLD_M, LOOP_CLOSURE_SNAP_M, isLoopClosed, MIN_LOOP_POINTS, extractValidLoops, isDuplicatePolygon, simplifyPathDP, simplifyPathDPAsync } from '@/lib/geometry-utils';
import { shouldAcceptPointByDistance } from '@/lib/location/gps-spatial-filter';
import { validateSegmentSpeed } from '@/lib/location/gps-speed-validator';
import { type ActiveRandomEvent, useRandomEvents } from '@/hooks/useRandomEvents';
import { type RunEventLog } from '@/types/run-sync';
import type { CapacitorPedometerPlugin } from '@capgo/capacitor-pedometer';
import { useGameStore } from '@/store/useGameStore';
import { Preferences } from '@capacitor/preferences';
import { settlementRetryQueue } from '@/lib/sync/SettlementRetryQueue';

// ============================================================================
// ⚠️ TODO: useRunningTracker 巨型 Hook 拆分规划 (当前 ~1500 行)
//
// 当前 Hook 承担了过多职责，建议在下一迭代拆分为三层独立 Hook：
//
// 1. useRunClock (纯计时 + 暂停/恢复)
//    - rawDuration / durationSeconds 计时
//    - isPaused / togglePause / pause timer on app background
//    - 无 GPS 依赖，可独立单元测试
//
// 2. useRunPersistence (离线快照 + 恢复 + 本地存储)
//    - CURRENT_RUN_RECOVERY localStorage 读写
//    - appStateChange / visibilitychange 快照
//    - 崩溃恢复 / 断点续跑
//
// 3. useRunSyncPipeline (轨迹同步 + 上传 + 结算)
//    - syncManager enqueue / batch upload
//    - settlementRetryQueue 轮询
//    - saveRunActivity Server Action 调用
//
// 拆分后 useRunningTracker 仅作为协调层 (orchestrator)，将上述三个 Hook
// 组合为统一的 RunningStats 接口，预计可降至 300 行以内。
// ============================================================================

const RECOVERY_KEY = 'CURRENT_RUN_RECOVERY';

const MIN_WARMUP_POINTS = process.env.NODE_ENV === 'development' ? 1 : 1;
const WARMUP_TIMEOUT_MS = process.env.NODE_ENV === 'development' ? 2000 : 3000;
const CLOCK_DRIFT_TOLERANCE_MS = 5000;

/** 全生命周期预热：黄金起点首次移动防抖阈值（米）— 固定 3 米 */
const PREWARM_FIRST_MOVE_DEBOUNCE_M = 3;

export interface Location {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

interface RunningStats {
  // Formatted display values (legacy)
  distance: number; // km (legacy, use distanceMeters for calculations)
  pace: string; // "mm:ss"
  duration: string; // "HH:MM:SS"
  calories: number;
  path: Location[];
  displayPath: Location[];
  currentLocation: { lat: number; lng: number } | null;
  isPaused: boolean;
  togglePause: () => void;
  stop: () => void;
  finalize: () => void;
  clearRecovery: () => void;
  rawDuration: number; // seconds
  area: number; // m²
  closedPolygons: Location[][];
  sessionClaims: Location[][]; // Claimed polygons during this run session
  addManualLocation: (lat: number, lng: number) => void;
  /** 全生命周期预热：接收黄金起点，立即熔断 warmup 状态 */
  setAnchorPoint: (anchor: GeoPoint) => void;
  isSyncing: boolean;
  saveRun: (isFinal?: boolean) => Promise<{
    settlingAsync?: boolean;
    isDuplicate?: boolean;
    runId?: string;
    runNumber?: number;
    damageSummary?: any[];
    maintenanceSummary?: any[];
    settledTerritoriesCount?: number;
    territories?: { id: string }[];
  } | void>;
  // Raw data for UI calculations (preferred)
  distanceMeters: number; // meters — use this for display/calculations
  durationSeconds: number; // seconds — use this for speed/pace calculations
  steps: number;
  savedRunId: string | null; // Run ID for photo upload and sharing
  runNumber?: number; // Phase 3: Total runs for user
  damageSummary?: any[]; // Phase 3: Damage details
  maintenanceSummary?: any[]; // Phase 4: Maintenance details
  settledTerritoriesCount?: number;
  runIsValid?: boolean;
  antiCheatLog?: string | null;
  idempotencyKey: string;
  eventsHistory: RunEventLog[];
  clientFlags: string[];
  settlementStatus: 'idle' | 'pending' | 'completed' | 'flagged' | 'timeout';
  activeRandomEvent: ActiveRandomEvent | null;
  randomEventCountdownSeconds: number;
  isGPSWeak: boolean;
  lastAnnouncedKm: number;
  recoverUnfinishedSession: () => Promise<any>;
}

// Haversine formula — now imported from @/lib/geometry-utils
// (getDistanceFromLatLonInMeters is imported above)

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatPace(seconds: number, distanceKm: number): string {
  if (distanceKm < 0.01) return "--'--\"";
  if (seconds <= 0) return "00:00";
  const paceSeconds = seconds / distanceKm;
  const m = Math.floor(paceSeconds / 60);
  const s = Math.floor(paceSeconds % 60);
  if (m > 59) return "59:59";
  return `${m.toString().padStart(2, '0')}'${s.toString().padStart(2, '0')}"`;
}

function estimateStepsFromDistanceMeters(distanceMeters: number): number {
  return Math.max(0, Math.floor(distanceMeters * 1.3));
}

/**
 * useRunningTracker: Running game state management
 * 
 * ===================================================================
 * DATA CONSISTENCY GUARANTEE (CRITICAL)
 * ===================================================================
 * 
 * This hook consumes GPS data from THE SAME SOURCE as TrajectoryLayer:
 * 
 * Flow Diagram:
 * 
 *   useSafeGeolocation (50m filter, Null Island check)
 *          |
 *          | location: GeoPoint
 *          |
 *          +----> MapRoot.userPath[] (for TrajectoryLayer polyline)
 *          |
 *          +----> useRunningTracker (THIS HOOK - for polygon detection)
 * 
 * Both consumers receive:
 * - Same filtered coordinates (>50m accuracy rejected)
 * - Same Null Island prevention
 * - Same China bounds validation
 * - Same WGS84->GCJ02 transformation
 * 
 * GUARANTEE: What you see (polyline) === What you claim (polygon)
 * 
 * ===================================================================
 * 
 * Responsibilities:
 * - Distance & duration tracking
 * - Polygon detection & area calculation (turf.js)
 * - Trajectory batch uploading (offline-first)
 * - Recovery from crashes
 * 
 * GPS Logic: Delegated to useSafeGeolocation (SINGLE SOURCE)
 */
export function useRunningTracker(isRunning: boolean, userId?: string): RunningStats {
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0); // seconds
  const [distance, setDistance] = useState(0); // meters
  const [path, setPath] = useState<Location[]>([]);
  const [fullPath, setFullPath] = useState<Location[]>([]);
  const [displayPath, setDisplayPath] = useState<Location[]>([]);
  const [closedPolygons, setClosedPolygons] = useState<Location[][]>([]);
  const [sessionClaims, setSessionClaims] = useState<Location[][]>([]); // NEW: Claimed territories
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [area, setArea] = useState(0); // m²
  const [isWarmingUp, setIsWarmingUp] = useState(true);
  const [isGPSWeak, setIsGPSWeak] = useState(false);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const clubId = useGameStore((s) => s.clubId);

  const isStoppingRef = useRef(false);
  const isRunningRef = useRef(isRunning);
  const gpsWeakTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<Location | null>(null);
  const pathRef = useRef<Location[]>([]);
  const fullPathRef = useRef<Location[]>([]);
  const isPausedRef = useRef(isPaused);
  const wasPausedRef = useRef(false);
  const lastClaimAtRef = useRef(0);
  const claimedSegmentsRef = useRef<Array<{ start: number; end: number }>>([]);
  /** 阈值锁：记录上次弹窗时的 newTotalArea（m²），防止 GPS 边界漂移频繁骚视 */
  const lastToastAreaRef = useRef(0);
  const validPointsCountRef = useRef(0);
  const firstPointAtRef = useRef<number | null>(null);
  /** 防重入锁：防止多次 appStateChange 触发重复分帧注入 */
  const isHydratingRef = useRef(false);
  /** 缓冲队列：追帧期间拦截的实时 GPS 点，追帧完成后统一消费 */
  const pendingLivePointsRef = useRef<Location[]>([]);
  /** 全局时间戳去重滑动窗口队列 */
  const recentTimestampsRef = useRef<number[]>([]);
  const stepWindowRef = useRef<{ ts: number; steps: number }[]>([]);
  const lastStepCountRef = useRef<number>(0);

  // ─── Live-snapshot refs (always current, immune to stale closures) ───
  const distanceRef = useRef(distance);
  const durationRef = useRef(duration);
  const sessionClaimsRef = useRef(sessionClaims);
  const closedPolygonsRef = useRef(closedPolygons);
  const areaRef = useRef(area);
  const isWarmingUpRef = useRef(true);
  /** 全生命周期预热：是否已接收黄金起点 */
  const hasPrewarmAnchorRef = useRef(false);
  const realtimeLoopCheckCounterRef = useRef(0);
  const claimedLoopKeysRef = useRef<Set<string>>(new Set());

  // ─── Kalman Filters (replace legacy EMA smoothing) ───
  const kalmanLatRef = useRef(new KalmanFilter1D(3.0, 25.0));
  const kalmanLngRef = useRef(new KalmanFilter1D(3.0, 25.0));
  const refLocationRef = useRef<Location | null>(null);
  const lastSpeedRef = useRef<number | null>(null);

  // ─── Timestamp-based timer refs ───
  const startTimeRef = useRef<number | null>(null);
  const pausedAccumulatorRef = useRef(0); // Accumulated seconds before latest pause

  // Sync refs — keep refs in lockstep with React state
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { distanceRef.current = distance; }, [distance]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { sessionClaimsRef.current = sessionClaims; }, [sessionClaims]);
  useEffect(() => { closedPolygonsRef.current = closedPolygons; }, [closedPolygons]);
  useEffect(() => { areaRef.current = area; }, [area]);

  // Keep lastAnnouncedKmRef updated with distance in the foreground
  useEffect(() => {
    if (isRunning && !isPaused) {
      const currentKm = Math.floor(distance / 1000);
      if (currentKm > lastAnnouncedKmRef.current) {
        lastAnnouncedKmRef.current = currentKm;
      }
    }
  }, [distance, isRunning, isPaused]);

  // Idempotency key for the current run
  const runIdempotencyKeyRef = useRef<string>(uuidv4());
  const lastAnnouncedKmRef = useRef<number>(0);
  const justRecoveredRef = useRef<boolean>(false);

  // --- Persistence & Sync State (Moved up to avoid TDZ) ---
  const [isSaving, setIsSaving] = useState(false);
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const savedRunIdRef = useRef<string | null>(null);
  const [runNumber, setRunNumber] = useState<number | undefined>(undefined);
  const [damageSummary, setDamageSummary] = useState<any[] | undefined>(undefined);
  const [maintenanceSummary, setMaintenanceSummary] = useState<any[] | undefined>(undefined);
  const [settledTerritoriesCount, setSettledTerritoriesCount] = useState<number | undefined>(undefined);
  const [runIsValid, setRunIsValid] = useState<boolean | undefined>(undefined);
  const [antiCheatLog, setAntiCheatLog] = useState<string | null | undefined>(undefined);
  const [clientFlags, setClientFlags] = useState<string[]>([]);
  const clientFlagsRef = useRef<string[]>([]);
  const [settlementStatus, setSettlementStatus] = useState<'idle' | 'pending' | 'completed' | 'flagged' | 'timeout'>('idle');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentSteps, setCurrentSteps] = useState(0);
  const [lastSavedClaimsCount, setLastSavedClaimsCount] = useState(0);
  const [eventsHistory, setEventsHistory] = useState<RunEventLog[]>([]);
  const currentStepsRef = useRef(0);
  const pedometerBaselineRef = useRef<number | null>(null);
  const eventsHistoryRef = useRef<RunEventLog[]>([]);
  useEffect(() => { currentStepsRef.current = currentSteps; }, [currentSteps]);
  useEffect(() => {
    eventsHistoryRef.current = eventsHistory;
  }, [eventsHistory]);
  useEffect(() => { clientFlagsRef.current = clientFlags; }, [clientFlags]);

  const { activeEvent, countdownSeconds } = useRandomEvents({
    isRunning,
    isPaused,
    durationSeconds: duration,
    distanceMeters: distance,
    onEventResolved: (eventLog) => {
      setEventsHistory(prev => [...prev, eventLog]);
    }
  });

  // ======== CRITICAL: Use centralized global location store ========
  // REMOVED: Direct useSafeGeolocation call — now consumed from useLocationStore
  // which is written to by the GlobalLocationProvider singleton.
  // BUT: We start LocationService purely for the Foreground Service Notification (Keep-Alive)
  const watcherIdRef = useRef<string | null>(null);

  // Read GPS location from global singleton store
  const gpsLocation = useLocationStore(s => s.location);
  const locationSource = useLocationStore(s => s.locationSource);

  // Network Listener & Initial Flush
  useEffect(() => {
    // Proactively flush pending settlements on startup/mount if currently online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      settlementRetryQueue.flushPendingSettlements().catch(console.error);
    }

    const handleOnline = () => {
      setIsOnline(true);
      settlementRetryQueue.flushPendingSettlements().catch(console.error);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Server Sync Loop (Offline-First)
  useEffect(() => {
    if (!isRunning || isStoppingRef.current) return;

    let syncInterval: NodeJS.Timeout;

    const performSync = async () => {
      if (!navigator.onLine || isSyncing) return;

      // Battery optimization check
      if (await isNativePlatform()) {
        try {
          const info = await safeGetBatteryInfo();
          if (info && info.level !== undefined && info.level < 0.1 && !info.isCharging) {
            const count = await syncManager.getPendingCount();
            if (count < 20) return;
          }
        } catch (e) { }
      }

      try {
        const batch = await syncManager.getPendingBatch(50);
        if (batch.length === 0) return;

        const res = await apiFetch('/api/v1/runs/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch }),
        });
        const result = await res.json();

        if (result.success) {
          await syncManager.ack(result.syncedIds);
        } else {
          console.warn('[useRunningTracker] Sync failed:', result.error);
        }
      } catch (e) {
        console.error('[useRunningTracker] Sync error', e);
      } finally {
        setIsSyncing(false);
      }
    };

    syncInterval = setInterval(performSync, 10000);
    const handleOnlineSync = () => performSync();
    window.addEventListener('online', handleOnlineSync);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('online', handleOnlineSync);
    };
  }, [isRunning, isSyncing]);

  useEffect(() => {
    if (!isRunning) {
      setCurrentSteps(0);
      pedometerBaselineRef.current = null;
      return;
    }

    let cancelled = false;
    let listenerHandle: { remove: () => Promise<void> | void } | null = null;
    let pedometerInstance: CapacitorPedometerPlugin | null = null;

    const setupPedometer = async () => {
      const native = await isNativePlatform();
      if (!native || cancelled) return;

      try {
        const { CapacitorPedometer } = await import('@capgo/capacitor-pedometer');
        pedometerInstance = CapacitorPedometer;
        const available = await CapacitorPedometer.isAvailable();
        if (!available.stepCounting || cancelled) return;

        const permission = await CapacitorPedometer.checkPermissions();
        const hasPermission = permission.activityRecognition === 'granted'
          ? permission
          : await CapacitorPedometer.requestPermissions();
        if (hasPermission.activityRecognition !== 'granted' || cancelled) {
          toast.warning('未授予步数权限，已回退为估算步数');
          return;
        }

        const initialMeasurement = await CapacitorPedometer.getMeasurement();
        const initialSteps = Number(initialMeasurement.numberOfSteps ?? 0);
        pedometerBaselineRef.current = initialSteps;
        setCurrentSteps(0);

        listenerHandle = await CapacitorPedometer.addListener('measurement', (event) => {
          if (cancelled) return;
          const rawSteps = Number(event.numberOfSteps ?? 0);
          const baseline = pedometerBaselineRef.current ?? rawSteps;
          if (pedometerBaselineRef.current === null) {
            pedometerBaselineRef.current = rawSteps;
          }
          const stepsDelta = Math.max(0, rawSteps - baseline);
          setCurrentSteps(stepsDelta);
          
          // Record step count to ZUPT window
          const nowMs = Date.now();
          stepWindowRef.current.push({ ts: nowMs, steps: stepsDelta });
          // Only keep past 4 seconds in the window
          stepWindowRef.current = stepWindowRef.current.filter(e => e.ts >= nowMs - 4000);
        });

        await CapacitorPedometer.startMeasurementUpdates();
      } catch (error) {
        console.warn('[useRunningTracker] Failed to init pedometer', error);
      }
    };

    setupPedometer();

    return () => {
      cancelled = true;
      Promise.resolve(listenerHandle?.remove()).catch(() => undefined);
      if (pedometerInstance) {
        void pedometerInstance.stopMeasurementUpdates().catch(() => undefined);
        void pedometerInstance.removeAllListeners().catch(() => undefined);
      }
    };
  }, [isRunning]);

  // Timer effect — timestamp-based (immune to JS thread suspension during sleep)
  useEffect(() => {
    if (!isRunning || isPaused) {
      if (isPaused && startTimeRef.current !== null) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        pausedAccumulatorRef.current += elapsed;
        startTimeRef.current = null;
        setDuration(pausedAccumulatorRef.current);
      }
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    let rafId: number;
    let lastSecond = -1;

    const tick = () => {
      if (startTimeRef.current === null || startTimeRef.current === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      // Guard: elapsed must be non-negative and less than 24 hours
      if (elapsed < 0 || elapsed > 86400) {
        // startTimeRef is corrupt — reset it to now so timer continues correctly
        startTimeRef.current = Date.now();
        rafId = requestAnimationFrame(tick);
        return;
      }
      const totalDuration = pausedAccumulatorRef.current + elapsed;
      if (totalDuration !== lastSecond) {
        lastSecond = totalDuration;
        setDuration(totalDuration);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isRunning, isPaused]);



  // --- Persistence & Auto-Save Function ---
  // 双层存储架构：Preferences 仅保留结算元数据 + 最新 100 个点作为安全垫
  // 全量原始轨迹由原生 Room DB 保管，前端恢复时通过 hydrateOfflinePoints 拉取
  const saveState = useCallback(() => {
    if (!isRunning || isStoppingRef.current) return;
    try {
      const RECENT_POINTS_LIMIT = 500;
      const recentPath = pathRef.current.length > RECENT_POINTS_LIMIT
        ? pathRef.current.slice(-RECENT_POINTS_LIMIT)
        : pathRef.current;
      const recentFullPath = fullPathRef.current.length > RECENT_POINTS_LIMIT
        ? fullPathRef.current.slice(-RECENT_POINTS_LIMIT)
        : fullPathRef.current;

      const stateToSave = {
        runId: savedRunIdRef.current, 
        idempotencyKey: runIdempotencyKeyRef.current,
        path: recentPath,
        fullPath: recentFullPath,
        distance: distanceRef.current,
        lastAnnouncedKm: lastAnnouncedKmRef.current,
        duration: durationRef.current,
        pausedAccumulator: pausedAccumulatorRef.current,
        isRunning: isRunning,
        status: isPausedRef.current ? 'paused' : 'running',
        startTime: startTimeRef.current,
        startedAt: startTimeRef.current || Date.now(),
        lastLocationAt: lastLocationRef.current?.timestamp || Date.now(),
        sessionVersion: '2.0', 
        closedPolygons: closedPolygonsRef.current || [],
        eventsHistory: eventsHistoryRef.current || [],
        totalSteps: currentStepsRef.current > 0
          ? currentStepsRef.current
          : estimateStepsFromDistanceMeters(distanceRef.current),
        runIsValid: runIsValid ?? true,
        antiCheatLog: antiCheatLog ?? null,
        area: areaRef.current || 0,
        timestamp: Date.now(),
        restoreSource: 'storage',
        pathTruncated: pathRef.current.length > RECENT_POINTS_LIMIT,
        totalPathPoints: pathRef.current.length,
      };
      return Preferences.set({ key: RECOVERY_KEY, value: JSON.stringify(stateToSave) }).catch((e: unknown) => {
        console.error("[useRunningTracker] Failed to save run state to Preferences", e);
      });
      console.debug('[Session] periodic_save executed');
    } catch (e) {
      console.error("[useRunningTracker] Failed to save run state", e);
    }
  }, [antiCheatLog, isRunning, runIsValid]);

  // Periodic Save (Every 10 seconds per Revised Plan)
  useEffect(() => {
    if (!isRunning || isStoppingRef.current) return;
    
    const interval = setInterval(saveState, 5000);
    return () => clearInterval(interval);
  }, [isRunning, saveState]);

  // ─── Display Path Simplification ───
  // 渲染抽稀：使用 Douglas-Peucker 算法异步计算简化路径，
  // TrajectoryLayer 仅绑定 displayPath，避免全量原始点 GPU 渲染压力。
  // 超过 30 点后，每新增 5 个点触发一次 simplifyPath，其余时间同步追加
  const displayPathSimplifyRef = useRef<{ pending: boolean; counter: number }>({ pending: false, counter: 0 });
  const simplifyDebounceRef = useRef<any>(null);
  useEffect(() => {
    if (!isRunning || isStoppingRef.current) return;

    const SIMPLIFY_TOLERANCE = 0.00003;
    const SIMPLIFY_TRIGGER_POINTS = 5;

    const scheduleSimplify = () => {
      const rawPath = fullPathRef.current;
      
      // 点数 <= 30，直接同步执行 setDisplayPath 保证首段秒级无延迟渲染
      if (rawPath.length <= 30) {
        setDisplayPath([...rawPath]);
        return;
      }

      const DISPLAY_PATH_WINDOW = 1500;

      // Compare against the windowed slice length, not raw path length
      const pathForDisplay = rawPath.length > DISPLAY_PATH_WINDOW
        ? rawPath.slice(-DISPLAY_PATH_WINDOW)
        : rawPath;

      // Compare windowed length vs displayPath, with generous threshold to account 
      // for DP compression ratio (1500 raw → 50-300 simplified points)
      const isBulkUpdate = Math.abs(pathForDisplay.length - displayPath.length) > 1200;

      if (!isBulkUpdate) {
        displayPathSimplifyRef.current.counter++;
        if (displayPathSimplifyRef.current.counter < SIMPLIFY_TRIGGER_POINTS) {
          // 在 5 个点的步长间隔内，同步追加最新点，避免等待
          if (rawPath.length > 0) {
            const lastPt = rawPath[rawPath.length - 1];
            setDisplayPath(prev => {
              if (prev.length > 0) {
                const prevLast = prev[prev.length - 1];
                if (prevLast.lat === lastPt.lat && prevLast.lng === lastPt.lng) {
                  return prev;
                }
              }
              return [...prev, lastPt];
            });
          }
          return;
        }
      }
      displayPathSimplifyRef.current.counter = 0;

      if (displayPathSimplifyRef.current.pending) return;
      displayPathSimplifyRef.current.pending = true;

      const doSimplify = async () => {
        try {
          // Re-read fullPathRef.current at execution time to avoid stale closure
          const latestRaw = fullPathRef.current;
          const latestForDisplay = latestRaw.length > DISPLAY_PATH_WINDOW
            ? latestRaw.slice(-DISPLAY_PATH_WINDOW)
            : latestRaw;
            
          let simplified;
          if (latestForDisplay.length > 100) {
            simplified = await simplifyPathDPAsync(latestForDisplay, SIMPLIFY_TOLERANCE);
          } else {
            simplified = simplifyPathDP(latestForDisplay, SIMPLIFY_TOLERANCE);
          }
          
          // Apply Chaikin smoothing (2 iterations) to visual display path
          const smoothed = chaikinSmooth(simplified, 2);
          
          const displayPoints: Location[] = smoothed.map(pt => ({
            lat: pt.lat,
            lng: pt.lng,
            timestamp: pt.timestamp ?? Date.now(),
          }));
          
          setDisplayPath(prev => {
            // If there's a gap between the last rendered point and start of new simplified
            // window, bridge it by including the last prev point as the anchor.
            if (
              prev.length > 0 &&
              displayPoints.length > 0 &&
              (prev[prev.length - 1].lat !== displayPoints[0].lat ||
               prev[prev.length - 1].lng !== displayPoints[0].lng)
            ) {
              // Only bridge if the prev tail is NOT already inside the new window
              // (i.e., it predates the oldest point in displayPoints)
              const prevTailTs = prev[prev.length - 1].timestamp ?? 0;
              const windowStartTs = displayPoints[0].timestamp ?? Infinity;
              if (prevTailTs < windowStartTs) {
                return [prev[prev.length - 1], ...displayPoints];
              }
            }
            return displayPoints;
          });
        } finally {
          displayPathSimplifyRef.current.pending = false;
        }
      };

      // 弃用 requestIdleCallback，确保移动端 WebView 立即调度
      if (simplifyDebounceRef.current) clearTimeout(simplifyDebounceRef.current);
      simplifyDebounceRef.current = setTimeout(doSimplify, 0);
    };

    scheduleSimplify();

    return () => {
      if (simplifyDebounceRef.current) {
        clearTimeout(simplifyDebounceRef.current);
      }
    };
  }, [isRunning, fullPath]);

  // ─── Kalman-based GPS Smoothing (replaces legacy EMA) ───
  // ─── Kalman-based GPS Smoothing with ZUPT Adaptive Q/R ───
  const smoothLocation = (newLoc: Location, prevLoc: Location | null, accuracy?: number, gpsSpeed: number = 0, isStationary: boolean = false): Location => {
    const adaptiveAccuracy = accuracy != null 
      ? Math.sqrt(Math.max(5.0, accuracy * 2.0)) 
      : Math.sqrt(25.0);

    // Apply adaptive process noise (Q) to Kalman Filter instances
    let qValue = 3.0; // Default Standard Q
    if (isStationary) {
      qValue = 0.01; // Lock filter: Q -> 0
    } else if (gpsSpeed < 1.0) {
      qValue = 0.5; // Walking/Slow
    } else if (gpsSpeed < 4.0) {
      qValue = 3.0; // Running
    } else {
      qValue = 8.0; // Sprinting / High speed
    }

    kalmanLatRef.current.setProcessNoisePSD(qValue);
    kalmanLngRef.current.setProcessNoisePSD(qValue);

    if (!prevLoc || !refLocationRef.current) {
      refLocationRef.current = newLoc;
      kalmanLatRef.current.reset();
      kalmanLngRef.current.reset();
      kalmanLatRef.current.filter(0, newLoc.timestamp, adaptiveAccuracy, isStationary);
      kalmanLngRef.current.filter(0, newLoc.timestamp, adaptiveAccuracy, isStationary);
      if (process.env.NODE_ENV === 'development') {
        lastLocationRef.current = newLoc;
      }
      return newLoc;
    }

    // ── Corner Detection: bypass Kalman on sharp turns ──────────────────
    // If we have at least 2 previous points, compute the heading change.
    // If heading delta > 60°, this is a corner — reset Kalman and return raw point.
    if (pathRef.current.length >= 2) {
      const ptA = pathRef.current[pathRef.current.length - 2];
      const ptB = pathRef.current[pathRef.current.length - 1]; // = prevLoc after writing
      
      const h1x = ptB.lng - ptA.lng;
      const h1y = ptB.lat - ptA.lat;
      const h2x = newLoc.lng - ptB.lng;
      const h2y = newLoc.lat - ptB.lat;
      const len1 = Math.sqrt(h1x * h1x + h1y * h1y);
      const len2 = Math.sqrt(h2x * h2x + h2y * h2y);
      
      if (len1 > 0 && len2 > 0) {
        const cosTheta = (h1x * h2x + h1y * h2y) / (len1 * len2);
        const thetaDeg = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);
        
        if (thetaDeg > 60) {
          // Sharp corner detected — reset Kalman velocity & covariances but preserve position
          refLocationRef.current = newLoc;
          kalmanLatRef.current.resetToPosition(0, adaptiveAccuracy);
          kalmanLngRef.current.resetToPosition(0, adaptiveAccuracy);
          console.debug(`[Kalman] Corner bypass: heading delta ${thetaDeg.toFixed(1)}°, reset filter velocity`);
          return newLoc; // Return raw GPS point, skip smoothing
        }
      }
    }
    // ────────────────────────────────────────────────────────────────────

    const refLat = refLocationRef.current.lat;
    const refLng = refLocationRef.current.lng;
    const latRad = (refLat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);

    const yMeters = (newLoc.lat - refLat) * 111320;
    const xMeters = (newLoc.lng - refLng) * 111320 * cosLat;

    const smoothedY = kalmanLatRef.current.filter(yMeters, newLoc.timestamp, adaptiveAccuracy, isStationary);
    const smoothedX = kalmanLngRef.current.filter(xMeters, newLoc.timestamp, adaptiveAccuracy, isStationary);

    const smoothedLat = refLat + smoothedY / 111320;
    const smoothedLng = refLng + smoothedX / (111320 * cosLat);

    return {
      lat: smoothedLat,
      lng: smoothedLng,
      timestamp: newLoc.timestamp
    };
  };

  const unionTwoLoops = useCallback((loop1: Location[], loop2: Location[]): Location[] => {
    try {
      const coords1 = loop1.map(p => [p.lng, p.lat]);
      if (coords1[0][0] !== coords1[coords1.length - 1][0] || coords1[0][1] !== coords1[coords1.length - 1][1]) {
        coords1.push([...coords1[0]]);
      }
      const coords2 = loop2.map(p => [p.lng, p.lat]);
      if (coords2[0][0] !== coords2[coords2.length - 1][0] || coords2[0][1] !== coords2[coords2.length - 1][1]) {
        coords2.push([...coords2[0]]);
      }
      const poly1 = turf.polygon([coords1]);
      const poly2 = turf.polygon([coords2]);
      let combined = turf.union(turf.featureCollection([poly1, poly2]));
      if (combined) {
        // [优化] 第二层微量卡边：利用 turf.simplify 消除 double 浮点运算缝隙，保持拓扑，严禁过度削角
        combined = turf.simplify(combined, { tolerance: 0.000003, highQuality: true });
        
        let extCoords: number[][] = [];
        if (combined.geometry.type === 'Polygon') {
          extCoords = combined.geometry.coordinates[0];
        } else if (combined.geometry.type === 'MultiPolygon') {
          let maxArea = -1;
          combined.geometry.coordinates.forEach(polyCoords => {
            try {
              const p = turf.polygon(polyCoords);
              const a = turf.area(p);
              if (a > maxArea) {
                maxArea = a;
                extCoords = polyCoords[0];
              }
            } catch {}
          });
        }
        if (extCoords.length > 0) {
          return extCoords.map((coord, idx) => ({
            lng: coord[0],
            lat: coord[1],
            timestamp: loop1[idx]?.timestamp || loop2[idx]?.timestamp || Date.now()
          }));
        }
      }
    } catch (e) {
      console.warn('[unionTwoLoops] Failed to union loops, returning loop with larger area', e);
    }
    
    // Fallback: compare area of loop1 and loop2, return the larger one
    try {
      const coords1 = loop1.map(p => [p.lng, p.lat]);
      if (coords1[0][0] !== coords1[coords1.length - 1][0] || coords1[0][1] !== coords1[coords1.length - 1][1]) {
        coords1.push([...coords1[0]]);
      }
      const coords2 = loop2.map(p => [p.lng, p.lat]);
      if (coords2[0][0] !== coords2[coords2.length - 1][0] || coords2[0][1] !== coords2[coords2.length - 1][1]) {
        coords2.push([...coords2[0]]);
      }
      const a1 = turf.area(turf.polygon([coords1]));
      const a2 = turf.area(turf.polygon([coords2]));
      return a1 >= a2 ? loop1 : loop2;
    } catch {
      return loop1;
    }
  }, []);

  const calculateArea = useCallback((polygons: Location[][]) => {
    if (!polygons || polygons.length === 0) return 0;
    try {
      const validTurfPolys: Feature<Polygon>[] = [];
      polygons.forEach(poly => {
        if (poly.length < 3) return;
        const loopCheck = isLoopClosed(
          poly.map((point, index) => ({ lat: point.lat, lng: point.lng, timestamp: point.timestamp ?? index })),
          LOOP_CLOSURE_THRESHOLD_M
        );
        if (!loopCheck.isClosed) return;
        
        const coords = poly.map(p => [p.lng, p.lat]);
        // Ensure closed ring
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push([...coords[0]]);
        }
        validTurfPolys.push(turf.polygon([coords]));
      });

      if (validTurfPolys.length === 0) return 0;
      
      let merged = validTurfPolys[0] as Feature<Polygon | MultiPolygon>;
      for (let i = 1; i < validTurfPolys.length; i++) {
        const combined = turf.union(turf.featureCollection([merged, validTurfPolys[i]]));
        if (combined) {
          merged = combined as Feature<Polygon | MultiPolygon>;
        }
      }
      
      // Apply topology-preserving micro-simplification (within 0.3 meters, i.e., 0.000003 degrees)
      // to heal float gaps and compress redundant vertices.
      try {
        merged = turf.simplify(merged, { tolerance: 0.000003, highQuality: true });
      } catch (simplifyErr) {
        console.warn("[useRunningTracker] Failed to simplify merged polygon", simplifyErr);
      }
      
      return turf.area(merged);
    } catch (e) {
      console.warn("[useRunningTracker] Invalid polygon for area calculation, falling back to previous area", e);
      return areaRef.current;
    }
  }, []);

  const handleLocationUpdate = useCallback((
    lat: number,
    lng: number,
    accuracy?: number,
    timestamp?: number,
    speed?: number,
    heading?: number,
    isOfflineReplay: boolean = false
  ) => {
    // 如果当前正在进行异步追帧，将实时点推入缓冲队列并立刻返回
    if (isHydratingRef.current) {
      pendingLivePointsRef.current.push({ lat, lng, timestamp: timestamp || Date.now() });
      return;
    }

    if (isPausedRef.current || isStoppingRef.current) return;

    console.log(`[useRunningTracker] Location update received: lat=${lat}, lng=${lng}, accuracy=${accuracy}, timestamp=${timestamp}, isOfflineReplay=${isOfflineReplay}`);

    const now = timestamp || Date.now();

    // ================================================================
    // 🛡️ TIMESTAMP SLIDING WINDOW FILTER (全局 5 秒滑动窗口去重与回拨拦截)
    // ================================================================
    recentTimestampsRef.current = recentTimestampsRef.current.filter(t => t >= now - 5000);
    const maxTs = recentTimestampsRef.current.length > 0 ? Math.max(...recentTimestampsRef.current) : 0;
    const isOverlap = recentTimestampsRef.current.includes(now);
    const isRegressive = now < maxTs;

    if (isOverlap || isRegressive) {
      console.debug(
        `[Timestamp Sliding Window Filter] ❌ useRunningTracker 拦截重叠/回拨点: ts=${now}, maxTs=${maxTs}, isOverlap=${isOverlap}, isRegressive=${isRegressive}`
      );
      return;
    }
    recentTimestampsRef.current.push(now);

    // ================================================================
    // 🛡️ TIMESTAMP DEDUP (防后台缓存点重复注入)
    // 后台定位插件可能在唤醒时补发历史缓存点，若时间戳不晚于已处理点则丢弃
    // 增加 CLOCK_DRIFT_TOLERANCE_MS 容忍窗口，防止 NTP 同步/跨时区导致的时钟回拨误杀
    // ================================================================
    if (lastLocationRef.current && now < lastLocationRef.current.timestamp - CLOCK_DRIFT_TOLERANCE_MS) {
      console.debug(
        `[GPS-Filter] ❌ Timestamp DEDUP: incoming ${now} < last ${lastLocationRef.current.timestamp} - ${CLOCK_DRIFT_TOLERANCE_MS}ms tolerance`
      );
      return;
    }

    const isAwaitingAnchor = pathRef.current.length === 0;

    // ================================================================
    // 🛡️ THREE-LAYER GPS ANTI-JITTER INTERCEPTOR
    // Applied BEFORE smoothing, path appending, or distance calculation
    //
    // 展示流与记录流分离：
    // - Anchor 阶段（pathRef 为空）：精度 <= 50m 的点可作为首个锚点
    // - 追踪阶段：精度 <= 30m 的点才参与距离结算
    // - Warm-up 期间：所有通过精度检查的点仅更新 UI（currentLocation），
    //   绝对不写入 pathRef，直到连续收到高精度点解除 warm-up
    // ================================================================

    if (isAwaitingAnchor) {
      if (typeof accuracy !== 'number' || accuracy > GPS_START_ANCHOR_ACCURACY_METERS) {
        if (firstPointAtRef.current === null) {
          firstPointAtRef.current = Date.now();
        }
        console.debug(
          `[GPS-Filter] ❌ Anchor REJECT: accuracy ${typeof accuracy === 'number' ? accuracy.toFixed(0) : 'unknown'}m > ${GPS_START_ANCHOR_ACCURACY_METERS}m threshold`
        );
        return;
      }
    } else if (accuracy != null && accuracy > GPS_TRACKING_ACCURACY_METERS) {
      // 起跑初期（前 20 个点）允许放行精度在展示门槛（100m）内的点，以便立即渲染轨迹，并在后台平滑修复
      const isEarlyPhase = pathRef.current.length < 20;
      if (isEarlyPhase && accuracy <= GPS_DISPLAY_ACCURACY_METERS) {
        console.log(`[GPS-Filter] ⚠️ Early phase low-accuracy point accepted for instant rendering: accuracy ${accuracy.toFixed(0)}m`);
      } else {
        console.debug(`[GPS-Filter] ❌ Layer 1 REJECT: accuracy ${accuracy.toFixed(0)}m > ${GPS_TRACKING_ACCURACY_METERS}m threshold`);
        if (gpsWeakTimerRef.current === null) {
          gpsWeakTimerRef.current = setTimeout(() => {
            setIsGPSWeak(true);
            gpsWeakTimerRef.current = null;
          }, 5000);
        }
        return;
      }
    }

    if (pathRef.current.length >= 2) {
      const ptA = pathRef.current[pathRef.current.length - 2];
      const ptB = pathRef.current[pathRef.current.length - 1];
      const dAB = getDistanceFromLatLonInMeters(ptA.lat, ptA.lng, ptB.lat, ptB.lng);
      const dBC = getDistanceFromLatLonInMeters(ptB.lat, ptB.lng, lat, lng);
      const dAC = getDistanceFromLatLonInMeters(ptA.lat, ptA.lng, lat, lng);

      // 1. 提升距离门槛至 3m（与位移防抖对齐），防止长线段限制误杀小幅毛刺
      if (dAB > 3.0 && dBC > 3.0 && dAC > 0) {
        // 2. 计算精确的横向偏离距 (Perpendicular distance from C to line AB in meters)
        const avgLat = (ptA.lat + lat) / 2;
        const cosLat = Math.cos((avgLat * Math.PI) / 180);
        const dx_AB = (ptB.lng - ptA.lng) * 111320 * cosLat;
        const dy_AB = (ptB.lat - ptA.lat) * 111320;
        const dx_AC = (lng - ptA.lng) * 111320 * cosLat;
        const dy_AC = (lat - ptA.lat) * 111320;
        
        const lenAB = Math.hypot(dx_AB, dy_AB);
        const cross = dx_AB * dy_AC - dy_AB * dx_AC;
        const lateralOffset = lenAB > 0.1 ? Math.abs(cross) / lenAB : 0;
        
        // 3. 计算方向夹角 (Heading Filter)
        const ux = ptB.lng - ptA.lng;
        const uy = ptB.lat - ptA.lat;
        const vx = lng - ptB.lng;
        const vy = lat - ptB.lat;
        const dot = ux * vx + uy * vy;
        const lenU = Math.sqrt(ux * ux + uy * uy);
        const lenV = Math.sqrt(vx * vx + vy * vy);
        let thetaDeg = 0;
        if (lenU > 0 && lenV > 0) {
          const cosTheta = dot / (lenU * lenV);
          thetaDeg = (Math.acos(Math.max(-1, Math.min(1, cosTheta))) * 180) / Math.PI;
        }

        // Calculate segment speeds to distinguish real turns from high-speed GPS drift spikes
        const tAB = (ptB.timestamp - ptA.timestamp) / 1000;
        const tBC = (now - ptB.timestamp) / 1000;
        const speedAB = tAB > 0 ? dAB / tAB : 0;
        const speedBC = tBC > 0 ? dBC / tBC : 0;
        const isSuspiciousSpeed = speedAB > 7.0 || speedBC > 7.0;

        // Catch background drift spikes (slow speed due to long background time, but spatial shape is a sharp spike)
        const isBackgroundSpike = (tAB > 5.0 && dAB > 20.0 && dBC > 20.0 && dAC < 15.0);

        // 仅当横向偏离距 > 3.0m 且方向角 > 135°，且伴随速度异常（如单段 > 7.0 m/s）时，才判定为极端回头漂移尖角并过滤
        if ((lateralOffset > 3.0 && thetaDeg > 135.0 && isSuspiciousSpeed) || isBackgroundSpike) {
          console.warn(`[GPS-Median] 🎯 Median Spike Filtered! Point B (${ptB.lat.toFixed(6)}, ${ptB.lng.toFixed(6)}) detected as spike. Removing from trajectory. Lateral: ${lateralOffset.toFixed(1)}m, Angle: ${thetaDeg.toFixed(1)}°, speedAB=${speedAB.toFixed(1)}m/s, speedBC=${speedBC.toFixed(1)}m/s, isBackgroundSpike=${isBackgroundSpike}`);
          pathRef.current.pop();
          lastLocationRef.current = ptA;
          setDistance(prev => Math.max(0, prev - dAB));
          // 重置 lastSpeedRef 以防加速度校验数值大跳变
          lastSpeedRef.current = null;
          
          // 立即更新展示轨迹，把屏幕上的那条尖刺线擦除
          setDisplayPath(prev => {
            if (prev.length > 0 && prev[prev.length - 1].timestamp === ptB.timestamp) {
              return prev.slice(0, -1);
            }
            return prev;
          });
        }
      }
    }

    // --- Layer 2: Speed & Accel Filter & ZUPT ---
    let speedMs = speed ?? 0;
    let distToPrev = 0;
    let timeDiffSec = 0;
    
    if (lastLocationRef.current) {
      const prevLoc = lastLocationRef.current;
      distToPrev = getDistanceFromLatLonInMeters(prevLoc.lat, prevLoc.lng, lat, lng);
      timeDiffSec = (now - prevLoc.timestamp) / 1000;
      
      if (speedMs <= 0 && timeDiffSec > 0) {
        speedMs = distToPrev / timeDiffSec;
      }

      if (!isOfflineReplay && timeDiffSec > 0.5) {
        // 1. 速度校验
        if (speedMs > 10) {
          console.debug(
            `[GPS-Filter] ❌ Layer 2 REJECT: speed ${(speedMs * 3.6).toFixed(1)}km/h > 36km/h | ` +
            `dist=${distToPrev.toFixed(1)}m dt=${timeDiffSec.toFixed(1)}s`
          );
          return;
        }

        // 2. 加速度约束 (a = dv / dt)，如果速度变化异常，熔断漂移点
        if (lastSpeedRef.current !== null && timeDiffSec > 0 && timeDiffSec <= 3.0) {
          const accel = Math.abs(speedMs - lastSpeedRef.current) / timeDiffSec;
          
          // Detect potential corner: heading change > 45° from last two points
          let isCornerCandidate = false;
          if (pathRef.current.length >= 2) {
            const ptA = pathRef.current[pathRef.current.length - 2];
            const ptB = pathRef.current[pathRef.current.length - 1];
            const heading1 = Math.atan2(ptB.lng - ptA.lng, ptB.lat - ptA.lat);
            const heading2 = Math.atan2(lng - ptB.lng, lat - ptB.lat);
            let headingDelta = Math.abs(heading1 - heading2) * (180 / Math.PI);
            if (headingDelta > 180) headingDelta = 360 - headingDelta;
            isCornerCandidate = headingDelta > 45;
          }
          
          // Use relaxed threshold at corners (12.0 m/s²) vs straight lines (8.0 m/s²)
          // to prevent GPS jitter and sharp turns from being falsely rejected.
          const accelThreshold = isCornerCandidate ? 12.0 : 8.0;
          
          if (accel > accelThreshold) {
            console.debug(
              `[GPS-Filter] ❌ Accel REJECT: ${accel.toFixed(2)}m/s² > ${accelThreshold}m/s²` +
              ` | corner=${isCornerCandidate} speedMs=${speedMs.toFixed(1)}`
            );
            return;
          }
        }
        // Reset lastSpeedRef on near-stop to prevent stale baseline
        lastSpeedRef.current = speedMs < 0.3 ? null : speedMs;
      }
    }

    // ZUPT (Zero Velocity Update) Detection
    const nowMs = Date.now();
    stepWindowRef.current = stepWindowRef.current.filter(e => e.ts >= nowMs - 4000);
    const stepsInWindow = stepWindowRef.current.length >= 2
      ? stepWindowRef.current[stepWindowRef.current.length - 1].steps - stepWindowRef.current[0].steps
      : 0;
      
    const hasPedometer = stepWindowRef.current.length >= 1;
    const isStationary = hasPedometer
      ? (stepsInWindow === 0 && speedMs < 0.5)
      : (speedMs < 0.3);

    // ================================================================
    // Filters passed — this is a valid GPS point candidate
    // ================================================================
    setIsGPSWeak(false);
    if (gpsWeakTimerRef.current) {
      clearTimeout(gpsWeakTimerRef.current);
      gpsWeakTimerRef.current = null;
    }

    let newLoc: Location = { lat, lng, timestamp: now };

    // Apply Kalman Smoothing (pass accuracy and ZUPT status)
    newLoc = smoothLocation(newLoc, lastLocationRef.current, accuracy, speedMs, isStationary);

    const finalLoc = { ...newLoc, accuracy };

    if (isStationary) {
      console.log(`[ZUPT] Stationary locked. Jitter suppressed (stepsInWindow=${stepsInWindow}, speed=${speedMs.toFixed(2)}m/s).`);
      return; // Stop update flow early to freeze display location
    }

    // --- Phase 2: Warm-up & Jitter Filter ---
    // 展示流与记录流分离核心逻辑：
    // warm-up 期间，所有通过精度检查的点仅更新 currentLocation 供 UI 渲染，
    // 绝对不写入 pathRef 参与距离结算。
    if (isWarmingUpRef.current) {
      if (firstPointAtRef.current === null) {
        firstPointAtRef.current = now;
      }
      validPointsCountRef.current++;

      // Stop warming up after timeout OR minimum high-accuracy points
      if (now - firstPointAtRef.current > WARMUP_TIMEOUT_MS || validPointsCountRef.current >= MIN_WARMUP_POINTS) {
        // 必须同步更新 ref，不能只 setIsWarmingUp（Effect 异步，有失同步窗口）
        isWarmingUpRef.current = false;
        setIsWarmingUp(false);
        // [优化] 注释/删除此行，必须保留 finalLoc 作为后续轨迹过滤参考点，防止首点丢失与位移防抖误杀
        // lastLocationRef.current = null;
        lastLocationRef.current = finalLoc;
        lastStepCountRef.current = currentSteps;
        console.log(`[GPS-Filter] ✅ Warm-up complete (${validPointsCountRef.current} points, ${now - firstPointAtRef.current}ms). Starting track.`);
      } else {
        // Still warming up: update current location for UI but don't record to path
        lastLocationRef.current = finalLoc;
        setCurrentLocation(finalLoc);
        lastStepCountRef.current = currentSteps;
        return;
      }
    }

    // --- Phase 3: Spatial and Speed Filtering ---
    let distFromLast = 0;
    const prevLoc = lastLocationRef.current; // Cache actual previous valid location

    // Run spatial filter first against actual previous point
    const stepDelta = Math.max(0, currentSteps - lastStepCountRef.current);
    const spatialFilterResult = shouldAcceptPointByDistance(
      prevLoc
        ? { lat: prevLoc.lat, lng: prevLoc.lng, timestamp: prevLoc.timestamp }
        : null,
      { lat: finalLoc.lat, lng: finalLoc.lng, accuracy, timestamp: now },
      stepDelta
    );

    if (!spatialFilterResult.accept) {
      console.debug('[GPS Filter] Dropped point:', spatialFilterResult.reason);
      if (spatialFilterResult.reason === 'speed-anomaly' && prevLoc) {
        console.warn(`[DR-Gate] Resetting Kalman filters to raw position ${lat}, ${lng} due to speed anomaly / outage recovery.`);
        kalmanLatRef.current.resetToPosition(lat, accuracy || 50);
        kalmanLngRef.current.resetToPosition(lng, accuracy || 50);
      }
      return;
    }

    // Run spatial debounce (3m threshold, relaxed to 1m at corners)
    if (prevLoc) {
      distFromLast = getDistanceFromLatLonInMeters(
        prevLoc.lat,
        prevLoc.lng,
        finalLoc.lat,
        finalLoc.lng
      );

      // Preserve corner points regardless of displacement
      const isSignificantTurn = ((): boolean => {
        if (pathRef.current.length < 2) return false;
        const ptA = pathRef.current[pathRef.current.length - 2];
        const ptB = pathRef.current[pathRef.current.length - 1];
        const h1 = Math.atan2(ptB.lng - ptA.lng, ptB.lat - ptA.lat);
        const h2 = Math.atan2(lat - ptB.lat, lng - ptB.lng);
        let delta = Math.abs(h1 - h2) * (180 / Math.PI);
        if (delta > 180) delta = 360 - delta;
        return delta > 60; // 60° heading change = corner
      })();

      // Use 1.0m threshold at corners, 1.5m on straights
      const MIN_MOVE_METERS = isSignificantTurn ? 1.0 : 1.5;

      if (distFromLast < MIN_MOVE_METERS) {
        // Point is too close to last point, probably jitter while stationary
        setCurrentLocation(finalLoc);
        console.log(`[Tracker] Point skipped (<${MIN_MOVE_METERS}m), dist=${distFromLast.toFixed(1)}m, TotalDist=${distanceRef.current.toFixed(1)}m`);
        return;
      }
    }

    // Run segment speed validation
    if (prevLoc && prevLoc.timestamp) {
      const speedResult = validateSegmentSpeed(
        prevLoc.lat,
        prevLoc.lng,
        prevLoc.timestamp,
        finalLoc.lat,
        finalLoc.lng,
        now
      );

      if (!speedResult.accept) {
        console.warn(`[Speed-Filter] ❌ HARD_SPEED_EXCEEDED: ${speedResult.speedMs.toFixed(1)}m/s > 12m/s, point dropped`);
        setClientFlags(prev => {
          const next = [...prev, speedResult.flag!];
          clientFlagsRef.current = next;
          return next;
        });
        return;
      }

      if (speedResult.flag) {
        console.warn(`[Speed-Filter] ⚠️ SUSPICIOUS_CYCLING: ${speedResult.speedMs.toFixed(1)}m/s > 8m/s, point accepted with flag`);
        setClientFlags(prev => {
          const next = [...prev, speedResult.flag!];
          clientFlagsRef.current = next;
          return next;
        });

        const consecutiveSpeedFlags = clientFlagsRef.current.filter(
          f => f === 'SUSPICIOUS_CYCLING' || f === 'HARD_SPEED_EXCEEDED'
        ).length;
        if (consecutiveSpeedFlags >= 3 && consecutiveSpeedFlags % 3 === 0) {
          toast.warning('⚠️ 检测到异常移动，本次跑步可能被标记为疑似作弊');
        }
      }
    }

    // Point passed all filters! Update distance and set last location
    if (prevLoc) {
      if (justRecoveredRef.current) {
        console.log(`[useRunningTracker] Skipping distance accumulation for first point after recovery. Jump distance: ${distFromLast.toFixed(1)}m`);
        justRecoveredRef.current = false;
      } else {
        setDistance(prev => prev + distFromLast);
      }
      const timeDiffSec = (now - prevLoc.timestamp) / 1000;
      if (timeDiffSec > 0.1) {
        lastSpeedRef.current = distFromLast / timeDiffSec;
      }
    }
    lastLocationRef.current = finalLoc;

    // P1 #4 — 步频-速度不匹配熔断：防止车载/骑行作弊（起跑前 20 个点预热期内挂起，平滑修正完成后激活）
    const isWarmedUpAndSmoothed = pathRef.current.length >= 20;
    if (prevLoc && distanceRef.current > 100 && isWarmedUpAndSmoothed) {
      const timeDiffSec = (now - prevLoc.timestamp) / 1000;
      if (timeDiffSec > 0.5) {
        const speedMs = distFromLast / timeDiffSec;
        const stepsPerKm = distanceRef.current > 0 && currentStepsRef.current > 0
          ? (currentStepsRef.current / (distanceRef.current / 1000))
          : 0;

        // 速度 > 4m/s (14.4km/h) 且每公里步数 < 150 → 高度疑似车辆
        if (speedMs > 4 && stepsPerKm < 150) {
          console.warn(
            `[AntiCheat] Speed/step mismatch: ${speedMs.toFixed(1)}m/s, ${stepsPerKm.toFixed(0)} steps/km — possible vehicle`
          );
          setClientFlags(prev => {
            const next = [...prev, 'speed_step_mismatch'];
            clientFlagsRef.current = next;
            return next;
          });
        }
      }
    }

    // ========================================================================
    // 🎯 SMART LOOP CLOSURE (智能吸附) - DUAL-TRACK DETECTION
    // ========================================================================
    // Track A: Global Start-End Detection (起点-终点闭合)
    // Track B: Sliding Window Detection (滑动窗口闭合)
    // Either track can trigger a territory claim.
    // Deduplication: Track claimed anchor ranges to prevent double-claiming.
    // ========================================================================

    const MIN_LOOP_SIZE = 5;
    const P_SHAPE_MIN_POINT_GAP = 15;
    const MIN_CLAIM_INTERVAL_MS = 3000;
    const SLIDING_WINDOW_SIZE = 1000;

    let loopForCalc: Location[] | null = null;
    let loopSource: 'start-end' | 'sliding-window' = 'start-end';
    let loopAnchorStart = 0;
    let loopAnchorEnd = 0;
    const currentPath = pathRef.current;

    if (currentPath.length >= MIN_LOOP_SIZE) {
      // Track A: Global Start-End Detection
      const startPoint = currentPath[0];
      const distToStart = getDistanceFromLatLonInMeters(newLoc.lat, newLoc.lng, startPoint.lat, startPoint.lng);
      console.log(`[Smart Snap] Track A: distToStart=${distToStart.toFixed(1)}m, threshold=${LOOP_CLOSURE_SNAP_M}m`);
      if (distToStart <= LOOP_CLOSURE_SNAP_M) {
        const snappedLoc: Location = {
          lat: startPoint.lat,
          lng: startPoint.lng,
          timestamp: now
        };
        loopForCalc = [...currentPath, snappedLoc];
        loopSource = 'start-end';
        loopAnchorStart = 0;
        loopAnchorEnd = currentPath.length - 1;
        console.log(`[Smart Snap] 🎯 Track A: Snapped to start! Distance: ${Math.round(distToStart)}m`);
      }

      // Track B: Sliding Window Detection (only if Track A didn't trigger)
      if (!loopForCalc) {
        const windowStart = Math.max(0, currentPath.length - SLIDING_WINDOW_SIZE);
        const latestPoint = turf.point([newLoc.lng, newLoc.lat]);
        let pShapeAnchorIndex = -1;

        for (let i = windowStart; i <= currentPath.length - 1 - P_SHAPE_MIN_POINT_GAP; i++) {
          const historical = currentPath[i];
          const historicalPoint = turf.point([historical.lng, historical.lat]);
          const gapMeters = turf.distance(latestPoint, historicalPoint, { units: 'kilometers' }) * 1000;
          if (gapMeters <= LOOP_CLOSURE_SNAP_M) {
            pShapeAnchorIndex = i;
            break;
          }
        }

        if (pShapeAnchorIndex >= 0) {
          const anchor = currentPath[pShapeAnchorIndex];
          const closingPoint: Location = {
            lat: anchor.lat,
            lng: anchor.lng,
            timestamp: now
          };
          loopForCalc = [...currentPath.slice(pShapeAnchorIndex), newLoc, closingPoint];
          loopSource = 'sliding-window';
          loopAnchorStart = pShapeAnchorIndex;
          loopAnchorEnd = currentPath.length - 1;
          console.log(`[Smart Snap] 🎯 Track B: Sliding window closed at index ${pShapeAnchorIndex}`);
        }
      }
    }

    // Deduplication check: prevent claiming the same segment twice
    let shouldProcessLoop = true;
    if (loopForCalc && loopAnchorStart >= 0) {
      for (const claimed of claimedSegmentsRef.current) {
        if (
          loopAnchorStart >= claimed.start && loopAnchorStart <= claimed.end &&
          loopAnchorEnd >= claimed.start && loopAnchorEnd <= (claimed.end + P_SHAPE_MIN_POINT_GAP)
        ) {
          shouldProcessLoop = false;
          console.log(`[Smart Snap] ⏭️ Loop segment [${loopAnchorStart}-${loopAnchorEnd}] already claimed, skipping`);
          break;
        }
      }
    }

    if (loopForCalc && loopForCalc.length > MIN_LOOP_SIZE && shouldProcessLoop && now - lastClaimAtRef.current >= MIN_CLAIM_INTERVAL_MS) {

      try {
        const loopCheck = isLoopClosed(
          loopForCalc.map((point, index) => ({ lat: point.lat, lng: point.lng, timestamp: point.timestamp ?? index })),
          LOOP_CLOSURE_THRESHOLD_M
        );
        if (loopCheck.isClosed) {
          const coords = loopForCalc.map(pt => [pt.lng, pt.lat]);
          if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
              coords.push([...coords[0]]);
          }
          const poly = turf.polygon([coords]);
          const loopArea = turf.area(poly);

          if (loopArea > 100) {
            // Check if the loop is a duplicate of any existing claimed loops
            const dupIndex = sessionClaimsRef.current.findIndex(existingLoop => 
              isDuplicatePolygon(loopForCalc!, existingLoop)
            );
            
            let nextClaims: Location[][];
            if (dupIndex !== -1) {
              console.log("[Smart Snap] 🔄 Loop is a duplicate, merging into existing claim at index", dupIndex);
              const mergedLoop = unionTwoLoops(sessionClaimsRef.current[dupIndex], loopForCalc!);
              nextClaims = [...sessionClaimsRef.current];
              nextClaims[dupIndex] = mergedLoop;
            } else {
              nextClaims = [...sessionClaimsRef.current, loopForCalc!];
            }
            
            const newTotalArea = calculateArea(nextClaims);
            
            setSessionClaims(nextClaims);
            setClosedPolygons(nextClaims);
            useGameStore.getState().incrementLoopClosed(); // 广播断流归档信号
            setArea(newTotalArea);
            lastClaimAtRef.current = now;

            // Record claimed segment for deduplication
            claimedSegmentsRef.current.push({ start: loopAnchorStart, end: loopAnchorEnd });

            // 核心自愈：清空当前圈轨迹缓存，防止第二圈与第一圈产生伪自交
            pathRef.current = [];
            setPath([]);

            const TOAST_AREA_INCREMENT_THRESHOLD = 50;
            const incrementalArea = newTotalArea - lastToastAreaRef.current;
            if (incrementalArea >= TOAST_AREA_INCREMENT_THRESHOLD) {
              lastToastAreaRef.current = newTotalArea;
              toast.success(`🎉 领地已捕获！新增面积: ${Math.round(incrementalArea)}m²`, {
                description: '跑步记录中... 继续前进占领更多领地！',
                duration: 3000
              });
            }
          }
        }
      } catch (e) {
        console.warn("[useRunningTracker] Invalid polygon", e);
      }
    }
    if (wasPausedRef.current) {
      (finalLoc as any).isResume = true;
      wasPausedRef.current = false;
    }

    fullPathRef.current.push(finalLoc);
    setFullPath([...fullPathRef.current]);

    pathRef.current.push(finalLoc);

    // --- Marathon Ultra-Long Track Memory Protection Limit (P0) ---
    // [P1 Fix] 降低阈值至 2000 点，超限执行 FIFO 剔除，防止 OOM
    const MAX_TRACK_POINTS = 2000;
    if (pathRef.current.length >= MAX_TRACK_POINTS) {
      console.warn(`[useRunningTracker] Memory protection triggered: path length ${pathRef.current.length} >= ${MAX_TRACK_POINTS}. Performing FIFO eviction.`);
      // FIFO: 保留最新的一半点位，丢弃最旧的一半
      const keepCount = Math.floor(MAX_TRACK_POINTS / 2);
      pathRef.current = pathRef.current.slice(-keepCount);
      console.log(`[useRunningTracker] FIFO eviction complete. New path length: ${pathRef.current.length}`);
    }

    if (fullPathRef.current.length >= MAX_TRACK_POINTS) {
      console.warn(`[useRunningTracker] Memory protection triggered for fullPath: path length ${fullPathRef.current.length} >= ${MAX_TRACK_POINTS}. Performing FIFO eviction.`);
      const keepCount = Math.floor(MAX_TRACK_POINTS / 2);
      fullPathRef.current = fullPathRef.current.slice(-keepCount);
      setFullPath([...fullPathRef.current]);
      console.log(`[useRunningTracker] fullPath FIFO eviction complete. New path length: ${fullPathRef.current.length}`);
    }

    if (pathRef.current.length % 10 === 0) {
      saveState();
    }

    if (typeof window !== 'undefined' && (window as any).__injectLocationPoints) {
      (window as any).__injectLocationPoints(finalLoc);
    }
 
    // 后台线性插值算法 (Linear Interpolation Back-Smoothing)
    if (accuracy != null && accuracy <= GPS_TRACKING_ACCURACY_METERS) {
      const currentPath = pathRef.current;
      if (currentPath.length >= 3) {
        let firstHighAccIndex = -1;
        // 查找在黄金起点之后的第一个高精度点
        for (let i = 1; i < currentPath.length; i++) {
          const pt = currentPath[i] as any;
          if (pt.accuracy != null && pt.accuracy <= GPS_TRACKING_ACCURACY_METERS) {
            firstHighAccIndex = i;
            break;
          }
        }
 
        // 如果在第一个高精度点之前存在低精度脏点，启动插值重写与里程校准
        if (firstHighAccIndex > 1) {
          console.log(`[GPS-Repair] 🛠️ Found first high-accuracy point at index ${firstHighAccIndex}. Smoothing preceding points...`);
          const startPt = currentPath[0];
          const endPt = currentPath[firstHighAccIndex];
          const startTs = startPt.timestamp;
          const endTs = endPt.timestamp;
          const totalDuration = endTs - startTs;
 
          if (totalDuration > 0) {
            // 进行线性插值平滑位置重写
            for (let i = 1; i < firstHighAccIndex; i++) {
              const pt = currentPath[i];
              const ratio = (pt.timestamp - startTs) / totalDuration;
              pt.lat = startPt.lat + (endPt.lat - startPt.lat) * ratio;
              pt.lng = startPt.lng + (endPt.lng - startPt.lng) * ratio;
              (pt as any).accuracy = GPS_TRACKING_ACCURACY_METERS; // 提升精度，解除脏点状态
            }
 
            // 里程校准：重新计算整条 Path 的累计哈弗辛距离，覆盖更新 distanceRef.current 与 setDistance 状态，严防里程虚高
            let newTotalDist = 0;
            for (let i = 1; i < currentPath.length; i++) {
              newTotalDist += getDistanceFromLatLonInMeters(
                currentPath[i - 1].lat,
                currentPath[i - 1].lng,
                currentPath[i].lat,
                currentPath[i].lng
              );
            }
            distanceRef.current = newTotalDist;
            setDistance(newTotalDist);
            console.log(`[GPS-Repair] ✅ Back-smoothing completed. Recalculated cumulative distance: ${newTotalDist.toFixed(1)}m`);

            if (typeof window !== 'undefined' && (window as any).__injectLocationPoints) {
              (window as any).__injectLocationPoints(pathRef.current, true);
            }
          }
        }
      }
    }
 
    setPath([...pathRef.current]);

    // ========================================================================
    // 🔄 REAL-TIME SELF-INTERSECTION LOOP DETECTION (with throttling)
    // ========================================================================
    // 每累计 5 个 GPS 点触发一次 extractValidLoops 自交检测，
    // 覆盖 P 形环、8 字形等复杂轨迹，确保 UI 面积实时跳动。
    // 滑动窗口优化：路径超过 1000 点时仅扫描最新 1000 点，阻断 O(n²) 增长。
    // 1000 个点 × 3m 间隔 ≈ 3000m，正常跑步不会跑出 >3000m 不自交的环。
    // ========================================================================
    realtimeLoopCheckCounterRef.current++;
    if (realtimeLoopCheckCounterRef.current % 15 === 0 && pathRef.current.length >= 6) {
      const MAX_LOOP_SCAN_POINTS = 1000;
      const scanPath = pathRef.current.length > MAX_LOOP_SCAN_POINTS
        ? pathRef.current.slice(-MAX_LOOP_SCAN_POINTS)
        : pathRef.current;
      
      const detectedLoops = extractValidLoops(scanPath);
      
      for (const loop of detectedLoops) {
        if (loop.length < 4) continue;
        
        // 计算环的质心 (Centroid) 用于去重
        const centerLat = loop.reduce((s, p) => s + p.lat, 0) / loop.length;
        const centerLng = loop.reduce((s, p) => s + p.lng, 0) / loop.length;
        
        // 计算环的 Turf 面积
        const coords = loop.map(pt => [pt.lng, pt.lat]);
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push([...coords[0]]);
        }
        
        let loopArea = 0;
        try {
          const poly = turf.polygon([coords]);
          loopArea = turf.area(poly);
        } catch (e) {
          console.warn("[useRunningTracker] Pre-loop polygon area calc failed", e);
        }
        
        if (loopArea < 100) continue;
        
        // key = 质心精确到 4 位小数 (约 11 米精度) + 面积取整，同一个环重复检测时 key 不变，8字两环由于质心/面积不同故 key 不同
        const loopKey = `${centerLat.toFixed(4)}-${centerLng.toFixed(4)}-${Math.round(loopArea)}`;
        if (claimedLoopKeysRef.current.has(loopKey)) {
          continue;
        }

        // Check if the loop is a duplicate of any existing claimed loops
        try {
          const dupIndex = sessionClaimsRef.current.findIndex(existingLoop => 
            isDuplicatePolygon(loop as Location[], existingLoop)
          );
          
          let nextClaims: Location[][];
          if (dupIndex !== -1) {
            console.log("[Self-Intersect] 🔄 Loop is a duplicate, merging into existing claim at index", dupIndex);
            const mergedLoop = unionTwoLoops(sessionClaimsRef.current[dupIndex], loop as Location[]);
            nextClaims = [...sessionClaimsRef.current];
            nextClaims[dupIndex] = mergedLoop;
          } else {
            nextClaims = [...sessionClaimsRef.current, loop as Location[]];
          }
          
          // 标记已处理 + 更新状态
          claimedLoopKeysRef.current.add(loopKey);
          
          const newTotalArea = calculateArea(nextClaims);
          
          setSessionClaims(nextClaims);
          setClosedPolygons(nextClaims);
          useGameStore.getState().incrementLoopClosed(); // 广播断流归档信号
          setArea(newTotalArea);
          lastClaimAtRef.current = now;
          
          // 核心自愈：清空当前圈轨迹缓存，防止第二圈与第一圈产生伪自交
          pathRef.current = [];
          setPath([]);
          
          const TOAST_AREA_INCREMENT_THRESHOLD = 50;
          const incrementalArea = newTotalArea - lastToastAreaRef.current;
          if (incrementalArea >= TOAST_AREA_INCREMENT_THRESHOLD) {
            lastToastAreaRef.current = newTotalArea;
            toast.success(`🎉 领地已捕获！新增面积: ${Math.round(incrementalArea)}m²`, {
              description: '跑步记录中... 继续前进占领更多领地！',
              duration: 3000
            });
          }
        } catch (e) {
          console.warn("[useRunningTracker] Real-time loop polygon invalid", e);
        }
      }
    }

    lastLocationRef.current = finalLoc;
    setCurrentLocation(finalLoc);
    lastStepCountRef.current = currentSteps;

    console.log(`[Tracker] ✅ Point Processed: dist=${distFromLast.toFixed(1)}m | TotalDist=${distanceRef.current.toFixed(1)}m | path.length=${pathRef.current.length} | warmUp=${isWarmingUpRef.current}`);

    // Dual-Track Storage (indexedDB for offline sync)
    syncManager.enqueue({
      lat: finalLoc.lat,
      lng: finalLoc.lng,
      timestamp: now,
      accuracy: accuracy || 0,
      speed: 0,
      heading: 0,
      sequenceId: uuidv4()
    }).catch(e => console.error("[useRunningTracker] Failed to enqueue point", e));

  }, []);

  // ========================================================================
  // 核心追帧函数：从 Room 黑匣子拉取离线点位并批量注入 path
  // 三入口复用：appStateChange / 启动强制补帧 / 兜底轮询
  // ========================================================================
  const hydrateOfflinePoints = useCallback(async (sessionId: string) => {
    if (isHydratingRef.current) {
      console.warn('[Hydrate] CAS锁已占用，跳过本次触发（防竞态）');
      return;
    }

    isHydratingRef.current = true;
    const hydrateTimeout = setTimeout(() => {
      if (isHydratingRef.current) {
        console.warn('[Hydrate] ⚠️ 追帧锁超时（10s），强制释放');
        isHydratingRef.current = false;
      }
    }, 10000);

    try {
      const { AMapLocation } = await import('@/plugins/amap-location/definitions');

      // 精确 sinceTimestamp：优先使用 pathRef 最后一个点的时间戳
      let sinceTimestamp: number;
      if (pathRef.current.length > 0) {
        sinceTimestamp = pathRef.current[pathRef.current.length - 1].timestamp;
        console.log(`[Hydrate] sinceTimestamp 来源: pathRef 末点 = ${sinceTimestamp}`);
      } else {
        sinceTimestamp = useLocationStore.getState().lastLocationTimestamp;
        console.log(`[Hydrate] sinceTimestamp 来源: store.lastLocationTimestamp = ${sinceTimestamp}`);
      }

      const res = await AMapLocation.hydrateOfflinePoints({
        sessionId,
        sinceTimestamp: sinceTimestamp > 0 ? sinceTimestamp : 0,
      });
      let offlinePoints = res?.points || [];

      if (offlinePoints.length === 0) {
        console.log('[Hydrate] 无离线记录需要追帧');
        clearTimeout(hydrateTimeout);
        isHydratingRef.current = false;
        return;
      }

      console.log(`[Hydrate] 拉取到 ${offlinePoints.length} 条离线定位记录 (capped=${res.capped}), sessionId=${sessionId}`);

      // ─── 离线追帧前置几何压缩 (Douglas-Peucker Compression) ───
      if (offlinePoints.length > 500) {
        const originalCount = offlinePoints.length;
        offlinePoints = simplifyPath(offlinePoints, 0.00003) as typeof offlinePoints;
        console.log(`[Hydrate] 离线点集超过 500 点，使用 Douglas-Peucker 前置几何压缩: ${originalCount} -> ${offlinePoints.length} 点`);
      }

      // 1. Process all points to build full path (for distance & loops)
      const sortedOfflineFull: Location[] = [...offlinePoints]
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(pt => ({
          lat: pt.lat,
          lng: pt.lng,
          timestamp: pt.timestamp < 1e11 ? pt.timestamp * 1000 : pt.timestamp,
        }));

      const SPEED_LIMIT_MS = 15;
      const validOfflineFull: Location[] = [];
      let lastRefFull: Location | null = pathRef.current.length > 0 ? pathRef.current[pathRef.current.length - 1] : null;

      for (const pt of sortedOfflineFull) {
        if (lastRefFull) {
          const dist = getDistanceFromLatLonInMeters(lastRefFull.lat, lastRefFull.lng, pt.lat, pt.lng);
          const dt = Math.max((pt.timestamp - lastRefFull.timestamp) / 1000, 0.1);
          if (dist / dt > SPEED_LIMIT_MS) {
            lastRefFull = pt;
            continue;
          }
        }
        validOfflineFull.push(pt);
        lastRefFull = pt;
      }

      const currentPath = pathRef.current;
      const currentFullPath = fullPathRef.current;
      const mergedAllFull = [...currentFullPath, ...validOfflineFull];
      mergedAllFull.sort((a, b) => a.timestamp - b.timestamp);

      const dedupedPathFull: Location[] = [];
      const seenTimestampsFull = new Set<number>();
      for (let i = mergedAllFull.length - 1; i >= 0; i--) {
        const pt = mergedAllFull[i];
        if (!seenTimestampsFull.has(pt.timestamp)) {
          seenTimestampsFull.add(pt.timestamp);
          dedupedPathFull.unshift(pt);
        }
      }

      // 2. Set up chunk queue processing
      // We directly stream validOfflineFull (already DP-compressed if large) without capped replay constraints.
      const replayPoints = validOfflineFull;
      const CHUNK_SIZE = 200;
      let chunkIndex = 0;
      const totalChunks = Math.ceil(replayPoints.length / CHUNK_SIZE);
      
      let totalDistDelta = 0;
      if (dedupedPathFull.length > 0) {
        let fullDist = 0;
        for (let i = 1; i < dedupedPathFull.length; i++) {
          fullDist += getDistanceFromLatLonInMeters(dedupedPathFull[i - 1].lat, dedupedPathFull[i - 1].lng, dedupedPathFull[i].lat, dedupedPathFull[i].lng);
        }
        let curDist = 0;
        for (let i = 1; i < currentPath.length; i++) {
          curDist += getDistanceFromLatLonInMeters(currentPath[i - 1].lat, currentPath[i - 1].lng, currentPath[i].lat, currentPath[i].lng);
        }
        totalDistDelta = Math.max(0, fullDist - curDist);
      }

      const preOfflineDistance = distanceRef.current;
      const preReplayPath = currentPath;
      const preReplayFullPath = currentFullPath;

      // Initialize pathRef.current and path state with preReplayPath to prevent shrinking
      pathRef.current = preReplayPath;
      setPath([...preReplayPath]);
      fullPathRef.current = preReplayFullPath;
      setFullPath([...preReplayFullPath]);

      if (typeof window !== 'undefined' && (window as any).__injectLocationPoints) {
        (window as any).__injectLocationPoints(preReplayPath, true);
      }

      const processChunk = async () => {
        if (chunkIndex >= totalChunks) {
          // Finalize fullPathRef with full path
          fullPathRef.current = dedupedPathFull;
          setFullPath([...dedupedPathFull]);

          if (totalDistDelta > 0) {
            setDistance(prev => prev + totalDistDelta);
          }
          console.log(`[Hydrate] 批量合入完成: ${dedupedPathFull.length} 个轨迹点, 新增距离 ${totalDistDelta.toFixed(1)}m`);

          // ─── 关屏语音播报里程碑事件回放 ───
          const postOfflineDistance = preOfflineDistance + totalDistDelta;
          const startKm = Math.floor(preOfflineDistance / 1000) + 1;
          const endKm = Math.floor(postOfflineDistance / 1000);

          const missedMilestones: number[] = [];
          for (let k = startKm; k <= endKm; k++) {
            if (k > lastAnnouncedKmRef.current) {
              missedMilestones.push(k);
            }
          }

          if (missedMilestones.length > 0) {
            let cumulativeDistance = 0;
            const pathWithDistance: { distance: number; timestamp: number }[] = [];
            if (dedupedPathFull.length > 0) {
              pathWithDistance.push({ distance: 0, timestamp: dedupedPathFull[0].timestamp });
              for (let i = 1; i < dedupedPathFull.length; i++) {
                const dist = getDistanceFromLatLonInMeters(
                  dedupedPathFull[i - 1].lat,
                  dedupedPathFull[i - 1].lng,
                  dedupedPathFull[i].lat,
                  dedupedPathFull[i].lng
                );
                cumulativeDistance += dist;
                pathWithDistance.push({ distance: cumulativeDistance, timestamp: dedupedPathFull[i].timestamp });
              }
            }

            const getTimestampAtDistance = (targetDist: number): number => {
              if (pathWithDistance.length === 0) return 0;
              if (targetDist <= 0) return pathWithDistance[0].timestamp;
              if (targetDist >= cumulativeDistance) return pathWithDistance[pathWithDistance.length - 1].timestamp;
              for (let i = 1; i < pathWithDistance.length; i++) {
                const prev = pathWithDistance[i - 1];
                const curr = pathWithDistance[i];
                if (targetDist >= prev.distance && targetDist <= curr.distance) {
                  if (curr.distance === prev.distance) return prev.timestamp;
                  const ratio = (targetDist - prev.distance) / (curr.distance - prev.distance);
                  return prev.timestamp + ratio * (curr.timestamp - prev.timestamp);
                }
              }
              return pathWithDistance[pathWithDistance.length - 1].timestamp;
            };

            const speakAnnouncement = async (text: string) => {
              const voiceReportingEnabled = useGameStore.getState().appSettings?.voiceReportingEnabled ?? true;
              if (!voiceReportingEnabled) return;
              try {
                if (await isNativePlatform()) {
                  const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
                  await TextToSpeech.speak({
                    text,
                    lang: 'zh-CN',
                    rate: 1.0,
                    pitch: 1.0,
                    volume: 1.0,
                    category: 'playback',
                  });
                } else {
                  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = 'zh-CN';
                    utterance.rate = 1.0;
                    window.speechSynthesis.speak(utterance);
                  }
                }
              } catch (e) {
                console.warn('[useRunningTracker] Replay TTS error:', e);
              }
            };

            for (const k of missedMilestones) {
              const t_start = getTimestampAtDistance((k - 1) * 1000);
              const t_end = getTimestampAtDistance(k * 1000);
              const dt = Math.max((t_end - t_start) / 1000, 0.1);
              const segmentPaceStr = formatPace(dt, 1);
              const msg = `领主，您已奔袭 ${k} 公里！当前配速 ${segmentPaceStr}，势如破竹，请继续保持！`;
              console.log(`[Hydrate] Replaying missed milestone ${k}km: ${msg}`);
              speakAnnouncement(msg);
              lastAnnouncedKmRef.current = k;
            }
          }

          const latestTimestamp = dedupedPathFull[dedupedPathFull.length - 1].timestamp;
          useLocationStore.getState().setLastLocationTimestamp(latestTimestamp);

          // Run loop check on the newly hydrated path to capture any closed loops (using dedupedPathFull)
          const snapLoops = extractValidLoops(dedupedPathFull, undefined, undefined, { disableIntersect: true });
          const scanPath = dedupedPathFull.length > 1000 ? dedupedPathFull.slice(-1000) : dedupedPathFull;
          const intersectLoops = extractValidLoops(scanPath, undefined, undefined, { disableSnap: true });
          const detectedLoops = [...snapLoops, ...intersectLoops];
          
          let nextClaims = [...sessionClaimsRef.current];
          let polysAdded = false;

          for (const loop of detectedLoops) {
            if (loop.length < 4) continue;
            
            const firstPt = loop[0];
            const loopKey = `${firstPt.lat.toFixed(6)}-${firstPt.lng.toFixed(6)}-${firstPt.timestamp}`;
            if (claimedLoopKeysRef.current.has(loopKey)) continue;

            const dupIndex = nextClaims.findIndex(existingLoop => 
              isDuplicatePolygon(loop as Location[], existingLoop)
            );
            
            if (dupIndex !== -1) {
              console.log("[Hydrate] 🔄 Loop is a duplicate, merging into existing claim at index", dupIndex);
              const mergedLoop = unionTwoLoops(nextClaims[dupIndex], loop as Location[]);
              nextClaims[dupIndex] = mergedLoop;
              polysAdded = true;
            } else {
              nextClaims.push(loop as Location[]);
              polysAdded = true;
            }

            const coords = loop.map(pt => [pt.lng, pt.lat]);
            if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
              coords.push([...coords[0]]);
            }

            try {
              const poly = turf.polygon([coords]);
              const loopArea = turf.area(poly);
              if (loopArea < 100) continue;

              claimedLoopKeysRef.current.add(loopKey);
            } catch (e) {
              console.warn("[useRunningTracker] Hydrate loop polygon invalid", e);
            }
          }

          // Compute active segment post loop closures
          let maxLoopTimestamp = 0;
          for (const loop of detectedLoops) {
            for (const pt of loop) {
              if (pt.timestamp && pt.timestamp > maxLoopTimestamp) {
                maxLoopTimestamp = pt.timestamp;
              }
            }
          }

          const activeSegment = maxLoopTimestamp > 0
            ? dedupedPathFull.filter(pt => pt.timestamp > maxLoopTimestamp)
            : dedupedPathFull;

          pathRef.current = activeSegment;
          setPath([...activeSegment]);

          if (typeof window !== 'undefined' && (window as any).__injectLocationPoints) {
            (window as any).__injectLocationPoints(dedupedPathFull, true);
          }

          if (polysAdded) {
            const newTotalArea = calculateArea(nextClaims);
            setSessionClaims(nextClaims);
            setClosedPolygons(nextClaims);
            setArea(newTotalArea);
            lastClaimAtRef.current = Date.now();
          }

          clearTimeout(hydrateTimeout);
          isHydratingRef.current = false;

          if (pendingLivePointsRef.current.length > 0) {
            const pendingPoints = [...pendingLivePointsRef.current];
            pendingLivePointsRef.current = [];
            console.log(`[Hydrate] 追帧完成，开始注入缓冲队列中的 ${pendingPoints.length} 个实时点`);
            pendingPoints.forEach(pt => {
              handleLocationUpdate(pt.lat, pt.lng, undefined, pt.timestamp);
            });
          }
          return;
        }

        const currentLimit = (chunkIndex + 1) * CHUNK_SIZE;
        const chunk = replayPoints.slice(chunkIndex * CHUNK_SIZE, currentLimit);

        fullPathRef.current = [...preReplayFullPath, ...replayPoints.slice(0, currentLimit)];
        setFullPath([...fullPathRef.current]);

        pathRef.current = [...preReplayPath, ...replayPoints.slice(0, currentLimit)];
        setPath([...pathRef.current]);

        const latestPoint = chunk[chunk.length - 1];
        lastLocationRef.current = latestPoint;
        setCurrentLocation(latestPoint);

        if (typeof window !== 'undefined' && (window as any).__injectLocationPoints) {
          (window as any).__injectLocationPoints(chunk);
        }

        chunkIndex++;
        setTimeout(processChunk, 100);
      };

      processChunk();
    } catch (e) {
      clearTimeout(hydrateTimeout);
      isHydratingRef.current = false;
      console.warn('[Hydrate] 从 Room 黑匣子追帧失败（可能在 Web 环境）:', e);
    }
  }, [handleLocationUpdate]);


  // ======== CRITICAL: React to GPS location from global store ========
  // Capacitor appStateChange — reconcile timer on foreground resume & log state
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import('@capacitor/app').then(({ App }) => {
      const listenerHandle = App.addListener('appStateChange', async ({ isActive }) => {
        console.log(`[Lifecycle] appStateChange: ${isActive ? 'active' : 'background'} | time: ${new Date().toISOString()}`);

        if (isActive && isRunningRef.current && !isPausedRef.current && startTimeRef.current !== null) {
          // WebView Bridge Hydration Wait
          await new Promise<void>(resolve => setTimeout(resolve, 500));

          // Force re-calculate duration from absolute timestamp
          const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
          setDuration(pausedAccumulatorRef.current + elapsed);
          console.log('[useRunningTracker] Foreground resume — timer reconciled (after 500ms bridge wait)');

          // 入口 1：appStateChange 触发追帧
          console.log('[Hydrate] appStateChange → hydrateOfflinePoints 触发');
          await hydrateOfflinePoints(runIdempotencyKeyRef.current);
        }

        // 切后台时立即强制落盘一次
        if (!isActive && isRunningRef.current) {
          await saveState();
        }
      });
      cleanup = () => { listenerHandle.then(h => h.remove()); };
    }).catch(() => {
      // Not in Capacitor environment — no-op
    });
    return () => { cleanup?.(); };
  }, [isRunning, saveState, hydrateOfflinePoints]);

  // This is the SAME data source as TrajectoryLayer (via MapRoot.userPath)
  // FIX: Removed blanket cache filter — background GPS points from AMap SDK
  // may come with 'cache' source but are still valid for distance/area calculation.
  // Timestamp dedup is handled inside handleLocationUpdate.
  useEffect(() => {
    if (!isRunning || !gpsLocation || isStoppingRef.current) return;

    // P0 #2 — Mock 虚拟定位防御纵深：Store 层已拦截，Tracker 层再次校验（开发环境放行以支持模拟器测试）
    const isDev = process.env.NODE_ENV === 'development' ||
                  import.meta.env?.DEV ||
                  (gpsLocation as any).isDebug === true ||
                  (gpsLocation as any).isEmulator === true;
    if ((gpsLocation as any).isMock === true && !isDev) {
      console.warn('[AntiCheat] Mock location detected at tracker level, rejecting');
      setClientFlags(prev => {
        const next = [...prev, 'mock_location_detected'];
        clientFlagsRef.current = next;
        return next;
      });
      return;
    }

    // GPS location already filtered by useSafeGeolocation:
    // - 50m accuracy threshold
    // - Null Island (0,0) prevention
    // - China bounds validation
    // - WGS84 -> GCJ02 transformation
    //
    // Just pass it to handleLocationUpdate (timestamp dedup inside)
    handleLocationUpdate(
      gpsLocation.lat,
      gpsLocation.lng,
      gpsLocation.accuracy,
      gpsLocation.timestamp,
      gpsLocation.speed,
      gpsLocation.heading
    );
  }, [gpsLocation, isRunning, locationSource, handleLocationUpdate]);

  const addManualLocation = useCallback((lat: number, lng: number) => {
    // Injecting a manual location (from pre-warm anchor) ends warm-up phase immediately
    isWarmingUpRef.current = false;
    setIsWarmingUp(false);
    handleLocationUpdate(lat, lng, 0, Date.now());
  }, [handleLocationUpdate]);

  /**
   * 全生命周期预热：接收黄金起点，立即熔断 warmup 状态。
   * 该点作为跑步多边形的绝对起点，跳过传统热身等待。
   */
  const setAnchorPoint = useCallback((anchor: GeoPoint) => {
    console.log(
      `[SmartPrewarm] Anchor point received: ${anchor.lat.toFixed(6)}, ${anchor.lng.toFixed(6)} (accuracy: ${anchor.accuracy?.toFixed(1)}m)`
    );
    hasPrewarmAnchorRef.current = true;
    isWarmingUpRef.current = false;
    setIsWarmingUp(false);

    // 将黄金起点注入为上一个有效位置，后续移动将基于此点计算位移
    lastLocationRef.current = {
      lat: anchor.lat,
      lng: anchor.lng,
      timestamp: anchor.timestamp ?? Date.now(),
      accuracy: anchor.accuracy,
    };
    setCurrentLocation(lastLocationRef.current);

    // 同步将 anchor 坐标作为首点推入 pathRef.current 并更新 state，解决起跑 3m 轨迹断层问题
    const startLoc: Location = {
      lat: anchor.lat,
      lng: anchor.lng,
      timestamp: anchor.timestamp ?? Date.now(),
      accuracy: anchor.accuracy,
    };
    pathRef.current = [startLoc];
    setPath([startLoc]);
    fullPathRef.current = [startLoc];
    setFullPath([startLoc]);
    setDisplayPath([startLoc]);

    if (typeof window !== 'undefined' && (window as any).__injectLocationPoints) {
      (window as any).__injectLocationPoints([startLoc], true);
    }
  }, []);

  // Wake Lock (keep screen on during run)
  useEffect(() => {
    let wakeLock: unknown = null;
    const requestWakeLock = async () => {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && isRunning && !isPaused && !isStoppingRef.current) {
        try {
          wakeLock = await (navigator as unknown as { wakeLock: { request: (type: string) => Promise<unknown> } }).wakeLock.request('screen');
        } catch (err: unknown) {
          const error = err as { name?: string; message?: string };
          console.error(`[useRunningTracker] Wake Lock error: ${error.name}, ${error.message}`);
        }
      }
    };
    requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunningRef.current && !isPausedRef.current && !isStoppingRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (wakeLock && typeof wakeLock === 'object' && 'release' in wakeLock) {
        (wakeLock as { release: () => void }).release();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, isPaused]);

  // Background Service Management (Keep-Alive + Notification)
  useEffect(() => {
    let activeWatcherId: string | null = null;

    const manageService = async () => {
      if (isRunning && !isPaused && !isStoppingRef.current) {
        // Start Background Service
        console.log('[useRunningTracker] Starting Background Service...');
        const voiceEnabled = useGameStore.getState().appSettings?.voiceReportingEnabled ?? true;
        activeWatcherId = await LocationService.startTracking(userId, runIdempotencyKeyRef.current, voiceEnabled);
        watcherIdRef.current = activeWatcherId;
      } else {
        // Stop Background Service
        if (watcherIdRef.current) {
          console.log('[useRunningTracker] Stopping Background Service');
          await LocationService.stopTracking(watcherIdRef.current);
          watcherIdRef.current = null;
        }
      }
    };

    manageService();

    return () => {
      if (activeWatcherId) {
        LocationService.stopTracking(activeWatcherId);
      }
    };
  }, [isRunning, isPaused, userId]);

  // ========================================================================
  // 入口 2：启动强制补帧 — 解决"起步即锁屏"短路问题
  // isRunning 变为 true 后，等待 Native Service 就绪，立刻追帧一次
  // ========================================================================
  useEffect(() => {
    if (!isRunning || isStoppingRef.current) return;

    let cancelled = false;

    const startupHydrate = async () => {
      // 等待 Native Service 启动并产出第一个点位（轮询探测）
      const POLL_INTERVAL_MS = 300;
      const MAX_WAIT_MS = 5000;
      const maxRetries = Math.floor(MAX_WAIT_MS / POLL_INTERVAL_MS);
      let retries = 0;

      while (retries < maxRetries && !cancelled) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

        try {
          const { AMapLocation } = await import('@/plugins/amap-location/definitions');
          const res = await AMapLocation.getOfflineLocations({
            sessionId: runIdempotencyKeyRef.current,
          });

          if (res?.count > 0) {
            console.log(`[StartupHydrate] Native Service 已就绪，发现 ${res.count} 个离线点位`);
            break;
          }
        } catch {
          // Web 环境或插件未就绪，静默跳过
        }

        retries++;
      }

      if (cancelled) return;

      if (retries >= maxRetries) {
        console.warn('[StartupHydrate] Native Service 超时未产出点位，仍尝试追帧（可能无数据）');
      }

      // 无论是否有数据，都执行一次追帧（hydrateOfflinePoints 内部会处理空数据场景）
      await hydrateOfflinePoints(runIdempotencyKeyRef.current);
    };

    startupHydrate();

    return () => {
      cancelled = true;
    };
  }, [isRunning, hydrateOfflinePoints]);

  // ========================================================================
  // 入口 3：兜底轮询 — 每 30 秒检查一次 Room 是否有堆积点位
  // 终极保障：即使 appStateChange 未触发，也能定期补帧
  // ========================================================================
  useEffect(() => {
    if (!isRunning || isPaused || isStoppingRef.current) return;

    const interval = setInterval(() => {
      // 静默追帧，不阻塞主流程
      hydrateOfflinePoints(runIdempotencyKeyRef.current).catch((e) => {
        console.warn('[FallbackPoll] 兜底追帧失败:', e);
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, hydrateOfflinePoints]);

  // Recovery on start — CRITICAL: reset isStoppingRef first!
  useEffect(() => {
    if (isRunning) {
      isStoppingRef.current = false;

      const performRecovery = async () => {
        if (justRecoveredRef.current) {
          console.log('[Session] already recovered on mount, skipping double recovery');
          return;
        }

        let recoveryJson: string | null = null;
        try {
          const res = await Preferences.get({ key: RECOVERY_KEY });
          recoveryJson = res.value;
        } catch(e: unknown) { console.warn('Preferences get error', e); }
        let recovered = false;
        let restoreSource = 'none';

        // 1. Try Preferences
        if (recoveryJson) {
          try {
            const data = JSON.parse(recoveryJson);
            const lastSaveTime = data.timestamp || Date.now();
            const elapsedMs = Date.now() - lastSaveTime;

            // Enforce 4 hours limit
            if (elapsedMs >= 4 * 60 * 60 * 1000) {
              console.log("[Session] Found session in Preferences but older than 4 hours. Cleaning up.");
              Preferences.remove({ key: RECOVERY_KEY }).catch(console.warn);
              return;
            }

            const rawPath = Array.isArray(data.path) ? data.path : [];
            const safePath = rawPath.filter(
              (p: any) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)
            );
            const hasRealData = safePath.length > 0 && ((data.distance || 0) > 0 || (data.duration || 0) > 5);
            
            if (data.idempotencyKey && hasRealData) {
              console.log(`[Session] attempting restore from storage | key: ${data.idempotencyKey}`);
              
              runIdempotencyKeyRef.current = data.idempotencyKey;
              setSavedRunId(data.runId || null);
              savedRunIdRef.current = data.runId || null;
              setPath(safePath);
              setDisplayPath(safePath);
              setDistance(data.distance || 0);
              const restoredDuration = data.duration || 0;
              setDuration(restoredDuration);
              setClosedPolygons(data.closedPolygons || []);
              setEventsHistory(Array.isArray(data.eventsHistory) ? data.eventsHistory : []);
              setCurrentSteps(Number(data.totalSteps || 0));
              setRunIsValid(data.runIsValid ?? true);
              setAntiCheatLog(data.antiCheatLog ?? null);
              setArea(data.area || 0);
              lastAnnouncedKmRef.current = data.lastAnnouncedKm !== undefined ? data.lastAnnouncedKm : Math.floor((data.distance || 0) / 1000);
              
              const isPausedNow = data.status === 'paused';
              setIsPaused(isPausedNow);
              
              // --- CRITICAL: Time Gap Handling (Anti-Pace-Corruption) ---
              // If we were killed, the time between 'timestamp' (last save) 
              // and 'now' should be treated as PAUSED time.
              const lastSaveTime = data.timestamp || Date.now();
              const gapSeconds = Math.max(0, Math.floor((Date.now() - lastSaveTime) / 1000));
              
              if (gapSeconds > 30) {
                console.log(`[Session] detected ${gapSeconds}s gap since last save — shifting to pausedAccumulator`);
                pausedAccumulatorRef.current = (data.pausedAccumulator ?? restoredDuration);
                // gapSeconds is implicitly added to pausedAccumulatorRef via setDuration and pausedAccumulatorRef.current update if needed,
                // but for simplicity, we just freeze the duration at restoredDuration and treat the rest as a pause.
                startTimeRef.current = null; 
                setIsPaused(true); // Always force pause if gap is significant
              } else {
                pausedAccumulatorRef.current = data.pausedAccumulator ?? restoredDuration;
                startTimeRef.current = data.startTime || null;
              }
              
              const rawFullPath = Array.isArray(data.fullPath) ? data.fullPath : [];
              const safeFullPath = rawFullPath.filter(
                (p: any) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)
              );
              const finalFullPath = safeFullPath.length > 0 ? safeFullPath : safePath;

              fullPathRef.current = finalFullPath;
              setFullPath(finalFullPath);
              
              if (safePath.length > 0) {
                const lastLoc = safePath[safePath.length - 1];
                lastLocationRef.current = lastLoc;
                pathRef.current = safePath;
                setCurrentLocation(lastLoc);
              }
              recovered = true;
              restoreSource = 'storage';
              kalmanLatRef.current.reset();
              kalmanLngRef.current.reset();
              refLocationRef.current = null;
            }
          } catch (e) {
            console.error("[useRunningTracker] LocalStorage recovery failed", e);
          }
        }

        // 2. Try Native Mirror if LocalStorage failed but store says we are running
        if (!recovered && await isNativePlatform()) {
          try {
            const { safeAMapGetSessionMirror } = await import('@/lib/capacitor/safe-plugins');
            const mirror = await safeAMapGetSessionMirror();
            if (mirror && mirror.isRunning && mirror.runStartTime) {
              const elapsed = Math.floor((Date.now() - mirror.runStartTime) / 1000);
              if (mirror.runPath) {
                // If native mirror has path, use it for recovery
                const rawMirrorPath = Array.isArray(mirror.runPath) ? mirror.runPath : [];
                const safeMirrorPath = rawMirrorPath.filter(
                  (p: any) => p && typeof p.lat === 'number' && typeof p.lng === 'number'
                );
                fullPathRef.current = safeMirrorPath;
                setFullPath(safeMirrorPath);
                pathRef.current = safeMirrorPath;
                setPath(safeMirrorPath);
              }
              if (elapsed > 0 && elapsed < 86400) {
                setDuration(elapsed);
                pausedAccumulatorRef.current = elapsed;
                startTimeRef.current = mirror.runStartTime;
                recovered = true;
                restoreSource = 'native';
                kalmanLatRef.current.reset();
                kalmanLngRef.current.reset();
                refLocationRef.current = null;
                lastAnnouncedKmRef.current = 0;
                toast.success('已从原生服务恢复后台跑步会话');
              }
            }
          } catch (e) {
            console.warn('[useRunningTracker] Native recovery attempt failed', e);
          }
        }

        console.log(`[Session] restored: ${recovered} | source: ${restoreSource}`);
        if (recovered) {
          justRecoveredRef.current = true;
        }

        if (!recovered) {
          // Force-reset ALL state for a clean start
          setIsPaused(false);
          setPath([]);
          setFullPath([]);
          fullPathRef.current = [];
          setDistance(0);
          setDuration(0);
          setClosedPolygons([]);
          setEventsHistory([]);
          setSessionClaims([]);
          setCurrentSteps(0);
          setRunIsValid(undefined);
          setAntiCheatLog(undefined);
          setArea(0);
          setCurrentLocation(null);
          lastLocationRef.current = null;
          pathRef.current = [];
          pausedAccumulatorRef.current = 0;
          runIdempotencyKeyRef.current = uuidv4();
          lastAnnouncedKmRef.current = 0;
          // Reset Kalman filters for clean start
          kalmanLatRef.current.reset();
          kalmanLngRef.current.reset();
          refLocationRef.current = null;
          // ⚠️ CRITICAL: Recovery effect runs AFTER the Timer effect (both on [isRunning]).
          // Timer effect set startTimeRef.current = Date.now(), but then recovery
          // reset it to null — causing all timer ticks to bail out (stale-clock bug).
          // Fix: Re-initialize startTimeRef to NOW so the timer can count correctly.
          startTimeRef.current = Date.now();
        }

        // 注入 currentRunId 到 useLocationStore，供亮屏追帧（Hydration）使用
        useLocationStore.getState().setCurrentRunId(runIdempotencyKeyRef.current);
      };

      performRecovery();
    }
  }, [isRunning]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const next = !prev;
      if (!next) {
        wasPausedRef.current = true;
      }
      setTimeout(saveState, 0); // 低优先同步落盘
      return next;
    });
  }, [saveState]);

  const stop = useCallback(() => {
    setIsPaused(true);
    saveState();
    isStoppingRef.current = true;
  }, [saveState]);

  const finalize = useCallback(() => {
    console.log('[DEBUG:RunningTracker] finalize (Store Reset) STARTED');
    // Note: Do NOT clear pollingIntervalRef here to keep backend settlement polling alive after run exit.
    Preferences.remove({ key: RECOVERY_KEY }).catch(console.warn);
    setPath([]);
    setFullPath([]);
    setDistance(0);
    setDuration(0);
    setClosedPolygons([]);
    setSessionClaims([]);
    setEventsHistory([]);
    setCurrentSteps(0);
    setArea(0);
    setSavedRunId(null);
    setCurrentLocation(null);
    lastLocationRef.current = null;
    pathRef.current = [];
    fullPathRef.current = [];
    sessionClaimsRef.current = [];
    closedPolygonsRef.current = [];
    eventsHistoryRef.current = [];
    currentStepsRef.current = 0;
    areaRef.current = 0;
    distanceRef.current = 0;
    durationRef.current = 0;
    savedRunIdRef.current = null;
    pausedAccumulatorRef.current = 0;
    startTimeRef.current = null;
    runIdempotencyKeyRef.current = uuidv4();
    lastAnnouncedKmRef.current = 0;
    pedometerBaselineRef.current = null;
    lastToastAreaRef.current = 0;
    lastClaimAtRef.current = 0;
    validPointsCountRef.current = 0;
    firstPointAtRef.current = null;
    isWarmingUpRef.current = true;
    hasPrewarmAnchorRef.current = false;
    isHydratingRef.current = false;
    realtimeLoopCheckCounterRef.current = 0;
    claimedLoopKeysRef.current = new Set();
    kalmanLatRef.current.reset();
    kalmanLngRef.current.reset();
    refLocationRef.current = null;
    // 清理 currentRunId，防止下次跑步追帧时拉取旧数据
    useLocationStore.getState().setCurrentRunId(null);
    console.log('[DEBUG:RunningTracker] finalize (Store Reset) FINISHED. distance resets to 0');
  }, []);

  const clearRecovery = useCallback(() => {
    Preferences.remove({ key: RECOVERY_KEY }).catch(console.warn);
  }, []);

  const distanceKm = distance / 1000;
  const pace = formatPace(duration, distanceKm);
  const durationStr = formatDuration(duration);
  const calories = Math.round(distanceKm * 70 * 1.036);

  // --- Persistence & Auto-Save ---
  // (State declarations moved to top)

  // Core save function — reads from REFS to avoid stale closures after sleep
  const saveRun = useCallback(async (isFinal: boolean = false) => {
    if (!userId) {
      console.warn("[saveRun] No userId, skipping save");
      return { settlingAsync: false, isDuplicate: false, runId: undefined };
    }

    // ������ Read LIVE values from refs ������
    let liveDistance = distanceRef.current;
    let liveDuration = durationRef.current;
    let livePath = fullPathRef.current;
    let liveClaims = sessionClaimsRef.current;

    // ������ Payload �����������Իָ� ������
    if (livePath.length === 0 && liveDistance <= 0 && liveDuration <= 0) {
      console.warn("[useRunningTracker] Payload empty �� attempting recovery fallback");
      try {
        const res = await Preferences.get({ key: RECOVERY_KEY });
        if (res.value) {
          const data = JSON.parse(res.value);
          liveDistance = data.distance || 0;
          liveDuration = data.duration || 0;
          const rawPath = Array.isArray(data.fullPath || data.path) ? (data.fullPath || data.path) : [];
          livePath = rawPath.filter(
            (p: any) => p && typeof p.lat === "number" && typeof p.lng === "number"
              && Number.isFinite(p.lat) && Number.isFinite(p.lng)
          );
          liveClaims = Array.isArray(data.closedPolygons) ? data.closedPolygons : [];
        }
      } catch (recoveryErr) {
        console.error("[useRunningTracker] Recovery fallback parse failed", recoveryErr);
      }

      if (livePath.length === 0 && liveDistance <= 0 && liveDuration <= 0) {
        console.warn("[saveRun] Data empty after recovery �� returning silent fallback");
        return { settlingAsync: false, isDuplicate: false, runId: undefined };
      }
    }

    /** ͳһ�ı��ض�����Ӻ���������ʧ��·����ͨ���˺������������� throw */
    const _enqueueSilently = async (reason: string): Promise<{ settlingAsync: false; isDuplicate: false; runId: undefined }> => {
      console.warn(`[saveRun] Falling back to local queue. Reason: ${reason}`);
      const stepsVal = currentStepsRef.current > 0
        ? currentStepsRef.current
        : estimateStepsFromDistanceMeters(liveDistance);
      const payload = {
        userId,
        clubId: clubId ?? null,
        idempotencyKey: runIdempotencyKeyRef.current,
        distance: liveDistance,
        duration: liveDuration,
        path: livePath,
        polygons: liveClaims,
        timestamp: Date.now(),
        totalSteps: stepsVal,
        steps: stepsVal,
        manualLocationCount: 0,
        eventsHistory: eventsHistoryRef.current,
        clientFlags: clientFlagsRef.current,
      };
      try {
        const enqueued = await settlementRetryQueue.enqueueSettlement(payload);
        if (enqueued === false) {
          console.log("[saveRun] idempotencyKey already in queue �� treating as success (idempotent)");
        } else {
          console.log("[saveRun] Payload enqueued to SettlementRetryQueue successfully");
          if (isFinal) {
            toast.info("���粻�ѣ��ܲ������Ѱ�ȫ���棬��������ָ����Զ��ϴ�", { duration: 5000 });
          }
        }
      } catch (queueErr) {
        console.error("[saveRun] IndexedDB enqueue failed, falling back to localStorage:", queueErr);
        try {
          const stored = JSON.parse(localStorage.getItem("PENDING_RUN_UPLOAD") || "[]");
          const idx = stored.findIndex((p: any) => p.idempotencyKey === payload.idempotencyKey);
          if (idx >= 0) stored[idx] = payload; else stored.push(payload);
          localStorage.setItem("PENDING_RUN_UPLOAD", JSON.stringify(stored));
          console.log("[saveRun] Payload saved to localStorage PENDING_RUN_UPLOAD as last resort");
        } catch (lsErr) {
          console.error("[saveRun] localStorage fallback also failed:", lsErr);
        }
      }
      if (isFinal) {
        clearRecovery();
        setSessionClaims([]);
        sessionClaimsRef.current = [];
        setEventsHistory([]);
        setClientFlags([]);
        clientFlagsRef.current = [];
      }
      return { settlingAsync: false, isDuplicate: false, runId: undefined };
    };

    const maxRetries = 3;
    const retryDelays = [1000, 2000, 4000];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let controller: AbortController | undefined;
      let timeoutId: NodeJS.Timeout | undefined;
      try {
        setIsSaving(true);

        const SIMPLIFY_THRESHOLD = 2000;
        const SIMPLIFY_TOLERANCE = 0.00005;
        let simplifiedPath: Location[] = livePath;
        if (livePath.length > SIMPLIFY_THRESHOLD) {
          simplifiedPath = simplifyPath(livePath, SIMPLIFY_TOLERANCE) as Location[];
          console.log(
            `[Simplify] ??? Path reduced: ${livePath.length} �� ${simplifiedPath.length} points ` +
            `(${((1 - simplifiedPath.length / livePath.length) * 100).toFixed(1)}% reduction)`
          );
        }

        const stepsForSubmit = currentStepsRef.current > 0
          ? currentStepsRef.current
          : estimateStepsFromDistanceMeters(liveDistance);

        const PAYLOAD_SIZE_WARNING = 3_800_000;
        const MAX_POINTS_AFTER_TRUNCATION = 200;
        const MAX_EVENTS_AFTER_TRUNCATION = 50;

        let finalPath: Location[] = simplifiedPath;
        let finalEvents = eventsHistoryRef.current;

        const runData = {
          clubId: clubId ?? null,
          idempotencyKey: runIdempotencyKeyRef.current,
          distance: liveDistance,
          duration: liveDuration,
          path: simplifiedPath,
          polygons: liveClaims,
          timestamp: Date.now(),
          totalSteps: stepsForSubmit,
          steps: stepsForSubmit,
          manualLocationCount: 0,
          eventsHistory: eventsHistoryRef.current,
          clientFlags: clientFlagsRef.current,
        };
        const payloadSize = JSON.stringify(runData).length;

        if (payloadSize > PAYLOAD_SIZE_WARNING) {
          console.warn(`[PayloadPreCheck] Payload size ${payloadSize} bytes exceeds 3.8MB threshold, forcing secondary truncation`);
          if (simplifiedPath.length > MAX_POINTS_AFTER_TRUNCATION) {
            const step = Math.ceil(simplifiedPath.length / MAX_POINTS_AFTER_TRUNCATION);
            finalPath = simplifiedPath.filter((_, idx) => idx % step === 0 || idx === simplifiedPath.length - 1);
          }
          if (eventsHistoryRef.current.length > MAX_EVENTS_AFTER_TRUNCATION) {
            finalEvents = eventsHistoryRef.current.slice(-MAX_EVENTS_AFTER_TRUNCATION);
          }
          toast.warning("�ܲ����ݹ������Զ�ѹ���켣�Ա�֤�ϴ��ɹ�");
        }

        controller = new AbortController();
        timeoutId = setTimeout(() => {
          controller!.abort();
          _enqueueSilently("AbortTimeout 120s").catch(() => {});
          console.warn("[AbortTimeout] 120s timeout triggered");
        }, 120_000);

        const { saveRunActivity } = await import('@/app/actions/run-service');
        const finalRunData = {
          idempotencyKey: runIdempotencyKeyRef.current,
          distance: liveDistance,
          duration: liveDuration,
          path: finalPath,
          polygons: liveClaims,
          timestamp: Date.now(),
          totalSteps: stepsForSubmit,
          steps: stepsForSubmit,
          manualLocationCount: 0,
          eventsHistory: finalEvents,
          clientFlags: clientFlagsRef.current,
        };
        
        const actionResult = await saveRunActivity(userId, finalRunData as any, clubId ?? null);
        
        if (!actionResult || !actionResult.success) {
          throw new Error(actionResult?.error || "Save failed");
        }
        
        const result = { success: true, data: actionResult };

        clearTimeout(timeoutId);
        timeoutId = undefined;

        if (result.success) {
          if (isFinal) {
            clearRecovery();
            setEventsHistory([]);
            setClientFlags([]);
            clientFlagsRef.current = [];
            mutate("/api/home/summary");
            mutate("/api/mission/fetch-user-missions");
            mutate((key) => typeof key === "string" && key.startsWith("/api/v1/runs/history"));
            window.dispatchEvent(new CustomEvent("citylord:refresh-runs"));

            if (!result.data?.settlingAsync) {
              mutate(
                (key) => typeof key === "string" && key.startsWith("/api/v1/territories?cityId="),
                undefined, { revalidate: true }
              ).then(() => {
                setSessionClaims([]);
                sessionClaimsRef.current = [];
              });
              window.dispatchEvent(new CustomEvent("citylord:refresh-territories"));
            }
          }

          if (result.data?.runId) { setSavedRunId(result.data.runId); savedRunIdRef.current = result.data.runId; }
          if (result.data?.runNumber) setRunNumber(result.data.runNumber);
          if (result.data?.damageSummary) setDamageSummary(result.data.damageSummary);
          if (result.data?.maintenanceSummary) setMaintenanceSummary(result.data.maintenanceSummary);
          if (result.data?.settledTerritoriesCount !== undefined) setSettledTerritoriesCount(result.data.settledTerritoriesCount);
          if (result.data?.isValid !== undefined) setRunIsValid(result.data.isValid);
          if (result.data?.antiCheatLog !== undefined) setAntiCheatLog(result.data.antiCheatLog ?? null);
          if (result.data?.totalSteps !== undefined) setCurrentSteps(Math.max(0, Number(result.data.totalSteps)));

          if (result.data?.settlingAsync) {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = setInterval(async () => {
              try {
                if (!savedRunIdRef.current) return;
                const pollResult = await fetchShim(`/api/v1/runs/${savedRunIdRef.current}/status`);
                if (pollResult.ok) {
                  const data = await pollResult.json();
                  if (data.status === "COMPLETED") {
                    clearInterval(pollingIntervalRef.current!);
                    pollingIntervalRef.current = null;
                    if (data.settledTerritoriesCount !== undefined) {
                      setSettledTerritoriesCount(data.settledTerritoriesCount);
                    }
                    mutate((key) => typeof key === "string" && key.startsWith("/api/v1/runs/history"));
                    window.dispatchEvent(new CustomEvent("citylord:refresh-runs"));
                    mutate(
                      (key) => typeof key === "string" && key.startsWith("/api/v1/territories?cityId="),
                      undefined, { revalidate: true }
                    ).then(() => {
                      setSessionClaims([]);
                      sessionClaimsRef.current = [];
                    });
                    window.dispatchEvent(new CustomEvent("citylord:refresh-territories"));
                    toast.success("��ؽ�������ɣ�", { duration: 4000 });
                  } else if (data.status === "FAILED") {
                    clearInterval(pollingIntervalRef.current!);
                    pollingIntervalRef.current = null;
                    toast.error("��ؽ���ʧ��");
                  }
                }
              } catch (pollErr) {
                console.warn("[useRunningTracker] Settlement poll failed", pollErr);
              }
            }, 2000);
          }
          
          return {
            settlingAsync: result.data?.settlingAsync,
            isDuplicate: result.data?.isDuplicate,
            runId: result.data?.runId,
            runNumber: result.data?.runNumber,
            damageSummary: result.data?.damageSummary,
            maintenanceSummary: result.data?.maintenanceSummary,
            settledTerritoriesCount: result.data?.settledTerritoriesCount,
            territories: result.data?.territories,
          };
        } else {
          console.error("[saveRun] Server returned error:", result.error);
          return await _enqueueSilently(`server_error: ${result.error}`);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error(`[saveRun] attempt ${attempt + 1}/${maxRetries} error:`, err?.message || err);

        if (err?.isAuthError === true || err?.message === "UNAUTHORIZED") {
          console.warn("[saveRun] Auth error detected �� silently enqueuing and exiting");
          return await _enqueueSilently("auth_error_401");
        }

        if (attempt >= maxRetries - 1) {
          return await _enqueueSilently(`max_retries_exceeded: ${err?.message}`);
        }

        const delay = retryDelays[attempt];
        await new Promise(resolve => setTimeout(resolve, delay));
      } finally {
        setIsSaving(false);
      }
    }

    return await _enqueueSilently("loop_exhausted");
  }, [userId, clearRecovery, clubId]);

  // Auto-save when new territory is claimed
  useEffect(() => {
    if (sessionClaims.length > lastSavedClaimsCount) {
      saveState(); // 使用安全的本地备份代替网络提前提交
      setLastSavedClaimsCount(sessionClaims.length);
    }
  }, [sessionClaims.length, lastSavedClaimsCount, saveState]);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  const recoverUnfinishedSession = useCallback(async () => {
    try {
      const res = await Preferences.get({ key: RECOVERY_KEY });
      if (!res.value) return null;
      const data = JSON.parse(res.value);
      const lastSaveTime = data.timestamp || Date.now();
      const elapsedMs = Date.now() - lastSaveTime;

      // 4小时（14400000ms）内未结算的 Session 自愈
      if (elapsedMs < 4 * 60 * 60 * 1000) {
        console.log(`[recoverUnfinishedSession] Found valid session from ${new Date(lastSaveTime).toISOString()}`);
        
        const rawPath = Array.isArray(data.path) ? data.path : [];
        const safePath = rawPath.filter(
          (p: any) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)
        );

        runIdempotencyKeyRef.current = data.idempotencyKey || uuidv4();
        setSavedRunId(data.runId || null);
        savedRunIdRef.current = data.runId || null;
        setPath(safePath);
        setDisplayPath(safePath);

        const rawFullPath = Array.isArray(data.fullPath) ? data.fullPath : [];
        const safeFullPath = rawFullPath.filter(
          (p: any) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)
        );
        const finalFullPath = safeFullPath.length > 0 ? safeFullPath : safePath;
        fullPathRef.current = finalFullPath;
        setFullPath(finalFullPath);
        setDistance(data.distance || 0);
        distanceRef.current = data.distance || 0;
        
        const restoredDuration = data.duration || 0;
        setDuration(restoredDuration);
        durationRef.current = restoredDuration;
        
        setClosedPolygons(data.closedPolygons || []);
        closedPolygonsRef.current = data.closedPolygons || [];
        
        setEventsHistory(Array.isArray(data.eventsHistory) ? data.eventsHistory : []);
        eventsHistoryRef.current = Array.isArray(data.eventsHistory) ? data.eventsHistory : [];
        
        setCurrentSteps(Number(data.totalSteps || 0));
        currentStepsRef.current = Number(data.totalSteps || 0);
        
        setRunIsValid(data.runIsValid ?? true);
        setAntiCheatLog(data.antiCheatLog ?? null);
        setArea(data.area || 0);
        areaRef.current = data.area || 0;
        
        lastAnnouncedKmRef.current = data.lastAnnouncedKm !== undefined ? data.lastAnnouncedKm : Math.floor((data.distance || 0) / 1000);
        
        const isPausedNow = data.status === 'paused';
        setIsPaused(isPausedNow);
        isPausedRef.current = isPausedNow;
        
        pausedAccumulatorRef.current = data.pausedAccumulator ?? restoredDuration;
        startTimeRef.current = data.startTime || data.startedAt || null;
        
        if (safePath.length > 0) {
          const lastLoc = safePath[safePath.length - 1];
          lastLocationRef.current = lastLoc;
          pathRef.current = safePath;
          setCurrentLocation(lastLoc);
        }
        
        justRecoveredRef.current = true;
        useLocationStore.getState().setCurrentRunId(runIdempotencyKeyRef.current);
        
        toast.success("已自动恢复 4 小时内未结算的跑步记录！");
        return data;
      } else {
        console.log("[recoverUnfinishedSession] Discarding session older than 4 hours");
        await Preferences.remove({ key: RECOVERY_KEY }).catch(console.warn);
      }
    } catch (e) {
      console.error("[recoverUnfinishedSession] Failed to recover session:", e);
    }
    return null;
  }, []);

  // Estimated steps: 1.3 steps per meter (average walking/running cadence)
  const estimatedSteps = Math.floor(distance * 1.3); // distance is in meters here
  const finalSteps = currentSteps > 0 ? currentSteps : estimatedSteps;

  return {
    distance: distanceKm,
    pace,
    duration: durationStr,
    calories,
    currentLocation,
    path,
    displayPath,
    isPaused,
    togglePause,
    stop,
    clearRecovery,
    rawDuration: duration,
    area,
    closedPolygons,
    sessionClaims,
    addManualLocation,
    setAnchorPoint,
    isSyncing: isSaving,
    saveRun, // Expose for manual final save
    finalize, // Phase B cleanup
    // Raw data contract (preferred for calculations)
    distanceMeters: distance, // raw meters
    durationSeconds: duration, // raw seconds
    steps: finalSteps,
    savedRunId, // Expose the run ID for photo upload and sharing
    runNumber,
    damageSummary,
    maintenanceSummary,
    settledTerritoriesCount,
    runIsValid,
    antiCheatLog,
    idempotencyKey: runIdempotencyKeyRef.current,
    eventsHistory,
    clientFlags,
    settlementStatus,
    activeRandomEvent: activeEvent,
    randomEventCountdownSeconds: countdownSeconds,
    isGPSWeak,
    lastAnnouncedKm: lastAnnouncedKmRef.current,
    recoverUnfinishedSession,
  };
}

function chaikinSmooth(points: Location[], iterations: number = 2): Location[] {
  if (points.length < 3) return points;

  let result = [...points];

  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: Location[] = [{ ...result[0] }];

    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i];
      const p1 = result[i + 1];

      smoothed.push({
        lat: 0.75 * p0.lat + 0.25 * p1.lat,
        lng: 0.75 * p0.lng + 0.25 * p1.lng,
        timestamp: Math.round(0.75 * p0.timestamp + 0.25 * (p1.timestamp ?? Date.now())),
      });

      smoothed.push({
        lat: 0.25 * p0.lat + 0.75 * p1.lat,
        lng: 0.25 * p0.lng + 0.75 * p1.lng,
        timestamp: Math.round(0.25 * p0.timestamp + 0.75 * (p1.timestamp ?? Date.now())),
      });
    }

    smoothed.push({ ...result[result.length - 1] });
    result = smoothed;
  }

  return result;
}


