"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { isNativePlatform, safeCheckGeolocationPermission, safeRequestGeolocationPermission, safeGetCurrentPosition, safeWatchPosition, safeClearWatch, type SafePosition } from '@/lib/capacitor/safe-plugins';

import gcoord from 'gcoord';

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

interface GeolocationState {
  loading: boolean;
  error: any | null;
  data: {
    latitude: number;
    longitude: number;
    coordType?: 'gcj02' | 'wgs84'; // Transformed to GCJ-02 for AMap
  } | null;
}

interface UseGeolocationProps {
  options?: GeolocationOptions;
  watch?: boolean;
  disabled?: boolean;
}

import { useGameStore } from '@/store/useGameStore';

/**
 * Capacitor-based geolocation hook with WGS84 -> GCJ02 transformation.
 * 
 * @param options Geolocation options
 * @param watch Whether to watch for position changes
 * @returns Geolocation state, and a function to manually trigger a location fix.
 */
export const useGeolocation = ({
  options = {},
  watch = false,
  disabled = false,
}: UseGeolocationProps = {}) => {
  const [state, setState] = useState<GeolocationState>({
    loading: !disabled,
    error: null,
    data: null,
  });

  const gpsCorrectionEnabled = useGameStore(state => state.appSettings?.gpsCorrectionEnabled ?? true);
  const lastKnownLocation = useGameStore(state => state.lastKnownLocation);
  const setLastKnownLocation = useGameStore(state => state.setLastKnownLocation);
  const setGpsStatus = useGameStore(state => state.setGpsStatus);
  
  const isMounted = useRef(true);
  const watchIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Destructure options to create stable dependencies for hooks.
  const { enableHighAccuracy, timeout, maximumAge } = options;

  const getLocation = useCallback(async (retryCount = 0) => {
    if (disabled) return;
    
    // Only set loading on first try
    if (retryCount === 0) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    try {
      let position: SafePosition | null = null;
      
      if (await isNativePlatform()) {
        // Request permissions first
        const permissionStatus = await safeCheckGeolocationPermission();
        if (permissionStatus !== 'granted') {
            const requestStatus = await safeRequestGeolocationPermission();
            if (requestStatus !== 'granted') {
                throw new Error('User denied location permission');
            }
        }
      }

      position = await safeGetCurrentPosition({
        enableHighAccuracy,
        timeout: timeout || 10000,
        maximumAge
      });

      if (!position || !isMounted.current) return;

      let latitude = position.lat;
      let longitude = position.lng;

      let coordType: 'gcj02' | 'wgs84' = 'wgs84';

      if (gpsCorrectionEnabled) {
        // Transform WGS-84 (Capacitor) to GCJ-02 (AMap)
        const result = gcoord.transform(
          [longitude, latitude],
          gcoord.WGS84,
          gcoord.GCJ02
        );
        longitude = result[0];
        latitude = result[1];
        coordType = 'gcj02';
      }

      // Update Store
      setLastKnownLocation({ lat: latitude, lng: longitude });
      setGpsStatus('success');

      setState({
        loading: false,
        error: null,
        data: {
          latitude,
          longitude,
          coordType,
        },
      });
    } catch (error: any) {
      console.error(`Geolocation Error (Attempt ${retryCount + 1}):`, error);
      
      if (!isMounted.current) return;

      // Retry Logic
      if (retryCount < 3) {
         console.log(`Retrying geolocation in 1s... (${retryCount + 1}/3)`);
         setTimeout(() => {
             if (isMounted.current) getLocation(retryCount + 1);
         }, 1000);
         return;
      }

      setState({
        loading: false,
        error: error,
        data: null,
      });

      // Show toast for error
      toast.error("获取位置失败", {
        description: error.message || "请检查定位权限是否开启"
      });
    }
  }, [enableHighAccuracy, timeout, maximumAge, disabled, gpsCorrectionEnabled, setLastKnownLocation]);

  // Initial Location Fetch
  useEffect(() => {
    if (disabled) {
      setState({ loading: false, error: null, data: null });
      return;
    }

    if (!watch) {
      getLocation();
    }
  }, [getLocation, watch, disabled]);

  // Watch Logic
  useEffect(() => {
    if (disabled || !watch) {
      if (watchIdRef.current) {
        safeClearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }


    const startWatch = async () => {
      try {
        const id = await safeWatchPosition(
          (position, err) => {
            if (!isMounted.current) return;

            if (err) {
              // Suppress error if we are just starting up or if it's a transient issue
              // But for watchPosition, err is usually significant. 
              // However, we want to match the "silence initial errors" philosophy.
              setState((prev) => ({ ...prev, loading: false, error: err }));
              return;
            }

            if (position) {
              processPosition(position);
            }
          },
          {
            enableHighAccuracy,
            timeout,
            maximumAge
          }
        );
        watchIdRef.current = id;
      } catch (err) {
        console.error("Failed to start watch:", err);
      }
    };

    // Helper to process position (deduplicate logic)
    const processPosition = (position: SafePosition) => {
      let latitude = position.lat;
      let longitude = position.lng;
      let coordType: 'gcj02' | 'wgs84' = 'wgs84';


      if (gpsCorrectionEnabled) {
        // Transform WGS-84 (Capacitor/Web) to GCJ-02 (AMap)
        const result = gcoord.transform(
          [longitude, latitude],
          gcoord.WGS84,
          gcoord.GCJ02
        );
        longitude = result[0];
        latitude = result[1];
        coordType = 'gcj02';
      }

      setState({
        loading: false,
        error: null,
        data: {
          latitude,
          longitude,
          coordType,
        },
      });
      
      // Update Store
      setLastKnownLocation({ lat: latitude, lng: longitude });
    };

    startWatch();

    return () => {
      if (watchIdRef.current) {
        safeClearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

  }, [watch, enableHighAccuracy, timeout, maximumAge, disabled]);

  const refetch = useCallback(() => {
    if (!disabled) {
      getLocation();
    }
  }, [disabled, getLocation]);

  return { ...state, refetch };
};
