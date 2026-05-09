import { useState, useEffect, useRef, useCallback } from 'react';
import { mutate } from 'swr';
import { LocationService } from '@/utils/locationService';
import * as turf from '@turf/turf';
import { KalmanFilter1D } from '@/lib/kalman-filter';
import { simplifyPath } from '@/lib/geo/simplify-path';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { toast } from 'sonner';
import { syncManager } from '@/lib/sync/SyncManager';
import { uploadTrajectoryBatch } from '@/app/actions/sync';
import { saveRunActivity } from '@/app/actions/run-service';
import { v4 as uuidv4 } from 'uuid';
import { isNativePlatform, safeGetBatteryInfo } from "@/lib/capacitor/safe-plugins";
import type { GeoPoint } from '@/hooks/useSafeGeolocation';
import {
  useLocationStore,
  GPS_START_ANCHOR_ACCURACY_METERS,
  GPS_TRACKING_ACCURACY_METERS,
} from '@/store/useLocationStore';
import { getDistanceFromLatLonInMeters, LOOP_CLOSURE_THRESHOLD_M, isLoopClosed, MIN_LOOP_POINTS, extractValidLoops } from '@/lib/geometry-utils';
import { shouldAcceptPointByDistance } from '@/lib/location/gps-spatial-filter';
import { validateSegmentSpeed } from '@/lib/location/gps-speed-validator';
import { ActiveRandomEvent, useRandomEvents } from '@/hooks/useRandomEvents';
import { RunEventLog } from '@/types/run-sync';
import type { CapacitorPedometerPlugin } from '@capgo/capacitor-pedometer';
import { useGameStore } from '@/store/useGameStore';
import { Preferences } from '@capacitor/preferences';
import { settlementRetryQueue } from '@/lib/sync/SettlementRetryQueue';
import { getRunSettlementStatus } from '@/app/actions/run-service';

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

const MIN_WARMUP_POINTS = process.env.NODE_ENV === 'development' ? 1 : 2;
const WARMUP_TIMEOUT_MS = process.env.NODE_ENV === 'development' ? 2000 : 5000;
const CLOCK_DRIFT_TOLERANCE_MS = 5000;

export interface Location {
  lat: number;
  lng: number;
  timestamp: number;
}

interface RunningStats {
  // Formatted display values (legacy)
  distance: number; // km (legacy, use distanceMeters for calculations)
  pace: string; // "mm:ss"
  duration: string; // "HH:MM:SS"
  calories: number;
  path: Location[];
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
  isSyncing: boolean;
  saveRun: (isFinal?: boolean) => Promise<{ settlingAsync?: boolean; isDuplicate?: boolean; runId?: string; territories?: { id: string }[] } | void>;
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
  const [closedPolygons, setClosedPolygons] = useState<Location[][]>([]);
  const [sessionClaims, setSessionClaims] = useState<Location[][]>([]); // NEW: Claimed territories
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [area, setArea] = useState(0); // m²
  const [isWarmingUp, setIsWarmingUp] = useState(true);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const clubId = useGameStore((s) => s.clubId);

  const isStoppingRef = useRef(false);
  const lastLocationRef = useRef<Location | null>(null);
  const pathRef = useRef<Location[]>([]);
  const isPausedRef = useRef(isPaused);
  const lastClaimAtRef = useRef(0);
  /** 阈值锁：记录上次弹窗时的 newTotalArea（m²），防止 GPS 边界漂移频繁骚视 */
  const lastToastAreaRef = useRef(0);
  const validPointsCountRef = useRef(0);
  const firstPointAtRef = useRef<number | null>(null);
  /** 防重入锁：防止多次 appStateChange 触发重复分帧注入 */
  const isHydratingRef = useRef(false);
  /** 缓冲队列：追帧期间拦截的实时 GPS 点，追帧完成后统一消费 */
  const pendingLivePointsRef = useRef<Location[]>([]);

  // ─── Live-snapshot refs (always current, immune to stale closures) ───
  const distanceRef = useRef(distance);
  const durationRef = useRef(duration);
  const sessionClaimsRef = useRef(sessionClaims);
  const closedPolygonsRef = useRef(closedPolygons);
  const areaRef = useRef(area);
  const isWarmingUpRef = useRef(true);
  const realtimeLoopCheckCounterRef = useRef(0);
  const claimedLoopKeysRef = useRef<Set<string>>(new Set());

  // ─── Kalman Filters (replace legacy EMA smoothing) ───
  const kalmanLatRef = useRef(new KalmanFilter1D(3.0, 25.0));
  const kalmanLngRef = useRef(new KalmanFilter1D(3.0, 25.0));

