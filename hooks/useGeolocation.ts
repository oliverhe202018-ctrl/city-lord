"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { toast } from 'sonner';

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
    coordType?: 'wgs84'; // Capacitor default is WGS84
  } | null;
}

interface UseGeolocationProps {
  options?: GeolocationOptions;
  watch?: boolean;
  disabled?: boolean;
}

/**
 * Capacitor-based geolocation hook.
 * Replaces the old Android Bridge and Navigator fallback.
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

  const getLocation = useCallback(async () => {
    if (disabled) return;
    
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy,
        timeout,
        maximumAge
      });

      if (!isMounted.current) return;

      setState({
        loading: false,
        error: null,
        data: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          coordType: 'wgs84',
        },
      });
    } catch (error: any) {
      console.error("Geolocation Error:", error);
      
      if (!isMounted.current) return;

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
  }, [enableHighAccuracy, timeout, maximumAge, disabled]);

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
        Geolocation.clearWatch({ id: watchIdRef.current });
        watchIdRef.current = null;
      }
      return;
    }

    const startWatch = async () => {
      try {
        const id = await Geolocation.watchPosition(
          {
            enableHighAccuracy,
            timeout,
            maximumAge
          },
          (position, err) => {
            if (!isMounted.current) return;

            if (err) {
              setState((prev) => ({ ...prev, loading: false, error: err }));
              return;
            }

            if (position) {
              setState({
                loading: false,
                error: null,
                data: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  coordType: 'wgs84',
                },
              });
            }
          }
        );
        watchIdRef.current = id;
      } catch (err) {
        console.error("Failed to start watch:", err);
      }
    };

    startWatch();

    return () => {
      if (watchIdRef.current) {
        Geolocation.clearWatch({ id: watchIdRef.current });
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
