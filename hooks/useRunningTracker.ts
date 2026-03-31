import { useState, useEffect, useRef, useCallback } from 'react';
import { mutate } from 'swr';
import { LocationService } from '@/utils/locationService';
import * as turf from '@turf/turf';
import { toast } from 'sonner';
import { syncManager } from '@/lib/sync/SyncManager';
import { uploadTrajectoryBatch } from '@/app/actions/sync';
import { saveRunActivity } from '@/app/actions/run-service';
import { v4 as uuidv4 } from 'uuid';
import { isNativePlatform, safeGetBatteryInfo } from "@/lib/capacitor/safe-plugins";
import type { GeoPoint } from '@/hooks/useSafeGeolocation';
import { useLocationStore } from '@/store/useLocationStore';
import { getDistanceFromLatLonInMeters } from '@/lib/geometry-utils';
import { ActiveRandomEvent, useRandomEvents } from '@/hooks/useRandomEvents';
import { RunEventLog } from '@/types/run-sync';
import type { CapacitorPedometerPlugin } from '@capgo/capacitor-pedometer';

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
  saveRun: (isFinal?: boolean) => Promise<void>;
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

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const isStoppingRef = useRef(false);
  const lastLocationRef = useRef<Location | null>(null);
  const pathRef = useRef<Location[]>([]);
  const isPausedRef = useRef(isPaused);

  // ─── Live-snapshot refs (always current, immune to stale closures) ───
  const distanceRef = useRef(distance);
  const durationRef = useRef(duration);
  const sessionClaimsRef = useRef(sessionClaims);
  const closedPolygonsRef = useRef(closedPolygons);
  const areaRef = useRef(area);

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

  // Capacitor appStateChange — reconcile timer on foreground resume & log state
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import('@capacitor/app').then(({ App }) => {
      const listenerHandle = App.addListener('appStateChange', ({ isActive }) => {
        console.log(`[Lifecycle] appStateChange: ${isActive ? 'active' : 'background'} | time: ${new Date().toISOString()}`);
        
        if (isActive && isRunning && !isPausedRef.current && startTimeRef.current !== null) {
          // Force re-calculate duration from absolute timestamp
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setDuration(pausedAccumulatorRef.current + elapsed);
          console.log('[useRunningTracker] Foreground resume — timer reconciled');
        }

        // 关键事件：切后台时立即强制落盘一次
        if (!isActive && isRunning) {
          saveState();
        }
      });
      cleanup = () => { listenerHandle.then(h => h.remove()); };
    }).catch(() => {
      // Not in Capacitor environment — no-op
    });
    return () => { cleanup?.(); };
  }, [isRunning]);

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
        totalSteps: currentStepsRef.current,
        runIsValid: runIsValid ?? true,
        antiCheatLog: antiCheatLog ?? null,
        area: areaRef.current || 0,
        timestamp: Date.now(),
        restoreSource: 'storage'
      };
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(stateToSave));
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
    let total = 0;
    polygons.forEach(poly => {
      if (poly.length < 3) return;
      try {
        const points = poly.map(p => [p.lng, p.lat]);
        if (points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1]) {
          points.push(points[0]);
        }
        const polygon = turf.polygon([points]);
        total += turf.area(polygon);
      } catch (e) {
        console.warn("[useRunningTracker] Invalid polygon for area calculation", e);
      }
    });
    return total;
  }, []);

  const handleLocationUpdate = useCallback((lat: number, lng: number, accuracy?: number, timestamp?: number) => {
    if (isPausedRef.current || isStoppingRef.current) return;

    const now = timestamp || Date.now();

    // ================================================================
    // 🛡️ THREE-LAYER GPS ANTI-JITTER INTERCEPTOR
    // Applied BEFORE smoothing, path appending, or distance calculation
    // ================================================================

    // --- Layer 1: Accuracy Filter ---
    // GPS accuracy >30m indicates unreliable satellite fix (indoor, urban canyon)
    if (accuracy != null && accuracy > 30) {
      console.debug(`[GPS-Filter] ❌ Layer 1 REJECT: accuracy ${accuracy.toFixed(0)}m > 30m threshold`);
      return;
    }

    // --- Layer 2: Speed Filter ---
    // Calculate speed between this point and last valid point
    // If speed > 10 m/s (~36 km/h), this is signal drift, not human movement
    if (lastLocationRef.current) {
      const prevLoc = lastLocationRef.current;
      const distToPrev = getDistanceFromLatLonInMeters(prevLoc.lat, prevLoc.lng, lat, lng);
      const timeDiffSec = (now - prevLoc.timestamp) / 1000;

      if (timeDiffSec > 0.5) {
        const speedMs = distToPrev / timeDiffSec;
        if (speedMs > 10) {
          console.debug(
            `[GPS-Filter] ❌ Layer 2 REJECT: speed ${(speedMs * 3.6).toFixed(1)}km/h > 36km/h | ` +
            `dist=${distToPrev.toFixed(1)}m dt=${timeDiffSec.toFixed(1)}s`
          );
          return;
        }
      }

      // --- Layer 3: Micro-Jitter Filter ---
      // If distance < 2m, the runner is standing still (red light, stretching)
      // Do NOT accumulate distance or append to path (prevents "yarn ball" artifacts)
      // But DO update lastLocationRef timestamp to keep timeDiff fresh
      if (distToPrev < 2) {
        // Update timestamp only so subsequent speed calculations stay valid
        lastLocationRef.current = { ...prevLoc, timestamp: now };
        return;
      }
    }

    // ================================================================
    // All 3 layers passed — this is a valid GPS point
    // ================================================================

    let newLoc: Location = { lat, lng, timestamp: now };

    // Apply Smoothing
    if (lastLocationRef.current) {
      newLoc = smoothLocation(newLoc, lastLocationRef.current);
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

    const MIN_LOOP_SIZE = 10; // Minimum points before allowing snap
    const SNAP_THRESHOLD = 20; // meters - snap distance (tunable)

    let shouldSnapToStart = false;
    let snappedLoc = newLoc; // Used ONLY for polygon calc

    if (pathRef.current.length >= MIN_LOOP_SIZE) {
      const startPoint = pathRef.current[0];
      const distToStart = getDistanceFromLatLonInMeters(newLoc.lat, newLoc.lng, startPoint.lat, startPoint.lng);

      if (distToStart <= SNAP_THRESHOLD) {
        // 🎯 SNAP! Create snapped point for polygon calculation
        snappedLoc = {
          lat: startPoint.lat,
          lng: startPoint.lng,
          timestamp: now
        };
        shouldSnapToStart = true;

        console.log(`[Smart Snap] 🎯 Snapped to start! Distance: ${Math.round(distToStart)}m`);
      }
    }

    // ⚠️ CRITICAL: Always use ACTUAL GPS point (newLoc) for path continuation
    // This prevents the trajectory from "teleporting" to the start point
    const finalLoc = newLoc; // NOT snappedLoc!

    // Loop Closure Detection (Polygon) - Calculate claim using snapped point
    if (shouldSnapToStart && pathRef.current.length > MIN_LOOP_SIZE) {
      // Create closed loop for area calculation using snapped point
      const loopForCalc = [...pathRef.current, snappedLoc];

      try {
        const coords = loopForCalc.map(pt => [pt.lng, pt.lat]);
        // Ensure closed ring for turf
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push(coords[0]);
        }
        const poly = turf.polygon([coords]);
        const loopArea = turf.area(poly);

        if (loopArea > 100) { // Min 100 m²
          // Store claimed polygon
          setSessionClaims(prev => [...prev, loopForCalc]);
          setClosedPolygons(prevPolys => [...prevPolys, loopForCalc]);
          setArea(prevArea => prevArea + loopArea);

          // 🎉 NEW TOAST: Emphasize that tracking continues!
          toast.success(`🎉 领地已捕获！面积: ${Math.round(loopArea)}m²`, {
            description: '跑步记录中... 继续前进占领更多领地！',
            duration: 3000
          });
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
  // This is the SAME data source as TrajectoryLayer (via MapRoot.userPath)
  useEffect(() => {
    if (!isRunning || !gpsLocation || isStoppingRef.current) return;
    // Only process actual fixes for path tracking, not cache
    if (locationSource === 'cache') return;

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
        activeWatcherId = await LocationService.startTracking(userId);
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
        const recoveryJson = localStorage.getItem(RECOVERY_KEY);
        let recovered = false;
        let restoreSource = 'none';

        // 1. Try LocalStorage
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
              
              const isPausedNow = data.isPaused ?? false;
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem(RECOVERY_KEY);
    }
    // Deep reset local state
    setPath([]);
    setDistance(0);
    setDuration(0);
    lastLocationRef.current = null;
  }, []);

  const clearRecovery = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(RECOVERY_KEY);
    }
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
        const recoveryJson = localStorage.getItem(RECOVERY_KEY);
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
      const result = await saveRunActivity(userId, {
        idempotencyKey: runIdempotencyKeyRef.current,
        distance: liveDistance,         // Already in meters
        duration: liveDuration,
        path: livePath,
        polygons: liveClaims,
        timestamp: Date.now(),
        totalSteps: currentStepsRef.current,
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
  }, [userId, clearRecovery]); // Only depends on userId & clearRecovery — refs handle the rest

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
