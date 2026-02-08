import { useState, useEffect, useRef, useCallback } from 'react';
import gcoord from 'gcoord';
import * as turf from '@turf/turf';
import { LocationService } from '@/utils/locationService';

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
  rawDuration: number; // seconds
  closedPolygons: Location[][]; // New: Array of closed polygons
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

  const handleLocationUpdate = useCallback((lat: number, lng: number) => {
    if (isPausedRef.current) return;

    const newLoc: Location = {
      lat,
      lng,
      timestamp: Date.now()
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
        setDistance(prev => prev + dist);
        
        // Loop Detection Logic
        const currentPath = [...pathRef.current, newLoc];
        setPath(currentPath);
        pathRef.current = currentPath; // Update ref immediately to prevent race conditions
        lastLocationRef.current = newLoc;

        if (currentPath.length > 5) {
           const startPoint = currentPath[0];
           const endPoint = newLoc;
           
           const from = turf.point([startPoint.lng, startPoint.lat]);
           const to = turf.point([endPoint.lng, endPoint.lat]);
           const gap = turf.distance(from, to, { units: 'meters' });

           if (gap < 20) {
               console.log("Loop Closed! Gap:", gap);
               setClosedPolygons(prev => [...prev, currentPath]);
               setPath([newLoc]);
               // Manually update pathRef for immediate subsequent updates
               pathRef.current = [newLoc];
           }
        }
      }
    } else {
      setPath([newLoc]);
      lastLocationRef.current = newLoc;
    }
  }, []);

  // Location Service & Event Listener
  useEffect(() => {
    let isSubscribed = true;

    const startService = async () => {
      if (isRunning && !watcherIdRef.current) {
        try {
          const id = await LocationService.startTracking();
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
        handleLocationUpdate(gcj02[1], gcj02[0]);
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

  // Reset when stopping or starting fresh
  useEffect(() => {
    if (!isRunning) {
      // When stopped, we might want to keep data for summary, 
      // but if re-entering, we might reset. 
      // For now, let's assume parent handles reset if needed.
      // But typically hooks reset state on unmount or explicit reset.
      // Here we don't auto-reset state to allow viewing summary.
    } else if (isRunning && duration === 0 && distance === 0) {
       // Just started
       setPath([]);
       setClosedPolygons([]);
       lastLocationRef.current = null;
    }
  }, [isRunning]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const stop = useCallback(() => {
    // Logic to finalize run usually happens in parent
    setIsPaused(true);
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
    rawDuration: duration,
    closedPolygons
  };
}
