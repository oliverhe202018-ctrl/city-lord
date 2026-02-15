import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { isNativePlatform, safeCheckGeolocationPermission, safeRequestGeolocationPermission, safeWatchPosition, safeClearWatch, type SafePosition } from '@/lib/capacitor/safe-plugins';
import gcoord from 'gcoord';

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
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

  // Constants
  const MAX_ACCURACY_THRESHOLD = 1000; // meters
  const SIGNAL_TIMEOUT = 10000; // 10 seconds to consider signal weak
  const DEFAULT_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 30000, // Increased to 30s to allow user time to accept permission
    maximumAge: 0,
    ...options
  };

  const signalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetSignalTimeout = useCallback(() => {
    if (signalTimeoutRef.current) clearTimeout(signalTimeoutRef.current);
    setGpsSignalStrength('good');
    
    signalTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) {
        setGpsSignalStrength('weak');
        // Toast only if we had a location before but lost it
        if (lastValidLocation.current) {
           toast.warning("GPS信号弱", { description: "正在尝试恢复连接..." });
        }
      }
    }, SIGNAL_TIMEOUT);
  }, []);

  const isValidCoordinate = (lat: number, lng: number) => {
    return lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);
  };

  const processPosition = useCallback((position: SafePosition) => {
    if (!isMounted.current) return;

    const { lat: latitude, lng: longitude, accuracy, heading, speed } = position;

    // 1. Null Island Check
    if (!isValidCoordinate(latitude, longitude)) {
      console.warn("Blocked Null Island coordinate:", latitude, longitude);
      return;
    }

    // 2. Accuracy Filter
    // Allow first point regardless of accuracy (to show *something*), then filter
    if (lastValidLocation.current && accuracy > MAX_ACCURACY_THRESHOLD) {
      console.debug(`Skipping low accuracy point: ${accuracy}m`);
      return;
    }

    // 3. Coordinate Transformation (WGS84 -> GCJ02 for AMap)
    // Capacitor and Navigator return WGS84. AMap needs GCJ02.
    // Note: If using AMap's Geolocation plugin, it might already do this, 
    // but here we are using Capacitor/Browser native API directly.
    let finalLat = latitude;
    let finalLng = longitude;

    // We assume we need GCJ02 for the map in China
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
      timestamp: position.timestamp
    };

    lastValidLocation.current = newLocation;
    setLocation(newLocation);
    setLoading(false);
    setError(null);
    resetSignalTimeout();
  }, [resetSignalTimeout]);

  const handleError = useCallback(async (err: any) => {
    if (!isMounted.current) return;
    
    console.error("Geolocation error:", err);
    
    // Don't clear last location on error, just update status
    setLoading(false);
    
    // Check real permission status if possible (for Web)
    let realPermissionState = 'unknown';
    if (!isNativePlatform() && typeof navigator !== 'undefined' && navigator.permissions) {
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            realPermissionState = result.state;
        } catch (e) {}
    }

    // User denied permission
    // Only treat as hard denial if error says so AND (native OR web state is explicitly denied)
    // If web state is 'prompt', it means the user ignored it or it timed out while prompting -> Don't show "Denied" error yet.
    const isDeniedError = err.code === 1 || err.message?.includes('denied') || err.message?.includes('permission');
    
    if (isDeniedError) {
        if (realPermissionState === 'prompt') {
            // It timed out or failed while prompting. Do NOT show error, maybe retry silently?
            // Actually, if it's prompt, we should just stay loading or show a soft hint?
            console.log("Permission error but state is prompt - likely timeout waiting for user.");
            // We can extend the wait? Or just do nothing and let the user decide?
            // If we set error, the modal shows.
            return; 
        }

        setError('PERMISSION_DENIED');
        setGpsSignalStrength('none');
        // Only toast if it's a fresh hard failure
        if (!lastValidLocation.current) {
             // Only toast if explicitly denied
             toast.error("定位权限被拒绝", { description: "请前往设置允许访问位置信息" });
        }
    } else if (err.code === 3 || err.message?.includes('timeout')) {
        // Timeout
        // If we are still 'prompt', it means user is slow.
        if (realPermissionState === 'prompt') {
             console.log("Geolocation timeout while prompting.");
             // Retry with longer timeout?
             return;
        }

        // Keep "weak" status if we have data, otherwise error
        if (!lastValidLocation.current) {
            setError('TIMEOUT');
        }
    } else {
        setError(err.message || 'UNKNOWN_ERROR');
    }
  }, []);

  const startWatching = useCallback(async () => {
    setLoading(true);
    setError(null);

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
        }

        // Start Watch
        watchId.current = await safeWatchPosition(
            (position, err) => {
                if (err) {
                    handleError(err);
                } else if (position) {
                    processPosition(position);
                }
            },
            DEFAULT_OPTIONS
        );

    } catch (e: any) {
        handleError(e);
    }
  }, [DEFAULT_OPTIONS, handleError, processPosition]);

  const retry = useCallback(() => {
    retryCount.current += 1;
    startWatching();
  }, [startWatching]);

  useEffect(() => {
    isMounted.current = true;
    startWatching();

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
