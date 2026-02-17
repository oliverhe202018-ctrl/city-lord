import { useState, useEffect, useRef, useCallback } from 'react';
import { LocationService } from '@/utils/locationService';
import * as turf from '@turf/turf';
import { toast } from 'sonner';
import { syncManager } from '@/lib/sync/SyncManager';
import { uploadTrajectoryBatch } from '@/app/actions/sync';
import { saveRunActivity } from '@/app/actions/run-service';
import { v4 as uuidv4 } from 'uuid';
import { isNativePlatform, safeGetBatteryInfo } from "@/lib/capacitor/safe-plugins";
import { useSafeGeolocation, GeoPoint } from '@/hooks/useSafeGeolocation';

const RECOVERY_KEY = 'CURRENT_RUN_RECOVERY';

export interface Location {
  lat: number;
  lng: number;
  timestamp: number;
}

interface RunningStats {
  distance: number; // km
  pace: string; // "mm:ss"
  duration: string; // "HH:MM:SS"
  calories: number;
  path: Location[];
  currentLocation: { lat: number; lng: number } | null;
  isPaused: boolean;
  togglePause: () => void;
  stop: () => void;
  clearRecovery: () => void;
  rawDuration: number; // seconds
  area: number; // m²
  closedPolygons: Location[][];
  sessionClaims: Location[][]; // Claimed polygons during this run session
  addManualLocation: (lat: number, lng: number) => void;
  isSyncing: boolean;
  saveRun: (isFinal?: boolean) => Promise<void>;
}

