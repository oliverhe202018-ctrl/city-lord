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

  const STORAGE_KEY = 'last_known_location';
  const SIGNAL_TIMEOUT = 10000;
  const signalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetSignalTimeout = useCallback(() => {
    if (signalTimeoutRef.current) clearTimeout(signalTimeoutRef.current);
    setGpsSignalStrength('good');

    signalTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) {
        setGpsSignalStrength('weak');
        toast.warning("GPS信号弱", { description: "正在尝试恢复连接..." });
      }
    }, SIGNAL_TIMEOUT);
  }, []);

  // Accuracy thresholds for running game (CRITICAL for polygon integrity)
  const ACCURACY_THRESHOLD_GPS = 50; // meters (was 1000)
  const ACCURACY_THRESHOLD_NETWORK = 100; // meters (was 5000)

  const processPosition = useCallback((position: SafePosition, source: 'network-coarse' | 'gps-precise') => {
    if (!isMounted.current) return;

    const { lat: latitude, lng: longitude, accuracy, heading, speed } = position;

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
      // Always reject low accuracy to protect polygon calculations
      console.debug(`[useSafeGeolocation] Rejected low accuracy: ${accuracy}m (threshold: ${threshold}m, source: ${source})`);

      // UX: Show toast for weak GPS signal (only for GPS source, and only occasionally)
      if (source === 'gps-precise' && Math.random() < 0.1) { // 10% chance to avoid spam
        toast.warning("GPS信号较弱", {
          description: `精度: ${Math.round(accuracy)}m (需要<${threshold}m)`,
          duration: 2000
        });
      }

      return;
    }

    // Step 3: Transform WGS84 to GCJ02 (required for AMap)
    let finalLat = latitude;
    let finalLng = longitude;

    try {
      const result = gcoord.transform([longitude, latitude], gcoord.WGS84, gcoord.GCJ02);
      finalLng = result[0];
      finalLat = result[1];
    } catch (e) {
      console.error("[useSafeGeolocation] Coordinate transform failed", e);
      return; // Reject on transform failure
    }

    // Step 4: Create final validated location
    const newLocation: GeoPoint = {
      lat: finalLat,
      lng: finalLng,
      accuracy,
      heading,
      speed,
      timestamp: position.timestamp,
      source
    };

    // Step 5: Update state
    lastValidLocation.current = newLocation;
    setLocation(newLocation);
    setLoading(false);
    setStatus('locked'); // State machine: locked (GPS acquired)
    setError(null);
    resetSignalTimeout();

    // Step 6: Save to cache
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocation));
    } catch (e) {
      console.error("[useSafeGeolocation] Failed to save location to cache", e);
    }
  }, [resetSignalTimeout]);

  const handleError = useCallback((err: any) => {
    if (!isMounted.current) return;

    console.error("[useSafeGeolocation] Geolocation error:", err);
    setLoading(false);
    setGpsSignalStrength('none');
    setStatus('error'); // State machine: error state

    const message = err.message?.toLowerCase() || '';
    if (message.includes('denied')) {
      setError('PERMISSION_DENIED');
      setLocation(null); // Clear location on permission denial
      toast.error("定位权限被拒绝", { description: "请在系统设置中允许应用访问位置信息。" });
    } else if (message.includes('timeout')) {
      setError('TIMEOUT');
      if (!lastValidLocation.current) {
        toast.error("定位超时", { description: "请检查网络和GPS信号后重试。" });
      }
    } else if (message.includes('unavailable') || message.includes('not available')) {
      setError('UNAVAILABLE');
      setLocation(null);
      toast.error("定位服务不可用", { description: "请检查设备是否开启GPS或定位服务。" });
    } else {
      setError('UNKNOWN');
      if (!lastValidLocation.current) {
        toast.error("定位失败", { description: "发生未知错误，请稍后重试。" });
      }
    }
  }, []);

  const startWatching = useCallback(async () => {
    if (watchId.current) {
      await safeClearWatch(watchId.current);
      watchId.current = null;
    }

    try {
      setStatus('locating'); // State machine: locating (watching GPS)
      watchId.current = await safeWatchPosition(
        (position, err) => {
          if (err) handleError(err);
          else if (position) processPosition(position, 'gps-precise');
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
    } catch (e) {
      handleError(e);
    }
  }, [handleError, processPosition]);

  const requestPermissionsAndStart = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
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
          const coarsePos = await safeGetCurrentPosition({ enableHighAccuracy: false, timeout: 3000 });
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
      handleError(e);
    }
  }, [startWatching, processPosition, handleError]);


  const init = useCallback(() => {
    // 1. Load from cache immediately for instant UI
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.lat && parsed.lng) {
          parsed.source = 'cache';
          setLocation(parsed);
          lastValidLocation.current = parsed;
          setLoading(false);
        }
      }
    } catch (e) {
      console.error("Failed to load location from cache", e);
    }

    // 2. Then, start the permission and location process
    requestPermissionsAndStart();
  }, [requestPermissionsAndStart]);

  useEffect(() => {
    isMounted.current = true;
    init();

    return () => {
      isMounted.current = false;
      if (watchId.current) {
        safeClearWatch(watchId.current);
      }
      if (signalTimeoutRef.current) {
        clearTimeout(signalTimeoutRef.current);
      }
    };
  }, [init]);

  return {
    location,
    loading,
    error,
    gpsSignalStrength,
    status, // State machine status
    retry: requestPermissionsAndStart
  };
}
