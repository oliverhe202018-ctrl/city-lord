import { useState, useEffect, useRef } from 'react';
import { useSafeGeolocation, GeoPoint, LocationStatus } from '@/hooks/useSafeGeolocation';
import { toast } from 'sonner';
import { wgs84ToGcj02 } from '@/lib/utils/coord-transform';

interface UseFastLocationReturn {
  location: GeoPoint | null;
  loading: boolean;
  error: 'PERMISSION_DENIED' | 'TIMEOUT' | 'UNAVAILABLE' | 'UNKNOWN' | null;
  status: LocationStatus;
  retry: () => void;
}

/**
 * useFastLocation
 * 
 * A wrapper around useSafeGeolocation designed specifically for scenarios needing
 * immediate location feedback (e.g., entering running mode).
 * 
 * Features:
 * - Falls back to valid cache (`last_known_location`) immediately to achieve < 2s TTFF (Time To First Fix).
 * - Monitors for timeout and shows a Toast UI automatically.
 */
export function useFastLocation(): UseFastLocationReturn {
  const { location, loading, error, status, retry } = useSafeGeolocation({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
  });

  const [fastLocation, setFastLocation] = useState<GeoPoint | null>(null);
  const [isFastLoading, setIsFastLoading] = useState(true);
  const toastShownRef = useRef(false);

  useEffect(() => {
    // 1. Immediately try to serve from Cache to guarantee < 2s response
    if (isFastLoading && !location) {
      try {
        const cached = localStorage.getItem('last_known_location');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            // Already GCJ02 since it's cached by useSafeGeolocation
            setFastLocation({ ...parsed, source: 'cache' });
            setIsFastLoading(false);
          }
        }
      } catch (e) {
        // Silently ignore cache issues
      }
    }

    // 2. If true location arrives, update it
    if (location) {
      if (location.coordSystem === 'gcj02') {
        setFastLocation(location);
      } else {
        const transformed = wgs84ToGcj02(location.lng, location.lat);
        setFastLocation({
          ...location,
          lng: transformed.lng,
          lat: transformed.lat,
          coordSystem: 'gcj02'
        });
      }
      setIsFastLoading(false);
      // Reset toast flag on success
      toastShownRef.current = false;
    }
  }, [location, isFastLoading]);

  // 3. Handle Timeouts & Degradation
  useEffect(() => {
    if (error === 'TIMEOUT' && !toastShownRef.current) {
      toast.info("GPS信号弱，正在重新定位");
      toastShownRef.current = true;
    }
  }, [error]);

  return {
    location: fastLocation,
    loading: isFastLoading,
    error,
    status,
    retry
  };
}
