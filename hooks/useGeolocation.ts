"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

// 1. TypeScript Type Definitions
declare global {
  interface Window {
    AndroidApp?: {
      startLocation: () => void;
    };
    onNativeLocationSuccess?: (lat: number, lng: number, address: string) => void;
    onNativeLocationError?: (errorMessage: string) => void;
  }
}

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
    address?: string;
    coordType?: 'gcj02' | 'wgs84';
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

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Destructure options to create stable dependencies for hooks.
  const { enableHighAccuracy, timeout, maximumAge } = options;

  const getLocation = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Logic Branching
    // Case A: Check if we are in the Android App environment
    if (window.AndroidApp) {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Mount callbacks
      window.onNativeLocationSuccess = (lat: number, lng: number, address: string) => {
        if (!isMounted.current) return;
        setState({
          loading: false,
          error: null,
          data: {
            latitude: lat,
            longitude: lng,
            address: address,
            coordType: 'gcj02', // Native returns GCJ-02
          },
        });
      };

      window.onNativeLocationError = (errorMessage: string) => {
        if (!isMounted.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: {
            code: 0,
            message: errorMessage,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError,
        }));
      };

      // Trigger native location
      try {
        window.AndroidApp.startLocation();
      } catch (e) {
        console.error("Failed to call AndroidApp.startLocation", e);
        if (isMounted.current) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: {
              code: 0,
              message: "Failed to invoke native location",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError,
          }));
        }
      }

    } else if (navigator.geolocation) {
      // Case B: Ordinary Browser (HTML5 Fallback)
      setState((prev) => ({ ...prev, loading: true, error: null }));
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isMounted.current) return;
          setState({
            loading: false,
            error: null,
            data: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              coordType: 'wgs84', // Standard browser returns WGS-84
            },
          });
        },
        (error) => {
          if (!isMounted.current) return;
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
      if (!isMounted.current) return;
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

    // Check for Android App environment first
    if (typeof window !== 'undefined' && window.AndroidApp) {
      // If we are in the Android App, we prefer the native bridge.
      // Even if 'watch' is true, we rely on the bridge. 
      // If the bridge 'startLocation' is continuous, it will work via the callback.
      // If it's one-off, we at least get the initial location.
      // We avoid using navigator.watchPosition because it might return inaccurate WGS84 coordinates.
      if (watch) {
        getLocation();
      }
      return;
    }

    if (watch && typeof window !== 'undefined' && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
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
        },
        (error) => {
          if (!isMounted.current) return;
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
