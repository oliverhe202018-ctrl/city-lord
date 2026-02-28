import { useState, useEffect, useRef, useCallback } from 'react';
import { isNativePlatform, safeCheckGeolocationPermission, safeRequestGeolocationPermission, safeWatchPosition, safeClearWatch, safeGetCurrentPosition, safeAppAddListener, type SafePosition } from '@/lib/capacitor/safe-plugins';
import gcoord from 'gcoord';

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
  source?: 'cache' | 'network-coarse' | 'gps-precise' | 'amap-native' | 'amap-native-cache' | 'web-fallback';
  coordSystem?: string;
}

// State machine for location status
export type LocationStatus = 'initializing' | 'locating' | 'locked' | 'error';

// Geographic bounds for China (with buffer)
export const CHINA_BOUNDS = {
  minLat: 18,
  maxLat: 54,
  minLng: 73,
  maxLng: 136
} as const;

/**
 * Validate GeoPoint with comprehensive checks:
 * - Null Island (0,0) prevention
 * - NaN detection
 * - Geographic bounds (China region)
 */
export function isValidGeoPoint(point: Partial<GeoPoint> | null): point is GeoPoint {
  if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
    return false;
  }

  const { lat, lng } = point;

  // Null Island check (within ±0.001° tolerance)
  if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) {
    console.warn('[useSafeGeolocation] Blocked Null Island coordinate:', lat, lng);
    return false;
  }

  // NaN check
  if (isNaN(lat) || isNaN(lng)) {
    console.warn('[useSafeGeolocation] Blocked NaN coordinate');
    return false;
  }

  // China bounds check
  if (lat < CHINA_BOUNDS.minLat || lat > CHINA_BOUNDS.maxLat) {
    console.warn('[useSafeGeolocation] Coordinate outside China bounds (lat):', lat);
    return false;
  }
  if (lng < CHINA_BOUNDS.minLng || lng > CHINA_BOUNDS.maxLng) {
    console.warn('[useSafeGeolocation] Coordinate outside China bounds (lng):', lng);
    return false;
  }

  return true;
}

interface UseSafeGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

interface UseSafeGeolocationReturn {
  location: GeoPoint | null;
  loading: boolean;
  error: 'PERMISSION_DENIED' | 'TIMEOUT' | 'UNAVAILABLE' | 'UNKNOWN' | null;
  gpsSignalStrength: 'good' | 'weak' | 'none';
  status: LocationStatus; // NEW: State machine status
  retry: () => void;
  getDebugData: () => any;
}

