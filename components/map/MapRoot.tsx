"use client";

import React, { useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { MapProvider, LocationState, AMapInstance } from './AMapContext';
import { useTheme } from '@/components/citylord/theme/theme-provider';
import { useSafeGeolocation, GeoPoint } from '@/hooks/useSafeGeolocation';

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
  const DEFAULT_LOCATION: GeoPoint = {
    lat: 39.90923,
    lng: 116.397428,
    source: 'cache'
  };

  const [userPosition, setUserPosition] = useState<GeoPoint | null>(null);
  const [userPath, setUserPath] = useState<GeoPoint[]>([]); // GPS trajectory (source of truth)
  const [mapCenter, setMapCenter] = useState<[number, number]>([116.397428, 39.90923]);
  const [isTracking, setIsTracking] = useState<boolean>(true); // Auto-follow initially
  const [showKingdom, setShowKingdom] = useState<boolean>(true); // Kingdom layer visible by default
  const [kingdomMode, setKingdomMode] = useState<'personal' | 'club'>('personal');

  const toggleKingdom = useCallback(() => {
    setShowKingdom(prev => !prev);
  }, []);

  const mapLayerRef = useRef<any>(null);
  const hasInitialFlown = useRef(false);

  // Safe geolocation with 50m accuracy filtering
  const { location, loading, error, gpsSignalStrength, status, retry } = useSafeGeolocation({
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 0
  });

  // Init with cache (Client-side only to avoid hydration mismatch)
  useEffect(() => {
    try {
      const cached = localStorage.getItem('last_known_location');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.lat && parsed?.lng) {
          // Only set if we don't have a real GPS lock yet
          setUserPosition(prev => prev ? prev : { ...parsed, source: 'cache' });
          setMapCenter([parsed.lng, parsed.lat]);
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  }, []);

  // Sync Map Style
  useEffect(() => {
    if (map && map.setMapStyle) {
      map.setMapStyle(MAP_STYLES[themeId] || 'amap://styles/normal');
    }
  }, [map, themeId]);

  // Update user position and trajectory
  useEffect(() => {
    if (location && location.lat !== 0 && location.lng !== 0) {
      setUserPosition(location);

      // Add to trajectory (filtered GPS points only)
      // This is the source of truth for territory claims
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
  }, [location]);

  // Force Initial FlyTo (Fix: Ensure map flies to user even if signal isn't 'precise' yet)
  useEffect(() => {
    // 核心逻辑：只要有坐标，且还没飞过，且距离默认点（北京）超过 1km，就飞！
    if (userPosition && !hasInitialFlown.current && mapLayerRef.current?.map) {
      // 计算距离 (简单勾股定理即可，无需高精度)
      const dist = Math.abs(userPosition.lat - 39.909) + Math.abs(userPosition.lng - 116.397);

      // 阈值：只要不是还停留在默认的北京坐标 (dist > 0.01 约等于 1km)
      if (dist > 0.01) {
        mapLayerRef.current.map.setZoomAndCenter(16, [userPosition.lng, userPosition.lat]); // 使用 setZoomAndCenter 瞬间跳转
        hasInitialFlown.current = true; // 标记已飞过
      }
    }
  }, [userPosition, mapLayerRef]);

  // Auto-follow user if tracking enabled (Smart FlyTo)
  useEffect(() => {
    if (isTracking && userPosition && mapLayerRef.current?.flyTo) {
      // Only fly if GPS is locked (source is gps-precise)
      if (userPosition.source === 'gps-precise') {
        const currentCenter = map?.getCenter();
        if (currentCenter) {
          // Calculate distance between current view center and user position
          // Simple Haversine approximation
          const R = 6371e3; // metres
          const φ1 = userPosition.lat * Math.PI / 180;
          const φ2 = currentCenter.lat * Math.PI / 180;
          const Δφ = (currentCenter.lat - userPosition.lat) * Math.PI / 180;
          const Δλ = (currentCenter.lng - userPosition.lng) * Math.PI / 180;

          const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const dist = R * c;

          // Only fly if distance > 200m to avoid jarring jumps during minor GPS drift
          if (dist > 200) {
            mapLayerRef.current.flyTo([userPosition.lng, userPosition.lat], 17, 800);
          }
        }
      }
    }
  }, [isTracking, userPosition, map]);

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
      }
    }
  }, [isTracking, userPosition]);

  // Center map with flyTo (Locate Me)
  const centerMap = useCallback(() => {
    if (userPosition) {
      // Use the helper on the ref check if available, otherwise fallback
      if (mapLayerRef.current?.flyTo) {
        mapLayerRef.current.flyTo([userPosition.lng, userPosition.lat], 17);
      } else if (mapLayerRef.current?.map?.setZoomAndCenter) {
        mapLayerRef.current.map.setZoomAndCenter(17, [userPosition.lng, userPosition.lat]);
      }
      setIsTracking(true);
    } else {
      toast.error("暂未获取到定位");
      retry();
    }
  }, [userPosition, retry]);

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
    }}>
      {children}
    </MapProvider>
  );
}
