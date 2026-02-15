import { useState, useEffect, useRef, useCallback } from 'react';
import gcoord from 'gcoord';
import * as turf from '@turf/turf';
import { LocationService } from '@/utils/locationService';
import { toast } from 'sonner';
import { syncManager } from '@/lib/sync/SyncManager';
import { uploadTrajectoryBatch } from '@/app/actions/sync';
import { v4 as uuidv4 } from 'uuid';
import { isNativePlatform, safeGetBatteryInfo } from "@/lib/capacitor/safe-plugins";


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
  closedPolygons: Location[][]; // New: Array of closed polygons
  addManualLocation: (lat: number, lng: number) => void;
  isSyncing: boolean; // New status
}

// Haversine formula to calculate distance between two points in meters
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
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
  // Cap pace display to avoid infinity or weird numbers
  if (m > 59) return "59:59"; 
  return `${m.toString().padStart(2, '0')}'${s.toString().padStart(2, '0')}"`;
}

export function useRunningTracker(isRunning: boolean): RunningStats {
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0); // seconds
  const [distance, setDistance] = useState(0); // meters
  const [path, setPath] = useState<Location[]>([]);
  const [closedPolygons, setClosedPolygons] = useState<Location[][]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [area, setArea] = useState(0); // m²
  
  // New Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Watcher ID for LocationService
  const watcherIdRef = useRef<string | null>(null);
  const lastLocationTimeRef = useRef<number>(Date.now());
  const isStoppingRef = useRef(false); // New: Prevent re-entry/recovery during stop
  
  const lastLocationRef = useRef<Location | null>(null);
  const pathRef = useRef<Location[]>([]);
  const isPausedRef = useRef(isPaused);

  // Sync refs
  useEffect(() => { pathRef.current = path; }, [path]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

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

  // --- Location Service Management ---
  // Encapsulated to support restart logic
  const startLocationService = useCallback(async () => {
    if (isStoppingRef.current) return; // Don't start if stopping
    if (!isRunning) return;
    
    // Prevent duplicate start
    if (watcherIdRef.current) return;

    try {
      console.log('[useRunningTracker] Starting Location Service...');
      const id = await LocationService.startTracking();
      watcherIdRef.current = id;
      lastLocationTimeRef.current = Date.now(); // Reset heartbeat
    } catch (e) {
      console.error("Failed to start location service:", e);
    }
  }, [isRunning]);

  const stopLocationService = useCallback(async () => {
    if (watcherIdRef.current) {
      console.log('[useRunningTracker] Stopping Location Service...');
      await LocationService.stopTracking(watcherIdRef.current);
      watcherIdRef.current = null;
    }
  }, []);

  // --- Local Recovery (Crash Resilience) ---
  useEffect(() => {
    if (isRunning && !isStoppingRef.current) {
        try {
            const recoveryJson = localStorage.getItem(RECOVERY_KEY);
            if (recoveryJson) {
                const data = JSON.parse(recoveryJson);
                // Validate time (e.g. within 24h)
                if (data.timestamp && (Date.now() - data.timestamp < 24 * 60 * 60 * 1000)) {
                    console.log('Restoring local run state...', data);
                    if (data.distance) setDistance(data.distance);
                    if (data.duration) setDuration(data.duration);
                    if (data.path && Array.isArray(data.path)) {
                        setPath(data.path);
                        pathRef.current = data.path;
                        if (data.path.length > 0) {
                            lastLocationRef.current = data.path[data.path.length - 1];
                            setCurrentLocation(data.path[data.path.length - 1]);
                        }
                    }
                    if (data.closedPolygons) setClosedPolygons(data.closedPolygons);
                }
            }
        } catch (e) {
            console.error("Failed to restore local run state", e);
        }
    }
  }, [isRunning]);

  // --- Server Sync Loop (Offline-First) ---
  useEffect(() => {
    if (!isRunning || isStoppingRef.current) return;

    let syncInterval: NodeJS.Timeout;

    const performSync = async () => {
        if (!navigator.onLine || isSyncing) return;

        // Check battery optimization
        if (await isNativePlatform()) {
            try {
                const info = await safeGetBatteryInfo();
                if (info && info.level !== undefined && info.level < 0.1 && !info.isCharging) {
                     const count = await syncManager.getPendingCount();
                     if (count < 20) return; 
                }
            } catch (e) {}
        }


        try {
            const batch = await syncManager.getPendingBatch(50);
            if (batch.length === 0) return;

            setIsSyncing(true);
            const result = await uploadTrajectoryBatch(batch);
            
            if (result.success) {
                await syncManager.ack(result.syncedIds);
            } else {
                console.warn('Sync failed:', result.error);
            }
        } catch (e) {
            console.error('Sync error', e);
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
  }, [isRunning]); 

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

  // Periodic Save (Every 5 seconds + Initial)
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
            console.error("Failed to save run state", e);
        }
    };

    saveState();
    const interval = setInterval(saveState, 5000);
    return () => clearInterval(interval);
  }, [isRunning, distance, duration, closedPolygons]);

  // --- Weighted Smoothing ---
  const smoothLocation = (newLoc: Location, prevLoc: Location | null): Location => {
      if (!prevLoc) return newLoc;
      // Simple weighted average (Low Pass Filter)
      // weight 0.2 means new location has 20% influence, old has 80% (Heavy smoothing)
      // For running, GPS can jump. We trust the new point more if speed is reasonable.
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
            // Close the loop if needed
            const points = poly.map(p => [p.lng, p.lat]);
            if (points[0][0] !== points[points.length-1][0] || points[0][1] !== points[points.length-1][1]) {
                points.push(points[0]);
            }
            const polygon = turf.polygon([points]);
            total += turf.area(polygon);
          } catch (e) {
            console.warn("Invalid polygon for area calculation", e);
          }
      });
      return total;
  }, []);

  const handleLocationUpdate = useCallback((lat: number, lng: number, accuracy?: number, timestamp?: number, speed?: number, heading?: number) => {
    if (isPausedRef.current || isStoppingRef.current) return;

    // Update Heartbeat
    lastLocationTimeRef.current = Date.now();

    // --- Anti-Cheat Filter Start ---
    const now = timestamp || Date.now();
    
    // 1. Accuracy Check (> 40m discarded)
    if (accuracy && accuracy > 40) return;

    // 2. Speed Check
    if (lastLocationRef.current) {
      const prevLoc = lastLocationRef.current;
      const distToPrev = getDistanceFromLatLonInMeters(prevLoc.lat, prevLoc.lng, lat, lng);
      const timeDiff = (now - prevLoc.timestamp) / 1000; // seconds

      if (timeDiff > 0) {
        const speedKmh = (distToPrev / timeDiff) * 3.6;
        if (speedKmh > 35) { // Relaxed from 25 to 35 for sprints/GPS drift
          toast.warning("移动速度过快，判定为交通工具，该点已忽略");
          return;
        }
        // Remove strict low speed check to allow slow walking/stops
        // if (speedKmh < 0.5) return; 
      }
    }
    // --- Anti-Cheat Filter End ---

    let newLoc: Location = { lat, lng, timestamp: now };
    
    // Apply Smoothing
    if (lastLocationRef.current) {
        newLoc = smoothLocation(newLoc, lastLocationRef.current);
    }

    // --- Loop Closure Detection ---
    setPath(prev => {
        const updatedPath = [...prev, newLoc];
        
        // Simple loop detection: Check if newLoc is close to any previous point (excluding recent ones)
        // Only check every 5th point to save perf? No, check all but with a minimum index gap.
        const MIN_LOOP_SIZE = 10; // Minimum points to form a loop
        const CLOSURE_THRESHOLD = 20; // meters
        
        // Only run detection if we have enough points
        if (updatedPath.length > MIN_LOOP_SIZE) {
            // Search backwards from (end - MIN_LOOP_SIZE)
      // Check for valid path before iterating
      if (!updatedPath) return updatedPath;

      for (let i = updatedPath.length - MIN_LOOP_SIZE - 1; i >= 0; i--) {
                const p = updatedPath[i];
                const dist = getDistanceFromLatLonInMeters(newLoc.lat, newLoc.lng, p.lat, p.lng);
                
                if (dist < CLOSURE_THRESHOLD) {
                    // Loop detected!
                    // Extract the loop: from i to end
                    const loop = updatedPath.slice(i);
                    
                    // Validate loop area (ignore tiny loops from jitter)
                    try {
                        const coords = loop.map(pt => [pt.lng, pt.lat]);
                        // Close it
                        coords.push(coords[0]);
                        const poly = turf.polygon([coords]);
                        const loopArea = turf.area(poly);
                        
                        if (loopArea > 100) { // Min 100 m²
                            // Check if this loop is already "contained" or similar to existing ones?
                            // For simplicity, just add it.
                            // But we should avoid adding the same loop repeatedly if the user stands still at the closure point.
                            // Strategy: Once a loop is closed, we don't "consume" the points, but we might need a cooldown or check if the last closed polygon is the same.
                            
                            setClosedPolygons(prevPolys => {
                                // Check if the last polygon is very similar (same start/end index logic?)
                                // Hard to track indices here.
                                // Let's just add it for now and rely on visual overlay.
                                // Optimization: limit total polygons or merge?
                                return [...prevPolys, loop];
                            });
                            
                            // Update total area
                            setArea(prevArea => prevArea + loopArea);
                            toast.success(`领地闭合！占领面积 ${Math.round(loopArea)} m²`);
                            
                            // TODO: Maybe "cut" the path or mark these points as used?
                            // For now, keep the path growing.
                        }
                    } catch (e) {
                        // Ignore invalid polygons
                    }
                    
                    // Break after finding the *first* (most recent) valid closure to avoid nested loops?
                    // Or finding the *largest* (earliest) closure?
                    // Usually earliest makes the biggest loop.
                    // Let's break to avoid multiple detections for one movement.
                    break; 
                }
            }
        }
        
        return updatedPath;
    });
    
    if (lastLocationRef.current) {
      const dist = getDistanceFromLatLonInMeters(
        lastLocationRef.current.lat, 
        lastLocationRef.current.lng, 
        newLoc.lat, 
        newLoc.lng
      );
      setDistance(prev => prev + dist);
    }
    
    lastLocationRef.current = newLoc;
    setCurrentLocation(newLoc);

    // --- Dual-Track Storage ---
    syncManager.enqueue({
        lat: newLoc.lat,
        lng: newLoc.lng,
        timestamp: now,
        accuracy: accuracy || 0,
        speed: speed || 0,
        heading: heading || 0,
        sequenceId: uuidv4()
    }).catch(e => console.error("Failed to enqueue point", e));

  }, []);

  const addManualLocation = useCallback((lat: number, lng: number) => {
    handleLocationUpdate(lat, lng, 0, Date.now(), 0, 0);
  }, [handleLocationUpdate]);

  // --- Handle New Location Event ---
  const handleNewLocation = useCallback((e: any) => {
      if (!isRunning || isStoppingRef.current) return;
      const loc = e.detail;
      const gcj02 = gcoord.transform(
          [loc.longitude, loc.latitude],
          gcoord.WGS84,
          gcoord.GCJ02
      );
      handleLocationUpdate(gcj02[1], gcj02[0], loc.accuracy, loc.time, loc.speed, loc.bearing);
  }, [isRunning, handleLocationUpdate]);

  // --- Location Service Lifecycle ---
  useEffect(() => {
    if (isRunning && !isStoppingRef.current) {
      startLocationService();
    } else {
      stopLocationService();
    }
    return () => {
        stopLocationService();
    };
  }, [isRunning, startLocationService, stopLocationService]);

  // --- Event Listener ---
  useEffect(() => {
      if (isRunning) {
          window.addEventListener('new-location', handleNewLocation);
      }
      return () => {
          window.removeEventListener('new-location', handleNewLocation);
      };
  }, [isRunning, handleNewLocation]);

  // --- Visibility Change & Heartbeat Check ---
  useEffect(() => {
      const checkHeartbeat = async () => {
          if (isRunning && !isStoppingRef.current && !isPausedRef.current) {
              const timeSinceLastUpdate = Date.now() - lastLocationTimeRef.current;
              // If > 10s without update, and we are supposed to be running
              if (timeSinceLastUpdate > 10000) {
                   console.warn(`[useRunningTracker] Heartbeat lost (${timeSinceLastUpdate}ms). Restarting service...`);
                   await stopLocationService();
                   setTimeout(() => startLocationService(), 500);
              }
          }
      };

      const interval = setInterval(checkHeartbeat, 5000);

      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
              console.log('[useRunningTracker] App foregrounded, checking heartbeat...');
              checkHeartbeat();
          }
      };
  
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [isRunning, startLocationService, stopLocationService]);


  // Wake Lock
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && isRunning && !isPaused && !isStoppingRef.current) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (err: any) {
          console.error(`Wake Lock error: ${err.name}, ${err.message}`);
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
      if (wakeLock) wakeLock.release();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, isPaused]);

  // Reset when stopping or starting fresh
  useEffect(() => {
    if (isRunning && duration === 0 && distance === 0 && !isStoppingRef.current) {
       // Just started - Check Recovery
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
               console.error("Recovery failed", e);
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
        // 1. Set stopping flag to prevent recovery/updates
        isStoppingRef.current = true;
        
        // 2. Pause immediately
        setIsPaused(true);
        
        // 3. Stop Location Service
        stopLocationService();
        
        // 4. Clear Local Recovery Storage immediately
        // FIX: Clear strictly to prevent race conditions
        if (typeof window !== 'undefined') {
            localStorage.removeItem(RECOVERY_KEY);
            console.log('[useRunningTracker] Recovery key cleared');
        }
    } catch (e) {
        console.error('[useRunningTracker] Error during stop:', e);
    }
    
    // Note: The parent component should handle the actual data submission/reset
    // based on this stop call.
  }, [stopLocationService]);

  const clearRecovery = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(RECOVERY_KEY);
    }
  }, []);

  const distanceKm = distance / 1000;
  const pace = formatPace(duration, distanceKm);
  const durationStr = formatDuration(duration);
  const calories = Math.round(distanceKm * 70 * 1.036); 

  return {
    distance: distanceKm,
    pace,
    duration: durationStr,
    calories,
    path,
    currentLocation,
    isPaused,
    togglePause,
    stop,
    clearRecovery,
    rawDuration: duration,
    area,
    closedPolygons,
    addManualLocation,
    isSyncing
  };
}
