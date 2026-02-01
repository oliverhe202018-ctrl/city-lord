
"use client";

import { useState, useEffect, useCallback } from 'react';

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

interface GeolocationState {
  loading: boolean;
  error: GeolocationPositionError | null;
  data: {
    latitude: number;
    longitude: number;
  } | null;
}

interface UseGeolocationProps {
  options?: GeolocationOptions;
  watch?: boolean;
  disabled?: boolean;
}


/**
 * AMap-compatible geolocation hook.
 * It can be used for one-time location retrieval or for watching position changes.
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

  // Destructure options to create stable dependencies for hooks.
  const { enableHighAccuracy, timeout, maximumAge } = options;

  const getLocation = useCallback(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState({
            loading: false,
            error: null,
            data: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          });
        },
        (error) => {
          setState({
            loading: false,
            error,
            data: null,
          });
        },
        // Pass the original options object
        { enableHighAccuracy, timeout, maximumAge }
      );
    } else {
      // Geolocation is not supported
      setState((prev) => ({
        ...prev,
        loading: false,
        error: {
          code: 0,
          message: "Geolocation is not supported by this browser.",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError,
      }));
    }
  }, [enableHighAccuracy, timeout, maximumAge]);

  useEffect(() => {
    if (disabled) {
      setState({ loading: false, error: null, data: null });
      return;
    }

    if (!watch) {
      getLocation();
    }
  }, [getLocation, watch, disabled]);

  useEffect(() => {
    if (disabled) {
      return;
    }

    if (watch && typeof window !== 'undefined' && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setState({
            loading: false,
            error: null,
            data: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          });
        },
        (error) => {
          setState((prev) => ({ ...prev, loading: false, error }));
        },
        // Pass the original options object
        { enableHighAccuracy, timeout, maximumAge }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [watch, enableHighAccuracy, timeout, maximumAge, disabled]);

  const refetch = useCallback(() => {
    if (!disabled) {
      getLocation();
    }
  }, [disabled, getLocation]);

  return { ...state, refetch };
};
