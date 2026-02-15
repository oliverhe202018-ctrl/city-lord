import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { isNativePlatform, safeCheckGeolocationPermission, safeRequestGeolocationPermission, safeWatchPosition, safeClearWatch, safeGetCurrentPosition, type SafePosition } from '@/lib/capacitor/safe-plugins';
import gcoord from 'gcoord';

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
  source?: 'cache' | 'network-coarse' | 'gps-precise';
}

interface UseSafeGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

interface UseSafeGeolocationReturn {
  location: GeoPoint | null;
  loading: boolean;
  error: string | null;
  gpsSignalStrength: 'good' | 'weak' | 'none';
  retry: () => void;
}

export function useSafeGeolocation(options: UseSafeGeolocationOptions = {}): UseSafeGeolocationReturn {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gpsSignalStrength, setGpsSignalStrength] = useState<'good' | 'weak' | 'none'>('none');
  
  const watchId = useRef<string | null>(null);
  const lastValidLocation = useRef<GeoPoint | null>(null);
  const retryCount = useRef(0);
  const isMounted = useRef(false);
  const phaseRef = useRef<'init' | 'coarse' | 'precise'>('init');

  // Constants
  const MAX_ACCURACY_THRESHOLD = 1000; // meters
  const SIGNAL_TIMEOUT = 10000; // 10 seconds to consider signal weak
  const STORAGE_KEY = 'last_known_location';

  const signalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetSignalTimeout = useCallback(() => {
    if (signalTimeoutRef.current) clearTimeout(signalTimeoutRef.current);
    setGpsSignalStrength('good');
    
    signalTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) {
        setGpsSignalStrength('weak');
        if (lastValidLocation.current) {
           toast.warning("GPS信号弱", { description: "正在尝试恢复连接..." });
        }
      }
    }, SIGNAL_TIMEOUT);
  }, []);

  const isValidCoordinate = (lat: number, lng: number) => {
    return lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);
  };

  const processPosition = useCallback((position: SafePosition, source: 'network-coarse' | 'gps-precise') => {
    if (!isMounted.current) return;

    const { lat: latitude, lng: longitude, accuracy, heading, speed } = position;

    // 1. Null Island Check
    if (!isValidCoordinate(latitude, longitude)) {
      console.warn("Blocked Null Island coordinate:", latitude, longitude);
      return;
    }

    // 2. Accuracy Filter
    // Allow first point regardless of accuracy (to show *something*), then filter
    // For coarse location, we accept lower accuracy
    const threshold = source === 'network-coarse' ? 5000 : MAX_ACCURACY_THRESHOLD;
    if (lastValidLocation.current && accuracy > threshold) {
      console.debug(`Skipping low accuracy point: ${accuracy}m`);
      return;
    }

    // 3. Coordinate Transformation (WGS84 -> GCJ02 for AMap)
    let finalLat = latitude;
    let finalLng = longitude;

    try {
        const result = gcoord.transform(
          [longitude, latitude],
          gcoord.WGS84,
          gcoord.GCJ02
        );
        finalLng = result[0];
        finalLat = result[1];
    } catch (e) {
        console.error("Coordinate transform failed", e);
    }

    const newLocation: GeoPoint = {
      lat: finalLat,
      lng: finalLng,
      accuracy,
      heading,
      speed,
      timestamp: position.timestamp,
      source
    };

    lastValidLocation.current = newLocation;
    setLocation(newLocation);
    setLoading(false);
    setError(null);
    resetSignalTimeout();
    
    // Save to cache
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocation));
    } catch (e) {
      console.error("Failed to save location to cache", e);
    }
  }, [resetSignalTimeout]);

  const handleError = useCallback(async (err: any) => {
    if (!isMounted.current) return;
    
    console.error("Geolocation error:", err);
    
    // Don't clear last location on error, just update status
    // If we have cached location, we are not strictly "loading"
    if (!lastValidLocation.current) {
        setLoading(false);
    }
    
    // Check real permission status if possible (for Web)
    let realPermissionState = 'unknown';
    if (!isNativePlatform() && typeof navigator !== 'undefined' && navigator.permissions) {
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            realPermissionState = result.state;
        } catch (e) {}
    }

    const isDeniedError = err.code === 1 || err.message?.includes('denied') || err.message?.includes('permission');
    
    if (isDeniedError) {
        if (realPermissionState === 'prompt') {
            return; 
        }

        setError('PERMISSION_DENIED');
        setGpsSignalStrength('none');
        if (!lastValidLocation.current) {
             toast.error("定位权限被拒绝", { description: "请前往设置允许访问位置信息" });
        }
    } else if (err.code === 3 || err.message?.includes('timeout')) {
        if (realPermissionState === 'prompt') {
             return;
        }

        if (!lastValidLocation.current) {
            setError('TIMEOUT');
        }
    } else {
        setError(err.message || 'UNKNOWN_ERROR');
    }
  }, []);

  const startWatching = useCallback(async (enableHighAccuracy: boolean, source: 'network-coarse' | 'gps-precise') => {
    try {
        // Native Permission Check
        if (await isNativePlatform()) {
            const permStatus = await safeCheckGeolocationPermission();
            if (permStatus !== 'granted') {
                const request = await safeRequestGeolocationPermission();
                if (request !== 'granted') {
                    throw new Error('Permission denied');
                }
            }
        }

        // Clear existing watch
        if (watchId.current) {
            await safeClearWatch(watchId.current);
            watchId.current = null;
        }

        // Start Watch
        watchId.current = await safeWatchPosition(
            (position, err) => {
                if (err) {
                    handleError(err);
                } else if (position) {
                    processPosition(position, source);
                }
            },
            {
                enableHighAccuracy,
                timeout: enableHighAccuracy ? 30000 : 5000, // Shorter timeout for coarse
                maximumAge: 0
            }
        );

    } catch (e: any) {
        handleError(e);
    }
  }, [handleError, processPosition]);

  const initStrategy = useCallback(async () => {
      // Level 1: Load from Cache (0ms) - Immediate feedback
      try {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) {
              const parsed = JSON.parse(cached);
              // Basic validation
              if (parsed && parsed.lat && parsed.lng) {
                  parsed.source = 'cache';
                  setLocation(parsed);
                  lastValidLocation.current = parsed;
                  setLoading(false); // Immediate display
              }
          }
      } catch (e) {
          console.error("Failed to load location from cache", e);
      }

      // Level 2: Fast Coarse Location (<2s) - Network based
      // Use getCurrentPosition for a quick "one-shot" estimate
      phaseRef.current = 'coarse';
      try {
          // Don't await if we want to start Level 3 in parallel? 
          // User asked for: "This will utilize cell towers and Wi-Fi to quickly return an approximate location"
          // and "Do not wait for any API" (for Level 1).
          // For Level 2, we can await it with a short timeout.
          const coarsePos = await safeGetCurrentPosition({
              enableHighAccuracy: false,
              timeout: 2000, // Short timeout as requested
              maximumAge: Infinity // Accept any cached position
          });
          
          if (coarsePos && isMounted.current) {
             processPosition(coarsePos, 'network-coarse');
          }
      } catch (e) {
          // Ignore error, proceed to precise
          console.debug("Coarse location failed or timed out, proceeding to precise...", e);
      }

      // Level 3: Precise GPS Correction (>2s)
      if (isMounted.current) {
          phaseRef.current = 'precise';
          console.log("Starting precise GPS watch...");
          // Enable high accuracy for the long-running watch
          startWatching(true, 'gps-precise');
      }

  }, [startWatching, processPosition]);

  const retry = useCallback(() => {
    retryCount.current += 1;
    initStrategy();
  }, [initStrategy]);

  useEffect(() => {
    isMounted.current = true;
    initStrategy();

    return () => {
      isMounted.current = false;
      if (watchId.current) {
        safeClearWatch(watchId.current);
      }
      if (signalTimeoutRef.current) {
        clearTimeout(signalTimeoutRef.current);
      }
    };
  }, []); // Run once on mount

  return {
    location,
    loading,
    error,
    gpsSignalStrength,
    retry
  };
}
