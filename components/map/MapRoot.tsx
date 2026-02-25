"use client";

import React, { useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { MapProvider, LocationState, AMapInstance } from './AMapContext';
import { useTheme } from '@/components/citylord/theme/theme-provider';
import type { GeoPoint } from '@/hooks/useSafeGeolocation';
import { useLocationStore } from '@/store/useLocationStore';
import { useLocationContext } from '@/components/GlobalLocationProvider';
import { useGameStore } from '@/store/useGameStore';

const MAP_STYLES: Record<string, string> = {
  cyberpunk: 'amap://styles/22e069175d1afe32e9542abefde02cb5',
  light: 'amap://styles/normal',
  nature: 'amap://styles/fresh',
};

/**
 * MapRoot: Central state management for running game
 * 
 * State Model:
 * - userPosition: Current GPS location
 * - userPath: GPS trajectory history (SOURCE OF TRUTH for territory)
 * - mapCenter: Map viewport center
 * - isTracking: Auto-follow mode
 * 
 * Responsibilities:
 * - Manage all map-related state
 * - Integrate with useSafeGeolocation
 * - Provide state to children via context
 * - NO map rendering (delegated to MapLayer)
 */
export function MapRoot({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<AMapInstance | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<'individual' | 'faction'>('individual');
  const { themeId } = useTheme();

  // Running Game State Model
  const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923];

  const [userPosition, setUserPosition] = useState<GeoPoint | null>(null);
  const [userPath, setUserPath] = useState<GeoPoint[]>([]); // GPS trajectory (source of truth)

  // Synchronous cache read for instant map center (avoids Beijing flash)
  // Wrapped in typeof window check to prevent Next.js hydration mismatch
  const [mapCenter, setMapCenter] = useState<[number, number]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('last_known_location');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.lat && parsed?.lng &&
            typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            return [parsed.lng, parsed.lat] as [number, number];
          }
        }
      } catch {
        // Silently fall back to default on parse error
      }
    }
    return DEFAULT_CENTER;
  });

  const [isTracking, setIsTracking] = useState<boolean>(true); // Auto-follow initially
  const isTrackingRef = useRef(isTracking);
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  const [showKingdom, setShowKingdom] = useState<boolean>(true); // Kingdom layer visible by default
  const [kingdomMode, setKingdomMode] = useState<'personal' | 'club'>('personal');
  const [showFog, setShowFog] = useState<boolean>(false); // Fog layer off by default

  const toggleKingdom = useCallback(() => {
    setShowKingdom(prev => !prev);
  }, []);

  const toggleFog = useCallback(() => {
    setShowFog(prev => !prev);
  }, []);

  const mapLayerRef = useRef<any>(null);
  const positionStage = useRef<'cache' | 'network-coarse' | 'gps-precise' | null>(null);
  const initRendered = useRef<boolean>(false); // C.3: Stage initialization deduplication (prevent double fly)
  const lastFlyTime = useRef<number>(0);
  const flyReason = useRef<string>('none');

  // C.1: Pending cannot just be the fix. Store the entire parameter set.
  const pendingFlyRef = useRef<{
    fix: GeoPoint,
    duration: number,
    zoom: number, // not strictly used yet but reserved for semantic completeness
    reason: string,
    ts: number
  } | null>(null);

  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const userInteracted = useRef(false); // Track manual map drag to prevent auto-jump

  // B.1: Cleanup throttle timer on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  // Read GPS state from global singleton store (written by GlobalLocationProvider)
  const location = useLocationStore(s => s.location);
  const loading = useLocationStore(s => s.loading);
  const error = useLocationStore(s => s.error);
  const gpsSignalStrength = useLocationStore(s => s.gpsSignalStrength);
  const status = useLocationStore(s => s.status);

  // Non-serializable callbacks from Context
  const { retry, getDebugData } = useLocationContext();

  // Debug states (C.7)
  const userPositionRef = useRef<GeoPoint | null>(null);
  useEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  const [debugInfo, setDebugInfo] = useState<any>(null);
  const getDebugDataRef = useRef<(() => any) | null>(null);
  const statusRef = useRef(status);
  const gpsSignalStrengthRef = useRef(gpsSignalStrength);
  useEffect(() => { getDebugDataRef.current = getDebugData; }, [getDebugData]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { gpsSignalStrengthRef.current = gpsSignalStrength; }, [gpsSignalStrength]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.search.includes('debug=1'))) {
      interval = setInterval(() => {
        const hookDebug = getDebugDataRef.current?.() || {};
        setDebugInfo({
          source: userPositionRef.current?.source || 'none',
          accuracy: userPositionRef.current?.accuracy || 'N/A',
          isTracking: isTrackingRef.current,
          userInteracted: userInteracted.current,
          hasTimer: throttleTimerRef.current !== null,
          pendingReason: pendingFlyRef.current?.reason || 'none',
          lastFlyReason: flyReason.current,
          watchIdExists: hookDebug.watchIdExists,
          restartInFlight: hookDebug.restartInFlight,
          gpsSignalStrength: gpsSignalStrengthRef.current,
          status: statusRef.current
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // --- GPS Status → Game Store Sync ---
  const setGpsStatus = useGameStore(state => state.setGpsStatus);
  const updateStoreLocation = useGameStore(state => state.updateLocation);
  const resetRunState = useGameStore(state => state.resetRunState);
  const isRunning = useGameStore(state => state.isRunning);

  // Bug5: On mount, if not actively running, clear persisted run path to prevent ghost lines
  useEffect(() => {
    if (!isRunning) {
      resetRunState();
    }
    // Also reset stage for fresh login
    positionStage.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync useSafeGeolocation status → game store gpsStatus
  useEffect(() => {
    const statusMap: Record<string, 'locating' | 'success' | 'error' | 'weak'> = {
      locked: 'success',
      locating: 'locating',
      error: 'error',
      initializing: 'locating',
    };
    const mappedStatus = statusMap[status] || 'locating';
    setGpsStatus(mappedStatus);

    // Bug5: Dismiss lingering GPS weak-signal toasts when GPS locks
    if (status === 'locked') {
      toast.dismiss();
    }
  }, [status, setGpsStatus]);

  // Sync GPS coordinates → game store so MapHeader's reverse geocoding triggers
  useEffect(() => {
    if (location?.lat && location?.lng && location.lat !== 0 && location.lng !== 0) {
      updateStoreLocation(location.lat, location.lng);
    }
  }, [location, updateStoreLocation]);

  // Init userPosition from cache (Client-side only)
  // Note: mapCenter is already initialized synchronously in useState above.
  useEffect(() => {
    try {
      const cached = localStorage.getItem('last_known_location');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.lat && parsed?.lng &&
          typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          // Only set if we don't have a real GPS lock yet
          setUserPosition(prev => prev ? prev : { ...parsed, source: 'cache' as const });
        }
      }
    } catch {
      // Silently ignore cache errors
    }
  }, []);

  // Setup Map Interaction Listeners for dragstart/touchstart to disable tracking
  useEffect(() => {
    if (!map) return;
    const handleInteraction = () => {
      if (isTracking) {
        setIsTracking(false);
      }
      userInteracted.current = true;
      // B.2: Clear pending flyTo timer immediately when user interacts
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      pendingFlyRef.current = null;
    };

    // Bind to map events
    map.on('dragstart', handleInteraction);
    map.on('touchstart', handleInteraction);

    return () => {
      map.off('dragstart', handleInteraction);
      map.off('touchstart', handleInteraction);
    };
  }, [map, isTracking, setIsTracking]);

  // Sync Map Style
  useEffect(() => {
    if (map && map.setMapStyle) {
      map.setMapStyle(MAP_STYLES[themeId] || 'amap://styles/normal');
    }
  }, [map, themeId]);

  // Update user position (always) and trajectory (only when running)
  useEffect(() => {
    if (location && location.lat !== 0 && location.lng !== 0) {
      setUserPosition(location);

      // CRITICAL: Only accumulate trajectory when actively running
      // This prevents ghost polylines on cold start / initial GPS lock
      if (isRunning) {
        setUserPath(prev => {
          // Prevent duplicate points (within 1m)
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const dist = Math.sqrt(
              Math.pow((location.lat - last.lat) * 111000, 2) +
              Math.pow((location.lng - last.lng) * 111000 * Math.cos(location.lat * Math.PI / 180), 2)
            );
            if (dist < 1) return prev; // Skip if too close
          }
          return [...prev, location];
        });
      }
    }
  }, [location, isRunning]);

  // Clear trajectory when run stops
  useEffect(() => {
    if (!isRunning) {
      setUserPath([]);
    }
  }, [isRunning]);

  // Stage-based Locating and FlyTo Animation Control
  useEffect(() => {
    if (!userPosition) return;
    const mapInstance = mapLayerRef.current?.map || map;
    if (!mapInstance) return;

    const source = userPosition.source || 'cache';
    const accuracy = userPosition.accuracy || 9999;
    const now = Date.now();

    // Helper to get precise distance
    const getDistance = () => {
      try {
        const currentCenter = mapInstance.getCenter();
        if (!currentCenter) return Infinity;
        const AMap = (window as { AMap?: { GeometryUtil?: { distance: (a: [number, number], b: [number, number]) => number } } }).AMap;
        if (AMap?.GeometryUtil?.distance) {
          return AMap.GeometryUtil.distance(
            [userPosition.lng, userPosition.lat],
            [currentCenter.lng, currentCenter.lat]
          );
        } else {
          // Fallback approximation
          return Math.sqrt(
            Math.pow((userPosition.lat - currentCenter.lat) * 111000, 2) +
            Math.pow((userPosition.lng - currentCenter.lng) * 111000 * Math.cos(userPosition.lat * Math.PI / 180), 2)
          );
        }
      } catch {
        return Infinity;
      }
    };

    const executeFly = (lng: number, lat: number, duration: number, reason: string) => {
      try {
        if (mapLayerRef.current?.flyTo) {
          mapLayerRef.current.flyTo([lng, lat], 17, duration);
        } else if (mapInstance.setZoomAndCenter) {
          mapInstance.setZoomAndCenter(17, [lng, lat], false, duration);
        } else {
          mapInstance.setCenter([lng, lat]);
        }
        lastFlyTime.current = Date.now();
        flyReason.current = reason;
      } catch { /* silently handle map errors */ }
    };

    const doFlyTo = (duration: number, force: boolean = false, reason: string = 'auto') => {
      // Ignore if user is manually browsing and we're not forcing
      if (!force && (!isTracking || userInteracted.current)) {
        // B.2: isTracking=false: only update marker/trajectory, don't trigger or queue FlyTo.
        return;
      }

      const timeSinceLastFly = now - lastFlyTime.current;
      if (timeSinceLastFly < 1000) {
        // C.1: Trailing throttle updates the ENTIRE payload (uses latest condition)
        pendingFlyRef.current = {
          fix: userPosition,
          duration,
          zoom: 17,
          reason,
          ts: Date.now()
        };
        if (!throttleTimerRef.current) {
          throttleTimerRef.current = setTimeout(() => {
            throttleTimerRef.current = null;
            if (pendingFlyRef.current) {
              // Ensure we only fly if tracking or forced later
              if (isTrackingRef.current || force) {
                const p = pendingFlyRef.current;
                executeFly(p.fix.lng, p.fix.lat, p.duration, p.reason);
              }
              pendingFlyRef.current = null;
            }
          }, 1000 - timeSinceLastFly);
        }
        return;
      }

      executeFly(userPosition.lng, userPosition.lat, duration, reason);
    };

    // Stage Upgrade & Action Logic
    if (source === 'cache') {
      if (positionStage.current === null) {
        positionStage.current = 'cache';
        // C.3: Guarantee initialization executes only once
        if (!initRendered.current) {
          initRendered.current = true;
          try { mapInstance.setCenter([userPosition.lng, userPosition.lat]); flyReason.current = 'cache-init'; } catch { }
        }
      }
    }
    else if (source === 'network-coarse') {
      if (positionStage.current !== 'gps-precise') {
        positionStage.current = 'network-coarse';
        const dist = getDistance();
        // C.2: Explicit gate and comment for network-coarse isTracking=false
        // Do not fly unless tracking is on AND the user is far away enough.
        if (dist > 30) {
          if (isTracking) {
            doFlyTo(500, false, 'network-correction');
          } else {
            console.debug('[MapRoot] Skipped network-coarse flyTo because isTracking is false');
            // Marker updates implicitly because userPosition state was set
          }
        }
      }
    }
    else if (source === 'gps-precise') {
      positionStage.current = 'gps-precise';
      const dist = getDistance();

      // Dual Threshold FlyTo Rule + Accuracy Fallback
      if (Number.isNaN(accuracy) || accuracy === undefined || accuracy === null || accuracy === 9999) {
        // Fallback rule for unknown accuracy: only jump if VERY far
        if (dist > 200) {
          if (isTracking) {
            doFlyTo(1000, false, 'gps-fallback-correction');
          }
        }
      } else if (dist > 150 && accuracy <= 200) {
        // Force correction (high priority)
        if (isTracking) {
          doFlyTo(1000, false, 'gps-high-priority-correction');
        }
      } else if (dist > 50 && accuracy <= 80) {
        // Normal correction (only if tracking)
        if (isTracking) {
          doFlyTo(1000, false, 'gps-normal-correction');
        }
      }
    }
  }, [userPosition, map, isTracking, setIsTracking]);

  // GPS Timeout: If no fix within 15s, show friendly notice
  useEffect(() => {
    const timer = setTimeout(() => {
      if (positionStage.current !== 'gps-precise' && typeof window !== 'undefined') {
        const cachedDistrict = localStorage.getItem('last_known_district');
        const cachedLocation = localStorage.getItem('last_known_location');
        if (cachedDistrict && cachedLocation) {
          toast.info('GPS信号弱，已为您显示大概位置', { description: cachedDistrict, duration: 3000 });
        }
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, []); // Run once on mount

  // Map move handler (reverse data flow)
  const handleMapMoveEnd = useCallback((center: [number, number]) => {
    setMapCenter(center);
    // User manual drag disables tracking (but only if it's a significant move)
    if (isTracking && userPosition) {
      const dist = Math.sqrt(
        Math.pow((center[1] - userPosition.lat) * 111000, 2) +
        Math.pow((center[0] - userPosition.lng) * 111000 * Math.cos(userPosition.lat * Math.PI / 180), 2)
      );
      // Disable tracking if user dragged more than 20m away
      if (dist > 20) {
        setIsTracking(false);
        userInteracted.current = true; // Prevent auto-jump after manual drag
      }
    }
  }, [isTracking, userPosition]);

  // Center map with flyTo (Locate Me)
  const centerMap = useCallback(() => {
    if (userPosition) {
      // B.4: Cancel any pendingFix/timer BEFORE setIsTracking(true)
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      pendingFlyRef.current = null;

      // Force return to center, enable tracking, bypass all thresholds
      userInteracted.current = false;
      setIsTracking(true);

      try {
        if (mapLayerRef.current?.flyTo) {
          mapLayerRef.current.flyTo([userPosition.lng, userPosition.lat], 17, 1000);
        } else if (mapLayerRef.current?.map?.setZoomAndCenter) {
          mapLayerRef.current.map.setZoomAndCenter(17, [userPosition.lng, userPosition.lat], false, 1000);
        } else if (map && map.setZoomAndCenter) {
          map.setZoomAndCenter(17, [userPosition.lng, userPosition.lat], false, 1000);
        } else if (map) {
          map.setCenter([userPosition.lng, userPosition.lat]);
        }
        lastFlyTime.current = Date.now();
      } catch {
        // Silently handle map operation errors
      }
    } else {
      toast.error("暂未获取到定位");
      retry();
    }
  }, [userPosition, retry, map]);

  // Backward compatibility location state
  const locationState: LocationState = {
    status: loading ? 'loading' : (error ? 'error' : 'success'),
    message: error || undefined,
    coords: userPosition ? [userPosition.lng, userPosition.lat] : undefined
  };

  const initLocation = useCallback(async () => {
    retry();
  }, [retry]);

  // Initial AMap check
  useEffect(() => {
    const checkAMap = () => {
      if (typeof window !== 'undefined' && (window as any).AMap) {
        setIsLoaded(true);
      } else {
        setTimeout(checkAMap, 100);
      }
    };
    checkAMap();
  }, []);

  return (
    <MapProvider value={{
      map,
      setMap,
      isLoaded,
      viewMode,
      setViewMode,
      locationState,
      currentLocation: userPosition,
      initLocation,
      centerMap,
      // Running game state
      userPath,
      mapCenter,
      isTracking,
      setIsTracking,
      mapLayerRef,
      handleMapMoveEnd,
      gpsSignalStrength,
      locationStatus: status,
      showKingdom,
      toggleKingdom,
      kingdomMode,
      setKingdomMode,
      showFog,
      toggleFog,
    }}>
      {children}
      {debugInfo && (
        <div style={{
          position: 'absolute', top: 50, left: 10, zIndex: 9999, background: 'rgba(0,0,0,0.7)',
          color: 'lime', fontSize: '10px', padding: '8px', pointerEvents: 'none', borderRadius: '4px',
          fontFamily: 'monospace', whiteSpace: 'pre', lineHeight: '1.2'
        }}>
          <div>src: {debugInfo.source} | acc: {debugInfo.accuracy}</div>
          <div>track: {String(debugInfo.isTracking)} | drag: {String(debugInfo.userInteracted)}</div>
          <div>timer: {String(debugInfo.hasTimer)}</div>
          <div>pend: {debugInfo.pendingReason} | fly: {debugInfo.lastFlyReason}</div>
          <div>watch: {String(debugInfo.watchIdExists)} | lock: {String(debugInfo.restartInFlight)}</div>
          <div>sig: {debugInfo.gpsSignalStrength} | status: {debugInfo.status}</div>
        </div>
      )}
    </MapProvider>
  );
}