export function useSafeGeolocation(options: UseSafeGeolocationOptions = {}): UseSafeGeolocationReturn {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UseSafeGeolocationReturn['error']>(null);
  const [gpsSignalStrength, setGpsSignalStrength] = useState<'good' | 'weak' | 'none'>('none');
  const [status, setStatus] = useState<LocationStatus>('initializing');

  const watchId = useRef<string | null>(null);
  const lastValidLocation = useRef<GeoPoint | null>(null);
  const isMounted = useRef(false);
  const currentLevelRef = useRef<number>(0); // 0: cache, 1: network-coarse, 2: gps-precise

  const STORAGE_KEY = 'last_known_location';
  const SIGNAL_TIMEOUT = 30000;
  const signalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // C.4, C.5 refs
  const restartInFlightRef = useRef<boolean>(false);
  const lastToastTimeRef = useRef<Record<string, number>>({});
  const appStateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetSignalTimeout = useCallback(() => {
    if (signalTimeoutRef.current) clearTimeout(signalTimeoutRef.current);
    setGpsSignalStrength('good');

    signalTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) {
        setGpsSignalStrength('weak');
        // Silent — no toast per UX requirement. Background state only.
        console.debug('[useSafeGeolocation] GPS signal weak (30s timeout)');
      }
    }, SIGNAL_TIMEOUT);
  }, []);

  // Accuracy thresholds for running game (CRITICAL for polygon integrity)
  const ACCURACY_THRESHOLD_GPS = 200; // meters (relax initially, handled in MapRoot)
  const ACCURACY_THRESHOLD_NETWORK = 5000; // meters

  const processPosition = useCallback((position: SafePosition | GeoPoint, source: 'cache' | 'network-coarse' | 'gps-precise') => {
    if (!isMounted.current) return;

    const incomingLevel = source === 'gps-precise' ? 2 : (source === 'network-coarse' ? 1 : 0);
    if (incomingLevel < currentLevelRef.current) {
      console.debug(`[useSafeGeolocation] Ignored downgraded source: ${source} (current level: ${currentLevelRef.current})`);
      return;
    }
    currentLevelRef.current = incomingLevel;

    const { lat: latitude, lng: longitude, accuracy = 9999, heading, speed, timestamp } = position;

    // Step 1: Validate coordinates BEFORE transformation
    const tempPoint: GeoPoint = {
      lat: latitude,
      lng: longitude,
      accuracy,
      heading,
      speed,
      timestamp: position.timestamp,
      source
    };

    if (!isValidGeoPoint(tempPoint)) {
      console.warn("[useSafeGeolocation] Rejected invalid coordinate:", tempPoint);
      return;
    }

    // Step 2: Accuracy filtering (CRITICAL for running game polygon integrity)
    const threshold = source === 'network-coarse' ? ACCURACY_THRESHOLD_NETWORK : ACCURACY_THRESHOLD_GPS;

    if (accuracy > threshold) {
      // Reject low accuracy to protect polygon calculations
      // No per-point toast — the sustained SIGNAL_TIMEOUT (30s) handles weak signal UX
      console.debug(`[useSafeGeolocation] Rejected low accuracy: ${accuracy}m (threshold: ${threshold}m, source: ${source})`);
      return;
    }

    // Step 3: Transform WGS84 to GCJ02 (required for AMap)
    let finalLat = latitude;
    let finalLng = longitude;

    if ((position as any).coordSystem === 'gcj02') {
      // Fix 5: Skip transform if already gcj02 (from cache or directly from plugin)
    } else {
      try {
        const result = gcoord.transform([longitude, latitude], gcoord.WGS84, gcoord.GCJ02);
        finalLng = result[0];
        finalLat = result[1];
      } catch (e) {
        console.error("[useSafeGeolocation] Coordinate transform failed", e);
        return; // Reject on transform failure
      }
    }

    // Step 4: Create final validated location
    const newLocation: GeoPoint & { coordSystem?: string } = {
      lat: finalLat,
      lng: finalLng,
      accuracy,
      heading,
      speed,
      timestamp: timestamp || position.timestamp || Date.now(),
      source,
      coordSystem: 'gcj02'
    };

    // Step 5: Update state
    lastValidLocation.current = newLocation;
    setLocation(newLocation);
    setLoading(false);
    setStatus('locked'); // State machine: locked (GPS acquired)
    setError(null);
    resetSignalTimeout();

    // Step 6: Save to cache with QuotaExceededError mitigation
    // useSafeGeolocation is the authoritative source — always write.
    // Source-level downgrades are already prevented by currentLevelRef.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...newLocation, fetchedAt: Date.now() }));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn("[useSafeGeolocation] Quota exceeded. Evicting old cache...");
        try {
          // LIFO/FIFO generic eviction of related tracking keys
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.includes('recovery') || k.includes('track') || k === STORAGE_KEY)) {
              keysToRemove.push(k);
            }
          }
          // Remove the oldest/first found
          if (keysToRemove.length > 0) {
            localStorage.removeItem(keysToRemove[0]);
          } else {
            localStorage.clear(); // Last resort
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...newLocation, fetchedAt: Date.now() }));
        } catch (err) {
          console.error("[useSafeGeolocation] Cache rewrite failed", err);
        }
      } else {
        console.error("[useSafeGeolocation] Cache save failed", e);
      }
    }
  }, [resetSignalTimeout]);

  const handleError = useCallback((err: any, explicitUserAction = false) => {
    if (!isMounted.current) return;

    console.error("[useSafeGeolocation] Geolocation error:", err);
    setLoading(false);
    setGpsSignalStrength('none');
    setStatus('error'); // State machine: error state

    const message = err.message?.toLowerCase() || '';
    const now = Date.now();

    // C.5: Helper to throttle toasts (30s cooldown)
    const showToastThrottled = (type: string, msg: string) => {
      const lastTime = lastToastTimeRef.current[type] || 0;
      if (now - lastTime > 30000 || explicitUserAction) {
        lastToastTimeRef.current[type] = now;
        // Suppress fallback messages if we have a valid cache (unless user manually retried - assumed if loading was explicitly re-set)
        if (type !== 'PERMISSION_DENIED' && lastValidLocation.current && !explicitUserAction) {
          console.debug(`[useSafeGeolocation] Suppressed toast "${msg}" due to existing valid location`);
          return;
        }
        import('sonner').then(({ toast }) => toast.error(msg));
      }
    };

    if (err.code === 1 || message.includes('denied')) {
      setError('PERMISSION_DENIED');
      setLocation(null); // Clear location on permission denial
      console.warn('[useSafeGeolocation] Location permission denied');
      showToastThrottled('PERMISSION_DENIED', '请前往系统设置开启定位权限');
    } else if (err.code === 3 || message.includes('timeout')) {
      setError('TIMEOUT');
      console.warn('[useSafeGeolocation] Location timeout');
      showToastThrottled('TIMEOUT', '定位超时，正在降级重试...');
    } else if (err.code === 2 || message.includes('unavailable') || message.includes('not available')) {
      setError('UNAVAILABLE');
      setLocation(null);
      console.warn('[useSafeGeolocation] Location service unavailable');
      showToastThrottled('UNAVAILABLE', '网络离线或无GPS信号，已降级...');
    } else {
      setError('UNKNOWN');
      console.warn('[useSafeGeolocation] Unknown location error:', err.message);
    }
  }, []);

  const startWatching = useCallback(async () => {
    // C.6: Clear before re-watch to ensure exclusivity
    if (watchId.current) {
      const id = watchId.current;
      try {
        await safeClearWatch(id);
      } catch (e) {
        console.debug('[useSafeGeolocation] safeClearWatch error in startWatching:', e);
      } finally {
        watchId.current = null;
      }
    }

    try {
      setStatus('locating'); // State machine: locating (watching GPS)
      watchId.current = await safeWatchPosition(
        (position, err) => {
          if (err) handleError(err);
          else if (position) processPosition(position, 'gps-precise');
        },
        {
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          timeout: options.timeout ?? 8000,
          maximumAge: options.maximumAge ?? 5000
        }
      );
    } catch (e) {
      handleError(e);
    }
  }, [handleError, processPosition]);

  const requestPermissionsAndStart = useCallback(async (explicitUserAction = false) => {
    // C.4: Anti-reentry guard
    if (restartInFlightRef.current) {
      console.debug('[useSafeGeolocation] requestPermissionsAndStart blocked by anti-reentry');
      return;
    }

    restartInFlightRef.current = true;
    try {
      // Fix 5: Only set loading to true if we don't already have a valid cache location
      if (!lastValidLocation.current) {
        setLoading(true);
      }
      setError(null);

      let permission: string;
      if (await isNativePlatform()) {
        permission = await safeRequestGeolocationPermission();
      } else {
        // Standard Web API flow
        permission = await new Promise<string>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve('granted'),
            (err) => {
              if (err.code === err.PERMISSION_DENIED) resolve('denied');
              else resolve('prompt'); // Or handle other errors
            }
          );
        });
      }

      if (permission === 'granted') {
        // First, get a quick coarse position
        try {
          const coarsePos = await safeGetCurrentPosition({ enableHighAccuracy: false, timeout: 2000, maximumAge: 60000 });
          if (coarsePos && isMounted.current) {
            processPosition(coarsePos, 'network-coarse');
          }
        } catch (e) {
          console.debug("Coarse location failed, proceeding to watch.", e);
        }
        // Then start the high-accuracy watch
        await startWatching();
      } else {
        throw new Error('Permission denied');
      }
    } catch (e) {
      handleError(e, explicitUserAction);
    } finally {
      restartInFlightRef.current = false;
    }
  }, [startWatching, processPosition, handleError]);


  const init = useCallback(() => {
    // 1. Load from cache immediately for instant UI
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          parsed.source = 'cache';
          if (!parsed.timestamp) parsed.timestamp = Date.now();
          // Migration: if cache doesn't have coordSystem, assume it's gcj02
          if (!parsed.coordSystem) {
            parsed.coordSystem = 'gcj02';
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            } catch (err) {
              console.warn('[useSafeGeolocation] Migration write failed', err);
            }
          }
          // Fix 5: Let processPosition handle the state machine logic uniformly
          processPosition(parsed, 'cache');
        }
      }
    } catch (e) {
      console.error("Failed to load location from cache", e);
    }

    // 2. Then, start the permission and location process
    requestPermissionsAndStart(false);
  }, [processPosition, requestPermissionsAndStart]);

  useEffect(() => {
    isMounted.current = true;
    init();

    // App Resume listener
    let appListenerHandle: { remove: () => void } | null = null;
    let isActive = true;
    let isListenerMounted = true;

    safeAppAddListener('appStateChange', (state) => {
      if (appStateTimerRef.current) clearTimeout(appStateTimerRef.current);
      appStateTimerRef.current = setTimeout(async () => {
        appStateTimerRef.current = null;
        if (!isMounted.current) return;
        if (state.isActive && !isActive) {
          console.debug('[useSafeGeolocation] App resumed, restarting location tracking');
          if (watchId.current) {
            const id = watchId.current;
            try { await safeClearWatch(id); } catch (e) { console.debug(e); } finally { watchId.current = null; }
          }
          requestPermissionsAndStart(false);
        } else if (!state.isActive && isActive) {
          console.debug('[useSafeGeolocation] App paused, clearing location tracking to save power');
          if (watchId.current) {
            const id = watchId.current;
            try { await safeClearWatch(id); } catch (e) { console.debug(e); } finally { watchId.current = null; }
          }
        }
        isActive = state.isActive;
      }, 500);
    }).then((handle: any) => {
      if (!isListenerMounted) {
        // A.2: Ensure App listener is cleaned up even if component unmounts early
        if (handle && typeof handle.remove === 'function') handle.remove();
      } else {
        appListenerHandle = handle;
      }
    });

    return () => {
      isMounted.current = false;
      isListenerMounted = false;
      if (appListenerHandle && typeof appListenerHandle.remove === 'function') {
        appListenerHandle.remove();
      }
      if (watchId.current) {
        const idToClear = watchId.current;
        (async () => {
          try { await safeClearWatch(idToClear); } catch (e) { console.debug(e); } finally { watchId.current = null; }
        })();
        // Explicitly clear standard navigator watch as well if fallback was used
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
          try {
            navigator.geolocation.clearWatch(parseInt(idToClear, 10));
          } catch (e) { }
        }
      }
      if (appStateTimerRef.current) {
        clearTimeout(appStateTimerRef.current);
        appStateTimerRef.current = null;
      }
      if (signalTimeoutRef.current) {
        clearTimeout(signalTimeoutRef.current);
        signalTimeoutRef.current = null;
      }
    };
  }, [init, requestPermissionsAndStart]);

  return {
    location,
    loading,
    error,
    gpsSignalStrength,
    status, // State machine status
    retry: () => {
      // Allow manual retry to bypass throttle
      lastToastTimeRef.current = {};
      requestPermissionsAndStart(true);
    },
    getDebugData: () => ({
      watchIdExists: watchId.current !== null,
      restartInFlight: restartInFlightRef.current,
    })
  };
}