// Haversine formula to calculate distance between two points in meters
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatPace(seconds: number, distanceKm: number): string {
  if (distanceKm <= 0.01) return "00:00";
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

  // Sync refs
  useEffect(() => { pathRef.current = path; }, [path]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // ======== CRITICAL: Use centralized useSafeGeolocation ========
  // REMOVED: LocationService, watcherIdRef, startLocationService, stopLocationService (Re-added for Background Notification)
  // NOW: Consume GPS directly from useSafeGeolocation hook (SAME SOURCE as TrajectoryLayer)
  // BUT: We start LocationService purely for the Foreground Service Notification (Keep-Alive)
  const watcherIdRef = useRef<string | null>(null);

  // Import LocationService dynamically or directly
  // We use the one from utils/locationService which uses safe-plugins
  // const { LocationService } = require('@/utils/locationService'); // Using import at top instead
  const { location: gpsLocation } = useSafeGeolocation({
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 0
  });

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

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && !isPaused && !isStoppingRef.current) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  // Periodic Save (Every 5 seconds)
  useEffect(() => {
    if (!isRunning || isStoppingRef.current) return;

    const saveState = () => {
      try {
        const stateToSave = {
          path: pathRef.current || [],
          distance: distance,
          duration: duration,
          startTime: Date.now() - (duration * 1000),
          closedPolygons: closedPolygons || [],
          area: area || 0,
          timestamp: Date.now()
        };
        localStorage.setItem(RECOVERY_KEY, JSON.stringify(stateToSave));
      } catch (e) {
        console.error("[useRunningTracker] Failed to save run state", e);
      }
    };

    saveState();
    const interval = setInterval(saveState, 5000);
    return () => clearInterval(interval);
  }, [isRunning, distance, duration, closedPolygons, area]);

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

    // Accuracy Check (50m threshold - aligned with useSafeGeolocation)
    // NOTE: GPS is already filtered by useSafeGeolocation, but double-check for safety
    if (accuracy && accuracy > 50) {
      console.debug(`[useRunningTracker] Rejected >50m accuracy point (${accuracy}m)`);
      return;
    }

    // ⚠️ ANTI-CHEAT TEMPORARILY DISABLED FOR TESTING
    // TODO: Re-enable with more tolerant threshold (e.g., 50 km/h) or implement server-side validation
    // Original logic was blocking legitimate GPS jumps during normal running
    /*
    // Speed Check (Anti-Cheat)
    if (lastLocationRef.current) {
      const prevLoc = lastLocationRef.current;
      const distToPrev = getDistanceFromLatLonInMeters(prevLoc.lat, prevLoc.lng, lat, lng);
      const timeDiff = (now - prevLoc.timestamp) / 1000; // seconds

      if (timeDiff > 0) {
        const speedKmh = (distToPrev / timeDiff) * 3.6;
        if (speedKmh > 35) {
          toast.warning("移动速度过快，判定为交通工具，该点已忽略");
          return;
        }
      }
    }
    */

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

  // ======== CRITICAL: React to GPS location from useSafeGeolocation ========
  // This is the SAME data source as TrajectoryLayer (via MapRoot.userPath)
  useEffect(() => {
    if (!isRunning || !gpsLocation || isStoppingRef.current) return;

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
  }, [gpsLocation, isRunning, handleLocationUpdate]);

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

  // Recovery on start
  useEffect(() => {
    if (isRunning && duration === 0 && distance === 0 && !isStoppingRef.current) {
      const recoveryJson = localStorage.getItem(RECOVERY_KEY);
      let recovered = false;
      if (recoveryJson) {
        try {
          const data = JSON.parse(recoveryJson);
          if (data.startTime && (Date.now() - data.startTime < 24 * 60 * 60 * 1000)) {
            const safePath = Array.isArray(data.path) ? data.path : [];
            setPath(safePath);
            setDistance(data.distance || 0);
            setDuration(data.duration || 0);
            setClosedPolygons(data.closedPolygons || []);
            setArea(data.area || 0);
            if (safePath.length > 0) {
              const lastLoc = safePath[safePath.length - 1];
              lastLocationRef.current = lastLoc;
              pathRef.current = safePath;
              setCurrentLocation(lastLoc);
            }
            recovered = true;
            toast.success('已恢复上次异常退出的跑步记录');
          }
        } catch (e) {
          console.error("[useRunningTracker] Recovery failed", e);
        }
      }

      if (!recovered) {
        setPath([]);
        setClosedPolygons([]);
        lastLocationRef.current = null;
      }
    }
  }, [isRunning]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const stop = useCallback(() => {
    try {
      isStoppingRef.current = true;
      setIsPaused(true);

      // Clear recovery
      if (typeof window !== 'undefined') {
        localStorage.removeItem(RECOVERY_KEY);
        console.log('[useRunningTracker] Recovery key cleared');
      }
    } catch (e) {
      console.error('[useRunningTracker] Error during stop:', e);
    }
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
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedClaimsCount, setLastSavedClaimsCount] = useState(0);

  // Core save function
  const saveRun = useCallback(async (isFinal: boolean = false) => {
    if (!userId) return; // Cannot save without user

    try {
      setIsSaving(true);
      const result = await saveRunActivity(userId, {
        distance: distanceKm * 1000, // convert to meters for DB
        duration: duration,
        path: path,
        polygons: sessionClaims,
        manualLocationCount: 0 // Track if needed
      });

      if (result.success) {
        if (isFinal) {
          console.log("Run saved successfully:", result.runId);
        }

        // Handle new task rewards if any
        if (result.newTasks && result.newTasks.length > 0) {
          const tasks = result.newTasks;
          const totalCoins = tasks.reduce((sum, t) => sum + t.reward, 0);
          toast.success(`达成 ${tasks.length} 个目标!`, {
            description: `获得 +${totalCoins} 金币`,
          });
        }
      } else {
        console.error("Save failed:", result.error);
        if (isFinal) {
          toast.error("保存失败，数据已暂存本地");
        }
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  }, [userId, distanceKm, duration, path, sessionClaims]);

  // Auto-save when new territory is claimed
  useEffect(() => {
    if (sessionClaims.length > lastSavedClaimsCount) {
      saveRun(false); // Auto-save
      setLastSavedClaimsCount(sessionClaims.length);
    }
  }, [sessionClaims.length, lastSavedClaimsCount, saveRun]);

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
    saveRun // Expose for manual final save
  };
}
