import { useState, useEffect, useRef, useCallback } from 'react';
import gcoord from 'gcoord';
import * as turf from '@turf/turf';
import { LocationService } from '@/utils/locationService';
import { toast } from 'sonner';

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
  closedPolygons: Location[][]; // New: Array of closed polygons
  addManualLocation: (lat: number, lng: number) => void;
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
  
  // Watcher ID for LocationService
  const watcherIdRef = useRef<string | null>(null);
  
  const lastLocationRef = useRef<Location | null>(null);
  const pathRef = useRef<Location[]>([]);
  const isPausedRef = useRef(isPaused);

  // Sync refs
  useEffect(() => { pathRef.current = path; }, [path]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // --- Server Sync & Recovery ---
  useEffect(() => {
    let isMounted = true;

    const fetchServerState = async () => {
      try {
        const res = await fetch('/api/run/current', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();

        if (isMounted && data.active && data.run) {
          // Restore state from server
          if (data.run.path && Array.isArray(data.run.path) && data.run.path.length > 0) {
             setPath(data.run.path);
             pathRef.current = data.run.path;
             if (data.run.path?.length > 0) {
                lastLocationRef.current = data.run.path[data.run.path.length - 1];
             }
          }
          if (data.run.distance) setDistance(data.run.distance * 1000); // Server uses km? No, float. Let's assume meters or km. 
          // Wait, native sync accumulates distance in km in the API logic: currentDistance += (dist / 1000)
          // So server sends km. Hook uses meters.
          if (typeof data.run.distance === 'number') {
             setDistance(data.run.distance * 1000);
          }
          
          if (data.run.duration) setDuration(data.run.duration);
          
          // If we recovered a running state but local isPaused is default (false), it matches.
          // If server says running, we should ensure we are running?
          // The hook is initialized with `isRunning`. Parent controls that.
          // But we can update data.
          console.log('Restored run state from server');
        }
      } catch (e) {
        console.error('Failed to sync with server:', e);
      }
    };

    if (isRunning) {
      fetchServerState();
      
      // Also listen for app state changes (background -> foreground)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          fetchServerState();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        isMounted = false;
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isRunning]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  const handleLocationUpdate = useCallback((lat: number, lng: number, accuracy?: number, timestamp?: number) => {
    if (isPausedRef.current) return;

    // --- Anti-Cheat Filter Start ---
    const now = timestamp || Date.now();
    
    // 1. Accuracy Check (> 40m discarded)
    if (accuracy && accuracy > 40) {
      // console.log(`[Anti-Cheat] Low accuracy ignored: ${accuracy}m`);
      return;
    }

    // 2. Speed Check
    if (lastLocationRef.current) {
      const prevLoc = lastLocationRef.current;
      const distToPrev = getDistanceFromLatLonInMeters(prevLoc.lat, prevLoc.lng, lat, lng);
      const timeDiff = (now - prevLoc.timestamp) / 1000; // seconds

      if (timeDiff > 0) {
        const speedKmh = (distToPrev / timeDiff) * 3.6;

        // > 25km/h: Vehicle detected
        if (speedKmh > 25) {
          toast.warning("移动速度过快，判定为交通工具，该点已忽略");
          return;
        }

        // < 0.5km/h: Stationary drift (discard)
        // Note: We only discard if it's very slow to avoid drift accumulation
        if (speedKmh < 0.5) {
           return;
        }
      }
    }
    // --- Anti-Cheat Filter End ---

    const newLoc: Location = {
      lat,
      lng,
      timestamp: now
    };

    setCurrentLocation({ lat, lng });

    if (lastLocationRef.current) {
      const dist = getDistanceFromLatLonInMeters(
        lastLocationRef.current.lat,
        lastLocationRef.current.lng,
        lat,
        lng
      );

      // Filter GPS noise: ignore if distance is too small (< 2m)
      if (dist > 2) { 
        setDistance(prev => {
          const newDist = prev + dist;
          return newDist;
        });
        
        // Loop Detection Logic
        const currentPath = [...pathRef.current, newLoc];
        setPath(currentPath);
        pathRef.current = currentPath; // Update ref immediately to prevent race conditions
        lastLocationRef.current = newLoc;

        // --- Crash Recovery: Save State ---
        try {
          const stateToSave = {
            path: currentPath,
            distance: distance + dist, // Use calculated new distance
            duration: duration, // Capture current duration
            startTime: Date.now() - (duration * 1000), // Estimate start time if not stored
            closedPolygons: closedPolygons, // Also save closed polygons
            timestamp: Date.now()
          };
          localStorage.setItem(RECOVERY_KEY, JSON.stringify(stateToSave));
        } catch (e) {
          console.error("Failed to save run state", e);
        }
        // ----------------------------------

        if (currentPath.length > 5) {
          const startPoint = currentPath[0];
          const endPoint = newLoc;
           
           const from = turf.point([startPoint.lng, startPoint.lat]);
           const to = turf.point([endPoint.lng, endPoint.lat]);
           const gap = turf.distance(from, to, { units: 'meters' });

           if (gap < 20) {
               console.log("Loop Closed! Gap:", gap);
               setClosedPolygons(prev => {
                 const newPolys = [...prev, currentPath];
                 // Update recovery with new polygons
                 const recoveryData = localStorage.getItem(RECOVERY_KEY);
                 if (recoveryData) {
                    const parsed = JSON.parse(recoveryData);
                    parsed.closedPolygons = newPolys;
                    parsed.path = [newLoc]; // Path resets
                    localStorage.setItem(RECOVERY_KEY, JSON.stringify(parsed));
                 }
                 return newPolys;
               });
               setPath([newLoc]);
               // Manually update pathRef for immediate subsequent updates
               pathRef.current = [newLoc];
           }
        }
      }
    } else {
      setPath([newLoc]);
      lastLocationRef.current = newLoc;
      
      // Initial Save
      try {
          const stateToSave = {
            path: [newLoc],
            distance: 0,
            duration: duration,
            startTime: Date.now(),
            closedPolygons: closedPolygons,
            timestamp: Date.now()
          };
          localStorage.setItem(RECOVERY_KEY, JSON.stringify(stateToSave));
      } catch (e) {}
    }
  }, [distance, duration, closedPolygons]); // Added dependencies for state access

  const addManualLocation = useCallback((lat: number, lng: number) => {
    handleLocationUpdate(lat, lng, 0, Date.now());
  }, [handleLocationUpdate]);

  // Location Service & Event Listener
  useEffect(() => {
    let isSubscribed = true;

    const startService = async () => {
      if (isRunning && !watcherIdRef.current) {
        try {
          // Get session token for native sync
          // We can use supabase client or just assume we have it in storage/context
          // Ideally pass it in. For now, let's try to get it from local storage or similar if accessible, 
          // or assume LocationService handles it if we don't pass it?
          // The updated LocationService expects `authToken`.
          // We need to get the token here.
          let token = undefined;
          try {
             // Try getting from Supabase local storage key
             // Or better, use `useAuth` hook? But we can't use hooks inside useEffect easily without refactoring.
             // Let's assume standard Supabase key
             for (let i = 0; i < localStorage.length; i++) {
               const key = localStorage.key(i);
               if (key?.startsWith('sb-') && key?.endsWith('-auth-token')) {
                 const session = JSON.parse(localStorage.getItem(key) || '{}');
                 token = session.access_token;
                 break;
               }
             }
          } catch (e) {}

          const id = await LocationService.startTracking(token);
          if (isSubscribed) {
            watcherIdRef.current = id;
          } else {
            // If component unmounted or stopped before start finished
            LocationService.stopTracking(id);
          }
        } catch (e) {
          console.error("Failed to start location service:", e);
        }
      }
    };

    const stopService = async () => {
      if (!isRunning && watcherIdRef.current) {
        await LocationService.stopTracking(watcherIdRef.current);
        watcherIdRef.current = null;
      }
    };

    if (isRunning) {
      startService();
    } else {
      stopService();
    }

    // Event Listener for new-location
    const handleNewLocation = (e: any) => {
        if (!isRunning) return;
        
        const loc = e.detail;
        // Transform WGS84 (Plugin default) to GCJ02 (AMap)
        // Note: Plugin returns { latitude, longitude, ... }
        const gcj02 = gcoord.transform(
            [loc.longitude, loc.latitude],
            gcoord.WGS84,
            gcoord.GCJ02
        );
        handleLocationUpdate(gcj02[1], gcj02[0], loc.accuracy, loc.time);
    };

    if (isRunning) {
        window.addEventListener('new-location', handleNewLocation);
    }

    return () => {
      isSubscribed = false;
      window.removeEventListener('new-location', handleNewLocation);
      // Cleanup service on unmount if still running
      if (watcherIdRef.current) {
        LocationService.stopTracking(watcherIdRef.current);
        watcherIdRef.current = null;
      }
    };
  }, [isRunning, handleLocationUpdate]);


  // Wake Lock for screen
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && isRunning && !isPaused) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (err: any) {
          console.error(`Wake Lock error: ${err.name}, ${err.message}`);
        }
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning && !isPaused) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock) {
        wakeLock.release();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, isPaused]);

  // Reset when stopping or starting fresh (with Crash Recovery)
  useEffect(() => {
    if (!isRunning) {
      // When stopped, we might want to keep data for summary
    } else if (isRunning && duration === 0 && distance === 0) {
       // Just started - Check Recovery
       const recoveryJson = localStorage.getItem(RECOVERY_KEY);
       let recovered = false;
       if (recoveryJson) {
           try {
               const data = JSON.parse(recoveryJson);
               // Check 24h validity
               if (data.startTime && (Date.now() - data.startTime < 24 * 60 * 60 * 1000)) {
                   const safePath = Array.isArray(data.path) ? data.path : [];
                   setPath(safePath);
                   setDistance(data.distance || 0);
                   setDuration(data.duration || 0);
                   setClosedPolygons(data.closedPolygons || []);
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
    // Logic to finalize run usually happens in parent
    setIsPaused(true);
  }, []);

  const clearRecovery = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(RECOVERY_KEY);
    }
  }, []);

  // Derived stats
  const distanceKm = distance / 1000;
  const pace = formatPace(duration, distanceKm);
  const durationStr = formatDuration(duration);
  const calories = Math.round(distanceKm * 70 * 1.036); // Approx calories

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
    closedPolygons,
    addManualLocation
  };
}
