import { useState, useEffect, useRef, useCallback } from 'react';
import { mutate } from 'swr';
import { LocationService } from '@/utils/locationService';
import * as turf from '@turf/turf';
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
import { getDistanceFromLatLonInMeters, LOOP_CLOSURE_THRESHOLD_M, isLoopClosed } from '@/lib/geometry-utils';
import { shouldAcceptPointByDistance } from '@/lib/location/gps-spatial-filter';
import { ActiveRandomEvent, useRandomEvents } from '@/hooks/useRandomEvents';
import { RunEventLog } from '@/types/run-sync';
import type { CapacitorPedometerPlugin } from '@capgo/capacitor-pedometer';
import { useGameStore } from '@/store/useGameStore';
import { Preferences } from '@capacitor/preferences';

const RECOVERY_KEY = 'CURRENT_RUN_RECOVERY';

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
  saveRun: (isFinal?: boolean) => Promise<{ settlingAsync?: boolean } | void>;
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

  // ─── Live-snapshot refs (always current, immune to stale closures) ───
  const distanceRef = useRef(distance);
  const durationRef = useRef(duration);
  const sessionClaimsRef = useRef(sessionClaims);
  const closedPolygonsRef = useRef(closedPolygons);
  const areaRef = useRef(area);
  const isWarmingUpRef = useRef(true);

  // ─── Timestamp-based timer refs ───
  const startTimeRef = useRef<number | null>(null);
  const pausedAccumulatorRef = useRef(0); // Accumulated seconds before latest pause

  // Sync refs — keep refs in lockstep with React state
  useEffect(() => { pathRef.current = path; }, [path]);
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
  const [runNumber, setRunNumber] = useState<number | undefined>(undefined);
  const [damageSummary, setDamageSummary] = useState<any[] | undefined>(undefined);
  const [maintenanceSummary, setMaintenanceSummary] = useState<any[] | undefined>(undefined);
  const [settledTerritoriesCount, setSettledTerritoriesCount] = useState<number | undefined>(undefined);
  const [runIsValid, setRunIsValid] = useState<boolean | undefined>(undefined);
  const [antiCheatLog, setAntiCheatLog] = useState<string | null | undefined>(undefined);
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
    const handleOnline = () => setIsOnline(true);
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
        runId: savedRunId, 
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
  }, [antiCheatLog, isRunning, runIsValid, savedRunId]);

  // Periodic Save (Every 10 seconds per Revised Plan)
  useEffect(() => {
    if (!isRunning || isStoppingRef.current) return;
    
    const interval = setInterval(saveState, 5000);
    return () => clearInterval(interval);
  }, [isRunning, saveState]);

  // Weighted Smoothing
  const smoothLocation = (newLoc: Location, prevLoc: Location | null): Location => {
    if (!prevLoc) return newLoc;
    const weight = 0.7; // Trust new point 70%

    return {
      lat: prevLoc.lat * (1 - weight) + newLoc.lat * weight,
      lng: prevLoc.lng * (1 - weight) + newLoc.lng * weight,
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
    if (isPausedRef.current || isStoppingRef.current) return;

    const now = timestamp || Date.now();
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

    // Apply Smoothing
    if (lastLocationRef.current) {
      newLoc = smoothLocation(newLoc, lastLocationRef.current);
    }

    const finalLoc = newLoc;

    // --- Phase 2: Warm-up & Jitter Filter ---
    if (isWarmingUpRef.current) {
      if (firstPointAtRef.current === null) {
        firstPointAtRef.current = now;
      }
      validPointsCountRef.current++;

      // Stop warming up after 8 seconds OR 3 continuous high-accuracy points
      if (now - firstPointAtRef.current > 8000 || validPointsCountRef.current >= 3) {
        setIsWarmingUp(false);
        console.log('[GPS-Filter] ✅ Warm-up complete. Starting track.');
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

    const MIN_LOOP_SIZE = 10;
    const SNAP_THRESHOLD = LOOP_CLOSURE_THRESHOLD_M;
    const P_SHAPE_MIN_POINT_GAP = 15;
    const MIN_CLAIM_INTERVAL_MS = 12000;

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
        if (!loopCheck.isClosed) {
          return;
        }
        const coords = loopForCalc.map(pt => [pt.lng, pt.lat]);
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
            coords.push([...coords[0]]);
        }
        const poly = turf.polygon([coords]);
        const loopArea = turf.area(poly);

        if (loopArea > 100) {
          // Recalculate total combined area
          const nextClaims = [...sessionClaimsRef.current, loopForCalc];
          const newTotalArea = calculateArea(nextClaims);
          
          setSessionClaims(nextClaims);
          setClosedPolygons(prevPolys => [...prevPolys, loopForCalc!]);
          setArea(newTotalArea);
          lastClaimAtRef.current = now;

          // 阈值锁：只有总面积比上次弹窗时增加了至少 50m² 才再次弹出 Toast。
          // 防止 GPS 边界漂移（少数几平米的微小封闭圆）触发视觉骚扰。
          const TOAST_AREA_INCREMENT_THRESHOLD = 50; // m²
          if (newTotalArea - lastToastAreaRef.current >= TOAST_AREA_INCREMENT_THRESHOLD) {
            lastToastAreaRef.current = newTotalArea;
            toast.success(`🎉 领地已捕获！面积: ${Math.round(loopArea)}m²`, {
              description: '跑步记录中... 继续前进占领更多领地！',
              duration: 3000
            });
          }
        }
      } catch (e) {
        console.warn("[useRunningTracker] Invalid polygon", e);
      }
    }

    // Add ACTUAL GPS point to path (seamless continuation)
    setPath(prev => [...prev, finalLoc]);

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


  // ======== CRITICAL: React to GPS location from global store ========
  // Capacitor appStateChange — reconcile timer on foreground resume & log state
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import('@capacitor/app').then(({ App }) => {
      const listenerHandle = App.addListener('appStateChange', async ({ isActive }) => {
        console.log(`[Lifecycle] appStateChange: ${isActive ? 'active' : 'background'} | time: ${new Date().toISOString()}`);
        
        if (isActive && isRunning && !isPausedRef.current && startTimeRef.current !== null) {
          // Force re-calculate duration from absolute timestamp
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setDuration(pausedAccumulatorRef.current + elapsed);
          console.log('[useRunningTracker] Foreground resume — timer reconciled');

          // --- BEGIN: Room 黑匣子追帧 — 分批分帧注入 (Chunked Hydration) ---
          // 核心设计：从 Room 数据库拉取离线坐标后，按每批 20 个点切片，
          // 通过 setTimeout(0) 链式调度，让出主线程给 React commit & GC，
          // 杜绝一次性 setState 导致的高德 JS Bridge 内存撑爆。
          // ACK 仅在最后一批处理完毕后才会触发 — 确保数据不会被提前清空。
          try {
            const { AMapLocation } = await import('@/plugins/amap-location/definitions');
            const sessionId = runIdempotencyKeyRef.current;
            
            const res = await AMapLocation.getOfflineLocations({ sessionId });
            const offlinePoints = res?.locations || [];
            
            if (offlinePoints.length > 0) {
              console.log(`[BlackBox] 🔄 拉取到 ${offlinePoints.length} 条离线定位记录, sessionId=${sessionId}`);
              
              // 防重入锁：避免多次 appStateChange 触发重复注入
              if (isHydratingRef.current) {
                console.warn('[BlackBox] ⚠️ 分帧注入进行中，跳过本次触发');
                return;
              }
              
              // 基于时间戳严格去重：仅提取还未进入路径状态机的新数据点
              const currentPath = pathRef.current;
              const lastPathTime = currentPath.length > 0 
                ? currentPath[currentPath.length - 1].timestamp 
                : 0;
              
              // 按时间戳升序排列（Room 已排序，但再做一次安全保证）
              const sortedPoints = offlinePoints
                .filter((pt: { timestamp: number }) => pt.timestamp > lastPathTime)
                .sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp);
              
              if (sortedPoints.length === 0) {
                console.log('[BlackBox] 所有离线记录已在路径中，无需注入');
                return;
              }
              
              // ====== 分批分帧注入核心 ======
              isHydratingRef.current = true;
              const CHUNK_SIZE = 20;
              const chunks: Array<typeof sortedPoints> = [];
              for (let i = 0; i < sortedPoints.length; i += CHUNK_SIZE) {
                chunks.push(sortedPoints.slice(i, i + CHUNK_SIZE));
              }
              
              console.log(`[BlackBox] 📦 切分为 ${chunks.length} 个批次 (每批 ${CHUNK_SIZE} 点), 总计 ${sortedPoints.length} 个有效点`);
              
              // 预先收集所有待 ACK 的 ID（包括被去重过滤掉的旧点）
              const idsToAck = offlinePoints.map((pt: { id: number }) => pt.id);
              let chunkIndex = 0;
              
              const processNextChunk = () => {
                if (chunkIndex >= chunks.length) {
                  // ====== 全部批次完成 → 安全执行 ACK ======
                  isHydratingRef.current = false;
                  console.log(`[BlackBox] ✅ 分帧注入完成: ${sortedPoints.length} 个轨迹点已全部合入`);
                  
                  AMapLocation.acknowledgeLocations({ ids: idsToAck })
                    .then((ackResult) => {
                      console.log(`[BlackBox] 🔒 ACK 完成: ${ackResult.acknowledged} 条记录已确认`);
                    })
                    .catch((ackErr) => {
                      // ACK 失败不阻断主流程 — 下次苏醒会重新拉取（幂等安全）
                      console.warn('[BlackBox] ⚠️ ACK 失败（数据不会丢失，下次苏醒自动重试）:', ackErr);
                    });
                  return;
                }
                
                const batch = chunks[chunkIndex];
                console.log(`[BlackBox] 🔄 Chunk ${chunkIndex + 1}/${chunks.length} (${batch.length} 点)`);
                
                for (const pt of batch) {
                  handleLocationUpdate(pt.lat, pt.lng, pt.accuracy, pt.timestamp, true);
                }
                
                chunkIndex++;
                // 让出主线程：允许 React 完成当前批次的 commit & reconciliation
                setTimeout(processNextChunk, 0);
              };
              
              // 启动第一批
              processNextChunk();
              // ====== 分批分帧注入核心 END ======
            } else {
              console.log('[BlackBox] 无离线记录需要追帧');
            }
          } catch (e) {
            isHydratingRef.current = false; // 异常时释放锁
            console.warn('[BlackBox] 从 Room 黑匣子追帧失败（可能在 Web 环境）:', e);
          }
          // --- END: Room 黑匣子追帧 — 分批分帧注入 ---
        }

        // 关键事件：切后台时立即强制落盘一次
        if (!isActive && isRunning) {
          await saveState();
        }
      });
      cleanup = () => { listenerHandle.then(h => h.remove()); };
    }).catch(() => {
      // Not in Capacitor environment — no-op
    });
    return () => { cleanup?.(); };
  }, [isRunning, handleLocationUpdate, saveState]);

  // This is the SAME data source as TrajectoryLayer (via MapRoot.userPath)
  useEffect(() => {
    if (!isRunning || !gpsLocation || isStoppingRef.current) return;
    // Only process actual fixes for path tracking, not cache
    if (locationSource === 'cache' || locationSource === 'amap-native-cache') return;

    // GPS location already filtered by useSafeGeolocation:
    // - 50m accuracy threshold
    // - Null Island (0,0) prevention
    // - China bounds validation
    // - WGS84 -> GCJ02 transformation
    //
    // Just pass it to handleLocationUpdate
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
            const safePath = Array.isArray(data.path) ? data.path : [];
            const hasRealData = safePath.length > 0 && ((data.distance || 0) > 0 || (data.duration || 0) > 5);
            
            if (data.idempotencyKey && hasRealData) {
              console.log(`[Session] attempting restore from storage | key: ${data.idempotencyKey}`);
              
              runIdempotencyKeyRef.current = data.idempotencyKey;
              setSavedRunId(data.runId || null);
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
    isStoppingRef.current = true;
    setIsPaused(true);
    saveState();
  }, [saveState]);

  const finalize = useCallback(() => {
    Preferences.remove({ key: RECOVERY_KEY }).catch(console.warn);
    // Deep reset local state
    setPath([]);
    setDistance(0);
    setDuration(0);
    lastLocationRef.current = null;
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
          livePath = Array.isArray(data.path) ? data.path : [];
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
      const stepsForSubmit = currentStepsRef.current > 0
        ? currentStepsRef.current
        : estimateStepsFromDistanceMeters(liveDistance);
      const result = await saveRunActivity(userId, {
        clubId: clubId ?? null,
        idempotencyKey: runIdempotencyKeyRef.current,
        distance: liveDistance,         // Already in meters
        duration: liveDuration,
        path: livePath,
        polygons: liveClaims,
        timestamp: Date.now(),
        totalSteps: stepsForSubmit,
        steps: stepsForSubmit,
        manualLocationCount: 0,
        eventsHistory: eventsHistoryRef.current
      });

      if (result.success) {
        console.log(`[useRunningTracker] Save successful | runId: ${result.data?.runId}`);
        
        if (isFinal) {
          // Clear recovery key only on final successful save
          clearRecovery();
          setSessionClaims([]);
          sessionClaimsRef.current = [];
          setEventsHistory([]);
          
          // Explicitly mutate SWR keys for Home and Task page
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

        // Handle new task rewards if any
        if (result.data?.newTasks && result.data.newTasks.length > 0) {
          const tasks = result.data.newTasks;
          const totalCoins = tasks.reduce((sum, t) => sum + t.reward, 0);
          toast.success(`达成 ${tasks.length} 个目标!`, {
            description: `获得 +${totalCoins} 金币`,
          });
        }
        
        return { settlingAsync: result.data?.settlingAsync };
      } else {
        console.error("Save failed:", result.error);
        if (isFinal) {
          throw new Error(result.error || "Save failed");
        }
      }
    } catch (err) {
      console.error("Save error:", err);
      if (isFinal) {
        throw err; // Re-throw to immersive-mode so it can intercept it!
      }
    } finally {
      setIsSaving(false);
    }
  }, [userId, clearRecovery, clubId]); // Only depends on userId/clubId & clearRecovery — refs handle the rest

  // Auto-save when new territory is claimed
  useEffect(() => {
    if (sessionClaims.length > lastSavedClaimsCount) {
      saveRun(false); // Auto-save
      setLastSavedClaimsCount(sessionClaims.length);
    }
  }, [sessionClaims.length, lastSavedClaimsCount, saveRun]);

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
    activeRandomEvent: activeEvent,
    randomEventCountdownSeconds: countdownSeconds,
  };
}