  // ─── Timestamp-based timer refs ───
  const startTimeRef = useRef<number | null>(null);
  const pausedAccumulatorRef = useRef(0); // Accumulated seconds before latest pause

  // Sync refs — keep refs in lockstep with React state
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { distanceRef.current = distance; }, [distance]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { sessionClaimsRef.current = sessionClaims; }, [sessionClaims]);
  useEffect(() => { closedPolygonsRef.current = closedPolygons; }, [closedPolygons]);
  useEffect(() => { areaRef.current = area; }, [area]);
  useEffect(() => { isWarmingUpRef.current = isWarmingUp; }, [isWarmingUp]);

  // Idempotency key for the current run
  const runIdempotencyKeyRef = useRef<string>(uuidv4());

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

  // Network Listener
  useEffect(() => {
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

        setIsSyncing(true);
        const result = await uploadTrajectoryBatch(batch);

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
          setCurrentSteps(Math.max(0, rawSteps - baseline));
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
    if (isRunning && !isPaused && !isStoppingRef.current) {
      // Start (or resume) the clock
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
      
      const tick = () => {
        if (startTimeRef.current === null) return;
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const totalDuration = pausedAccumulatorRef.current + elapsed;
        setDuration(totalDuration);
      };

      tick(); // Immediate first tick (reconciles after sleep)
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    } else if (isPaused && startTimeRef.current !== null) {
      // Freeze: accumulate elapsed time into the accumulator
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      pausedAccumulatorRef.current += elapsed;
      startTimeRef.current = null;
      
      // Sync state immediately on pause
      setDuration(pausedAccumulatorRef.current);
    }
    return undefined;
  }, [isRunning, isPaused]);



  // --- Persistence & Auto-Save Function ---
  const saveState = useCallback(() => {
    if (!isRunning || isStoppingRef.current) return;
    try {
      const stateToSave = {
        runId: savedRunIdRef.current, 
        idempotencyKey: runIdempotencyKeyRef.current,
        path: pathRef.current || [],
        distance: distanceRef.current,
        duration: durationRef.current,
        pausedAccumulator: pausedAccumulatorRef.current,
        isRunning: isRunning, // 必需字段
        status: isPausedRef.current ? 'paused' : 'running', // 状态明细
        startTime: startTimeRef.current,
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
        restoreSource: 'storage'
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

  // ─── Kalman-based GPS Smoothing (replaces legacy EMA) ───
  const smoothLocation = (newLoc: Location, prevLoc: Location | null, accuracy?: number): Location => {
    if (!prevLoc) {
      kalmanLatRef.current.filter(newLoc.lat, newLoc.timestamp, accuracy);
      kalmanLngRef.current.filter(newLoc.lng, newLoc.timestamp, accuracy);
      if (process.env.NODE_ENV === 'development') {
        lastLocationRef.current = newLoc;
      }
      return newLoc;
    }

    const smoothedLat = kalmanLatRef.current.filter(newLoc.lat, newLoc.timestamp, accuracy);
    const smoothedLng = kalmanLngRef.current.filter(newLoc.lng, newLoc.timestamp, accuracy);

    return {
      lat: smoothedLat,
      lng: smoothedLng,
      timestamp: newLoc.timestamp
    };
  };

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
      
      return turf.area(merged);
    } catch (e) {
      console.warn("[useRunningTracker] Invalid polygon for area calculation, falling back to previous area", e);
      return areaRef.current;
    }
  }, []);

  const handleLocationUpdate = useCallback((lat: number, lng: number, accuracy?: number, timestamp?: number, isOfflineReplay: boolean = false) => {
    // 如果当前正在进行异步追帧，将实时点推入缓冲队列并立刻返回
    if (isHydratingRef.current) {
      pendingLivePointsRef.current.push({ lat, lng, timestamp: timestamp || Date.now() });
      return;
    }

    if (isPausedRef.current || isStoppingRef.current) return;

    const now = timestamp || Date.now();

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
    // ================================================================

    if (isAwaitingAnchor) {
      if (typeof accuracy !== 'number' || accuracy > GPS_START_ANCHOR_ACCURACY_METERS) {
        console.debug(
          `[GPS-Filter] ❌ Anchor REJECT: accuracy ${typeof accuracy === 'number' ? accuracy.toFixed(0) : 'unknown'}m > ${GPS_START_ANCHOR_ACCURACY_METERS}m threshold`
        );
        return;
      }
    } else if (accuracy != null && accuracy > GPS_TRACKING_ACCURACY_METERS) {
      console.debug(`[GPS-Filter] ❌ Layer 1 REJECT: accuracy ${accuracy.toFixed(0)}m > ${GPS_TRACKING_ACCURACY_METERS}m threshold`);
      return;
    }

    // --- Layer 2: Speed Filter ---
    // Calculate speed between this point and last valid point
    // If speed > 10 m/s (~36 km/h), this is signal drift, not human movement
    if (lastLocationRef.current) {
      const prevLoc = lastLocationRef.current;
      const distToPrev = getDistanceFromLatLonInMeters(prevLoc.lat, prevLoc.lng, lat, lng);
      const timeDiffSec = (now - prevLoc.timestamp) / 1000;

      if (!isOfflineReplay && timeDiffSec > 0.5) {
        const speedMs = distToPrev / timeDiffSec;
        if (speedMs > 10) {
          console.debug(
            `[GPS-Filter] ❌ Layer 2 REJECT: speed ${(speedMs * 3.6).toFixed(1)}km/h > 36km/h | ` +
            `dist=${distToPrev.toFixed(1)}m dt=${timeDiffSec.toFixed(1)}s`
          );
          return;
        }
      }

    }

    // ================================================================
    // Filters passed — this is a valid GPS point candidate
    // ================================================================

    let newLoc: Location = { lat, lng, timestamp: now };

    // Apply Kalman Smoothing (pass accuracy for dynamic R adjustment)
    newLoc = smoothLocation(newLoc, lastLocationRef.current, accuracy);

    const finalLoc = newLoc;

    // --- Phase 2: Warm-up & Jitter Filter ---
    if (isWarmingUpRef.current) {
      if (firstPointAtRef.current === null) {
        firstPointAtRef.current = now;
      }
      validPointsCountRef.current++;

      // Stop warming up after timeout OR minimum high-accuracy points
      if (now - firstPointAtRef.current > WARMUP_TIMEOUT_MS || validPointsCountRef.current >= MIN_WARMUP_POINTS) {
        setIsWarmingUp(false);
        console.log(`[GPS-Filter] ✅ Warm-up complete (${validPointsCountRef.current} points, ${now - firstPointAtRef.current}ms). Starting track.`);
      } else {
        // Still warming up: update current location for UI but don't record to path
        lastLocationRef.current = finalLoc;
        setCurrentLocation(finalLoc);
        return;
      }
    }

    // --- Phase 3: Spatial Debounce (3m threshold) ---
    if (lastLocationRef.current) {
      const distFromLast = getDistanceFromLatLonInMeters(
        lastLocationRef.current.lat,
        lastLocationRef.current.lng,
        finalLoc.lat,
        finalLoc.lng
      );
      if (distFromLast < 3.0) {
        // Point is too close to last point, probably jitter while stationary
        return;
      }
    }

    const spatialFilterResult = shouldAcceptPointByDistance(
      lastLocationRef.current
        ? { lat: lastLocationRef.current.lat, lng: lastLocationRef.current.lng }
        : null,
      { lat: finalLoc.lat, lng: finalLoc.lng }
    );

    if (!spatialFilterResult.accept) {
      console.debug('[GPS Filter] Dropped point:', spatialFilterResult.reason);
      return;
    }

    if (lastLocationRef.current && lastLocationRef.current.timestamp) {
      const speedResult = validateSegmentSpeed(
        lastLocationRef.current.lat,
        lastLocationRef.current.lng,
        lastLocationRef.current.timestamp,
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

    // ========================================================================
    // 🎯 SMART LOOP CLOSURE (智能吸附) - UPDATED LOGIC
    // ========================================================================
    // 
    // NEW BEHAVIOR: Loop closure is now an EVENT, not a stop condition.
    // The runner CONTINUES tracking after claiming territory.
    //
    // Key Changes:
    // 1. Snapped point used ONLY for polygon calculation (area claim)
    // 2. Actual GPS point (newLoc) added to path (no teleportation)
    // 3. Claimed polygon stored in sessionClaims (for rendering)
    // 4. Tracking NEVER stops - user keeps running
    //
    // This matches real gameplay: claiming territory is just a milestone
    // during a continuous run, not the end of the run.
    // ========================================================================

    const MIN_LOOP_SIZE = 5;
    const SNAP_THRESHOLD = LOOP_CLOSURE_THRESHOLD_M;
    const P_SHAPE_MIN_POINT_GAP = 15;
    const MIN_CLAIM_INTERVAL_MS = 3000;

    let loopForCalc: Location[] | null = null;
    const currentPath = pathRef.current;

    if (currentPath.length >= MIN_LOOP_SIZE) {
      const latestPoint = turf.point([newLoc.lng, newLoc.lat]);
      let pShapeAnchorIndex = -1;

      for (let i = 0; i < currentPath.length; i++) {
        if (currentPath.length - i <= P_SHAPE_MIN_POINT_GAP) {
          continue;
        }
        const historical = currentPath[i];
        const historicalPoint = turf.point([historical.lng, historical.lat]);
        const gapMeters = turf.distance(latestPoint, historicalPoint, { units: 'kilometers' }) * 1000;
        if (gapMeters <= SNAP_THRESHOLD) {
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
      } else {
        const startPoint = currentPath[0];
        const distToStart = getDistanceFromLatLonInMeters(newLoc.lat, newLoc.lng, startPoint.lat, startPoint.lng);
        if (distToStart <= SNAP_THRESHOLD) {
          const snappedLoc: Location = {
            lat: startPoint.lat,
            lng: startPoint.lng,
            timestamp: now
          };
          loopForCalc = [...currentPath, snappedLoc];
          console.log(`[Smart Snap] 🎯 Snapped to start! Distance: ${Math.round(distToStart)}m`);
        }
      }
    }

    if (loopForCalc && loopForCalc.length > MIN_LOOP_SIZE && now - lastClaimAtRef.current >= MIN_CLAIM_INTERVAL_MS) {

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
            const nextClaims = [...sessionClaimsRef.current, loopForCalc];
            const newTotalArea = calculateArea(nextClaims);
            
            setSessionClaims(nextClaims);
            setClosedPolygons(prevPolys => [...prevPolys, loopForCalc!]);
            setArea(newTotalArea);
            lastClaimAtRef.current = now;

            const closingPoint = loopForCalc[loopForCalc.length - 1];
            const currentPathForSync = pathRef.current;
            const lastPoint = currentPathForSync[currentPathForSync.length - 1];
            if (!lastPoint || closingPoint.lat !== lastPoint.lat || closingPoint.lng !== lastPoint.lng) {
              const updatedPath = [...currentPathForSync, closingPoint];
              pathRef.current = updatedPath;
              setPath(updatedPath);
            }

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

    // Add ACTUAL GPS point to path (seamless continuation)
    // TODO: 引入 Douglas-Peucker 算法进行轨迹抽稀（tolerance=3m）
    // 长距离跑步（>10km）时 pathRef 可能积累数千个点，导致内存溢出与 GeoJSON 序列化超时
    // 建议在 pathRef.current.length > 500 时触发一次增量抽稀
    const updatedPath = [...pathRef.current, finalLoc];
    pathRef.current = updatedPath;
    setPath(updatedPath);

    // ========================================================================
    // 🔄 REAL-TIME SELF-INTERSECTION LOOP DETECTION (with throttling)
    // ========================================================================
    // 每累计 5 个 GPS 点触发一次 extractValidLoops 自交检测，
    // 覆盖 P 形环、8 字形等复杂轨迹，确保 UI 面积实时跳动。
    // Strategy B 为 O(n) 复杂度，1500 点内性能开销可接受。
    // ========================================================================
    realtimeLoopCheckCounterRef.current++;
    if (realtimeLoopCheckCounterRef.current % 5 === 0 && pathRef.current.length >= 6) {
      const detectedLoops = extractValidLoops(pathRef.current);
      
      for (const loop of detectedLoops) {
        if (loop.length < 4) continue;
        
        // 去重 key：使用环首点的 lat/lng/timestamp 三元组，比 index 更稳定
        const firstPt = loop[0];
        const loopKey = `${firstPt.lat.toFixed(6)}-${firstPt.lng.toFixed(6)}-${firstPt.timestamp}`;
        if (claimedLoopKeysRef.current.has(loopKey)) {
          continue;
        }
        
        // 计算面积，过滤微小环
        const coords = loop.map(pt => [pt.lng, pt.lat]);
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push([...coords[0]]);
        }
        
        try {
          const poly = turf.polygon([coords]);
          const loopArea = turf.area(poly);
          if (loopArea < 100) continue;
          
          // 标记已处理 + 更新状态
          claimedLoopKeysRef.current.add(loopKey);
          
          const nextClaims = [...sessionClaimsRef.current, loop as Location[]];
          const newTotalArea = calculateArea(nextClaims);
          
          setSessionClaims(nextClaims);
          setClosedPolygons(prevPolys => [...prevPolys, loop as Location[]]);
          setArea(newTotalArea);
          lastClaimAtRef.current = now;
          
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

    if (lastLocationRef.current) {
      const dist = getDistanceFromLatLonInMeters(
        lastLocationRef.current.lat,
        lastLocationRef.current.lng,
        finalLoc.lat,
        finalLoc.lng
      );
      setDistance(prev => prev + dist);
    }

    lastLocationRef.current = finalLoc;
    setCurrentLocation(finalLoc);

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

    try {
      const { AMapLocation } = await import('@/plugins/amap-location/definitions');
      const res = await AMapLocation.getOfflineLocations({ sessionId });
      const offlinePoints = res?.locations || [];

      if (offlinePoints.length === 0) {
        console.log('[Hydrate] 无离线记录需要追帧');
        return;
      }

      console.log(`[Hydrate] 拉取到 ${offlinePoints.length} 条离线定位记录, sessionId=${sessionId}`);

      // 1. 先对所有离线点进行时间戳排序
      const sortedOffline = [...offlinePoints].sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp);

      // 2. 提取离线区间边界
      const offlineStart = sortedOffline[0].timestamp;
      const offlineEnd = sortedOffline[sortedOffline.length - 1].timestamp;

      // 3. 截断出前置路径和后置路径（核心手术刀）
      const currentPath = pathRef.current;
      const prePath = currentPath.filter(p => p.timestamp < offlineStart);
      const postPath = currentPath.filter(p => p.timestamp > offlineEnd);

      // 4. 对离线点进行速度异常值滤波
      const SPEED_LIMIT_MS = 15; // 15m/s (约 54km/h，跑步/骑行极限)
      const validOffline: Location[] = [];
      let lastRef = prePath.length > 0 ? prePath[prePath.length - 1] : null;

      for (const pt of sortedOffline) {
        if (lastRef) {
          const dist = getDistanceFromLatLonInMeters(lastRef.lat, lastRef.lng, pt.lat, pt.lng);
          const dt = Math.max((pt.timestamp - lastRef.timestamp) / 1000, 0.1);
          if (dist / dt > SPEED_LIMIT_MS) continue; // 剔除漂移点
        }
        validOffline.push({ lat: pt.lat, lng: pt.lng, timestamp: pt.timestamp });
        lastRef = validOffline[validOffline.length - 1];
      }

      if (validOffline.length === 0) {
        console.log('[Hydrate] 所有离线点均为异常漂移点，已剔除');
        await AMapLocation.acknowledgeLocations({ ids: offlinePoints.map((p: { id: number }) => p.id) });
        isHydratingRef.current = false;
        return;
      }

      // 5. 分批渲染逻辑适配（三段拼接 Chunking）
      const CHUNK_SIZE = 30;
      let chunkIndex = 0;
      const totalChunks = Math.ceil(validOffline.length / CHUNK_SIZE);
      let totalDistDelta = 0;

      console.log(`[Hydrate] 三段拼接法: prePath=${prePath.length} 点, validOffline=${validOffline.length} 点, postPath=${postPath.length} 点, 共 ${totalChunks} 个批次`);

      const processChunk = async () => {
        if (chunkIndex >= totalChunks) {
          // 全部批次完成
          if (totalDistDelta > 0) {
            setDistance(prev => prev + totalDistDelta);
          }
          console.log(`[Hydrate] 批量合入完成: ${validOffline.length} 个轨迹点, 新增距离 ${totalDistDelta.toFixed(1)}m`);

          await AMapLocation.acknowledgeLocations({ ids: offlinePoints.map((p: { id: number }) => p.id) })
            .then((ackResult) => {
              console.log(`[Hydrate] ACK 完成: ${ackResult.acknowledged} 条记录已确认`);
            })
            .catch((ackErr) => {
              console.warn('[Hydrate] ACK 失败（数据不会丢失，下次苏醒自动重试）:', ackErr);
            });

          // 释放追帧锁（必须先释放，否则后续 flush 会死循环拦截）
          isHydratingRef.current = false;

          // 消费并清空缓冲队列中的实时点
          if (pendingLivePointsRef.current.length > 0) {
            const pendingPoints = [...pendingLivePointsRef.current];
            pendingLivePointsRef.current = [];
            console.log(`[Hydrate] 追帧完成，开始注入缓冲队列中的 ${pendingPoints.length} 个实时点`);

            // 依次将缓冲点重新塞入主处理流水线，完美复用距离/闭合计算逻辑
            pendingPoints.forEach(pt => {
              handleLocationUpdate(pt.lat, pt.lng, undefined, pt.timestamp);
            });
          }
          return;
        }

        const currentLimit = (chunkIndex + 1) * CHUNK_SIZE;
        const offlineChunk = validOffline.slice(chunkIndex * CHUNK_SIZE, currentLimit);

        // 计算本批次新增距离
        let chunkDistDelta = 0;
        const firstPointInChunk = offlineChunk[0];
        const refForChunk = chunkIndex === 0 && prePath.length > 0
          ? prePath[prePath.length - 1]
          : (chunkIndex > 0 ? validOffline[chunkIndex * CHUNK_SIZE - 1] : null);

        if (refForChunk) {
          const dist = getDistanceFromLatLonInMeters(refForChunk.lat, refForChunk.lng, firstPointInChunk.lat, firstPointInChunk.lng);
          chunkDistDelta += dist;
        }
        for (let i = 1; i < offlineChunk.length; i++) {
          const dist = getDistanceFromLatLonInMeters(offlineChunk[i - 1].lat, offlineChunk[i - 1].lng, offlineChunk[i].lat, offlineChunk[i].lng);
          chunkDistDelta += dist;
        }
        totalDistDelta += chunkDistDelta;

        // 三段拼接：完美保留锁屏前、锁屏期间、以及解锁后瞬间到达的点
        const builtSoFar = [
          ...prePath,
          ...validOffline.slice(0, currentLimit),
          ...postPath
        ];

        pathRef.current = builtSoFar;
        setPath(builtSoFar);

        // 更新 lastLocationRef 和 currentLocation 为当前最新点
        const latestPoint = validOffline[validOffline.length > currentLimit ? currentLimit - 1 : validOffline.length - 1];
        lastLocationRef.current = latestPoint;
        setCurrentLocation(latestPoint);

        chunkIndex++;
        requestAnimationFrame(() => setTimeout(processChunk, 16));
      };

      processChunk();
    } catch (e) {
      isHydratingRef.current = false;
      console.warn('[Hydrate] 从 Room 黑匣子追帧失败（可能在 Web 环境）:', e);
    }
  }, []);


  // ======== CRITICAL: React to GPS location from global store ========
  // Capacitor appStateChange — reconcile timer on foreground resume & log state
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import('@capacitor/app').then(({ App }) => {
      const listenerHandle = App.addListener('appStateChange', async ({ isActive }) => {
        console.log(`[Lifecycle] appStateChange: ${isActive ? 'active' : 'background'} | time: ${new Date().toISOString()}`);

        if (isActive && isRunning && !isPausedRef.current && startTimeRef.current !== null) {
          // WebView Bridge Hydration Wait
          await new Promise<void>(resolve => setTimeout(resolve, 500));

          // Force re-calculate duration from absolute timestamp
          const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
          setDuration(pausedAccumulatorRef.current + elapsed);
          console.log('[useRunningTracker] Foreground resume — timer reconciled (after 500ms bridge wait)');

          // 入口 1：appStateChange 触发追帧
          await hydrateOfflinePoints(runIdempotencyKeyRef.current);
        }

        // 切后台时立即强制落盘一次
        if (!isActive && isRunning) {
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
      gpsLocation.timestamp
    );
  }, [gpsLocation, isRunning, locationSource, handleLocationUpdate]);

  const addManualLocation = useCallback((lat: number, lng: number) => {
    handleLocationUpdate(lat, lng, 0, Date.now());
  }, [handleLocationUpdate]);

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
      if (document.visibilityState === 'visible' && isRunning && !isPaused && !isStoppingRef.current) {
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
        activeWatcherId = await LocationService.startTracking(userId, runIdempotencyKeyRef.current);
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
              setDistance(data.distance || 0);
              const restoredDuration = data.duration || 0;
              setDuration(restoredDuration);
              setClosedPolygons(data.closedPolygons || []);
              setEventsHistory(Array.isArray(data.eventsHistory) ? data.eventsHistory : []);
              setCurrentSteps(Number(data.totalSteps || 0));
              setRunIsValid(data.runIsValid ?? true);
              setAntiCheatLog(data.antiCheatLog ?? null);
              setArea(data.area || 0);
              
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
              if (elapsed > 0 && elapsed < 86400) {
                setDuration(elapsed);
                pausedAccumulatorRef.current = elapsed;
                startTimeRef.current = mirror.runStartTime;
                recovered = true;
                restoreSource = 'native';
                kalmanLatRef.current.reset();
                kalmanLngRef.current.reset();
                toast.success('已从原生服务恢复后台跑步会话');
              }
            }
          } catch (e) {
            console.warn('[useRunningTracker] Native recovery attempt failed', e);
          }
        }

        console.log(`[Session] restored: ${recovered} | source: ${restoreSource}`);

        if (!recovered) {
          // Force-reset ALL state for a clean start
          setIsPaused(false);
          setPath([]);
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
          // Reset Kalman filters for clean start
          kalmanLatRef.current.reset();
          kalmanLngRef.current.reset();
          // ⚠️ CRITICAL: Recovery effect runs AFTER the Timer effect (both on [isRunning]).
          // Timer effect set startTimeRef.current = Date.now(), but then recovery
          // reset it to null — causing all timer ticks to bail out (stale-clock bug).
          // Fix: Re-initialize startTimeRef to NOW so the timer can count correctly.
          startTimeRef.current = Date.now();
        }
      };

      performRecovery();
    }
  }, [isRunning]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const next = !prev;
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
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    Preferences.remove({ key: RECOVERY_KEY }).catch(console.warn);
    setPath([]);
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
    pedometerBaselineRef.current = null;
    lastToastAreaRef.current = 0;
    lastClaimAtRef.current = 0;
    validPointsCountRef.current = 0;
    firstPointAtRef.current = null;
    isWarmingUpRef.current = true;
    isHydratingRef.current = false;
    realtimeLoopCheckCounterRef.current = 0;
    claimedLoopKeysRef.current = new Set();
    kalmanLatRef.current.reset();
    kalmanLngRef.current.reset();
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
      if (isFinal) throw new Error("未登录或获取不到用户ID");
      return;
    }

    // ─── Read LIVE values from refs (immune to stale closures) ───
    let liveDistance = distanceRef.current;
    let liveDuration = durationRef.current;
    let livePath = pathRef.current;
    let liveClaims = sessionClaimsRef.current;

    // ─── Payload validation: guard against empty/zombie state ───
    if (livePath.length === 0 && liveDistance <= 0 && liveDuration <= 0) {
      console.warn('[useRunningTracker] Payload empty — attempting recovery fallback');
      try {
        const res = await Preferences.get({ key: RECOVERY_KEY });
        const recoveryJson = res.value;
        if (recoveryJson) {
          const data = JSON.parse(recoveryJson);
          liveDistance = data.distance || 0;
          liveDuration = data.duration || 0;
          const rawPath = Array.isArray(data.path) ? data.path : [];
          livePath = rawPath.filter(
            (p: any) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)
          );
          liveClaims = Array.isArray(data.closedPolygons) ? data.closedPolygons : [];
          console.log('[useRunningTracker] Recovery fallback payload used');
        }
      } catch (recoveryErr) {
        console.error('[useRunningTracker] Recovery fallback parse failed', recoveryErr);
      }
      // If STILL empty after recovery, block final save
      if (livePath.length === 0 && liveDistance <= 0 && liveDuration <= 0) {
        if (isFinal) throw new Error('跑步数据异常：无定位记录且无可恢复数据');
        return;
      }
    }

    try {
      setIsSaving(true);

      // ================================================================
      // 🗜️ TRAJECTORY SIMPLIFICATION — 超长轨迹抽稀
      // 当轨迹点超过 2000 时，使用 Douglas-Peucker 算法进行压缩，
      // 防止 GeoJSON 序列化超时与 Server Action payload 过大。
      // tolerance=0.00005 ≈ 5m（在 10km 跑步中可将 10000 点压缩至 ~800 点）
      // ================================================================
      const SIMPLIFY_THRESHOLD = 2000;
      const SIMPLIFY_TOLERANCE = 0.00005;
      let simplifiedPath = livePath;
      if (livePath.length > SIMPLIFY_THRESHOLD) {
        simplifiedPath = simplifyPath(livePath, SIMPLIFY_TOLERANCE);
        console.log(
          `[Simplify] 🗜️ Path reduced: ${livePath.length} → ${simplifiedPath.length} points ` +
          `(${((1 - simplifiedPath.length / livePath.length) * 100).toFixed(1)}% reduction)`
        );
      }

      const stepsForSubmit = currentStepsRef.current > 0
        ? currentStepsRef.current
        : estimateStepsFromDistanceMeters(liveDistance);
      const result = await saveRunActivity(userId, {
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
      } as any);

      if (result.success) {
        console.log(`[useRunningTracker] Save successful | runId: ${result.data?.runId}`);
        
        if (isFinal) {
          clearRecovery();
          setSessionClaims([]);
          sessionClaimsRef.current = [];
          setEventsHistory([]);
          setClientFlags([]);
          clientFlagsRef.current = [];
          
          mutate('/api/home/summary');
          mutate('/api/mission/fetch-user-missions');
          mutate(
            (key) => typeof key === 'string' && key.startsWith('/api/city/fetch-territories?cityId='),
            undefined,
            { revalidate: true }
          );
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('citylord:refresh-territories'));
          }
          console.log('[useRunningTracker] Triggered SWR mutation for sync');
        }
        
        if (result.data?.runId) {
          setSavedRunId(result.data.runId);
          savedRunIdRef.current = result.data.runId;
        }
        if (result.data?.runNumber) {
          setRunNumber(result.data.runNumber);
        }
        if (result.data?.damageSummary) {
          setDamageSummary(result.data.damageSummary);
        }
        if (result.data?.maintenanceSummary) {
          setMaintenanceSummary(result.data.maintenanceSummary);
        }
        if (result.data?.settledTerritoriesCount !== undefined) {
          setSettledTerritoriesCount(result.data.settledTerritoriesCount);
        }
        if (result.data?.isValid !== undefined) {
          setRunIsValid(result.data.isValid);
        }
        if (result.data?.antiCheatLog !== undefined) {
          setAntiCheatLog(result.data.antiCheatLog ?? null);
        }
        if (result.data?.totalSteps !== undefined) {
          setCurrentSteps(Math.max(0, Number(result.data.totalSteps)));
        }
        if (isFinal) {
          console.log("Run saved successfully:", result.data?.runId);
        }

        if (result.data?.newTasks && result.data.newTasks.length > 0) {
          const tasks = result.data.newTasks;
          const totalCoins = tasks.reduce((sum, t) => sum + t.reward, 0);
          toast.success(`达成 ${tasks.length} 个目标!`, {
            description: `获得 +${totalCoins} 金币`,
          });
        }
        
        if (result.data?.settlingAsync && result.data?.runId) {
          setSettlementStatus('pending');
          let pollCount = 0;
          const runIdToPoll = result.data.runId;
          pollingIntervalRef.current = setInterval(async () => {
            pollCount++;
            if (pollCount > 30) {
              setSettlementStatus('timeout');
              if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
              return;
            }
            try {
              const statusResult = await getRunSettlementStatus(runIdToPoll);
              if (statusResult.success && statusResult.data) {
                if (statusResult.data.isSettled) {
                  setSettlementStatus('completed');
                  if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                  setSettledTerritoriesCount(statusResult.data.newTerritories);
                }
              }
            } catch (pollErr) {
              console.warn('[useRunningTracker] Settlement poll failed', pollErr);
            }
          }, 2000);
        }
        
        return { settlingAsync: result.data?.settlingAsync, isDuplicate: result.data?.isDuplicate, runId: result.data?.runId };
      } else {
        console.error("Save failed:", result.error);
        if (isFinal) {
          const payload = {
            userId,
            clubId: clubId ?? null,
            idempotencyKey: runIdempotencyKeyRef.current,
            distance: liveDistance,
            duration: liveDuration,
            path: livePath,
            polygons: liveClaims,
            timestamp: Date.now(),
            totalSteps: stepsForSubmit,
            steps: stepsForSubmit,
            manualLocationCount: 0,
            eventsHistory: eventsHistoryRef.current,
            clientFlags: clientFlagsRef.current,
          };
          const enqueued = await settlementRetryQueue.enqueueSettlement(payload);
          if (enqueued) {
            toast.info('网络不佳，跑步数据已安全保存，将在网络恢复后自动上传');
            clearRecovery();
            setSessionClaims([]);
            sessionClaimsRef.current = [];
            setEventsHistory([]);
            setClientFlags([]);
            clientFlagsRef.current = [];
            return { settlingAsync: false, isDuplicate: false, runId: undefined };
          }
          throw new Error(result.error || "Save failed");
        }
      }
    } catch (err) {
      console.error("Save error:", err);
      if (isFinal) {
        const stepsForSubmit = currentStepsRef.current > 0
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
          totalSteps: stepsForSubmit,
          steps: stepsForSubmit,
          manualLocationCount: 0,
          eventsHistory: eventsHistoryRef.current,
          clientFlags: clientFlagsRef.current,
        };
        const enqueued = await settlementRetryQueue.enqueueSettlement(payload);
        if (enqueued) {
          toast.info('网络异常，跑步数据已安全保存，将在网络恢复后自动上传');
          clearRecovery();
          setSessionClaims([]);
          sessionClaimsRef.current = [];
          setEventsHistory([]);
          setClientFlags([]);
          clientFlagsRef.current = [];
          return { settlingAsync: false, isDuplicate: false, runId: undefined };
        }
        throw err;
      }
    } finally {
      setIsSaving(false);
    }
  }, [userId, clearRecovery, clubId]); // Only depends on userId/clubId & clearRecovery — refs handle the rest

  // Auto-save when new territory is claimed
  useEffect(() => {
    if (sessionClaims.length > lastSavedClaimsCount) {
      saveState(); // 使用安全的本地备份代替网络提前提交
      setLastSavedClaimsCount(sessionClaims.length);
    }
  }, [sessionClaims.length, lastSavedClaimsCount, saveState]);

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
    isPaused,
    togglePause,
    stop,
    clearRecovery,
    rawDuration: duration,
    area,
    closedPolygons,
    sessionClaims,
    addManualLocation,
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
  };
}
