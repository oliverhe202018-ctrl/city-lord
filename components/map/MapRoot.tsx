"use client"

import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import { MapProvider, LocationState } from './AMapContext';
import { useTheme } from '@/components/citylord/theme/theme-provider';
import { useSafeGeolocation } from '@/hooks/useSafeGeolocation';

const MAP_STYLES: Record<string, string> = {
  cyberpunk: 'amap://styles/22e069175d1afe32e9542abefde02cb5', // Custom dark
  light: 'amap://styles/normal', // Standard light
  nature: 'amap://styles/fresh', // Fresh/Nature
};

// Renamed from AMapProvider to MapRoot to break circular dependencies
export function MapRoot({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<any | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<'individual' | 'faction'>('individual');
  const { themeId } = useTheme();
  
  // Use the new safe geolocation hook
  const { location, loading, error, retry } = useSafeGeolocation();

  // Sync Map Style
  useEffect(() => {
    if (map && map.setMapStyle) {
      map.setMapStyle(MAP_STYLES[themeId] || 'amap://styles/normal');
    }
  }, [map, themeId]);

  // Center Map Logic
  const centerMap = useCallback(() => {
    if (!map) return;
    
    if (location) {
      // Smooth transition to user location
      // Using panTo for smooth movement
      map.panTo([location.lng, location.lat]);
      // Ensure zoom level is appropriate for running view
      map.setZoom(16);
    } else {
      retry();
      toast.info("正在定位中...", { description: "请稍候，正在获取精确位置" });
    }
  }, [map, location, retry]);

  // Derived location state for backward compatibility
  const locationState: LocationState = {
    status: loading ? 'loading' : (error ? 'error' : 'success'),
    message: error || undefined,
    coords: location ? [location.lng, location.lat] : undefined
  };

  const initLocation = useCallback(async () => {
    retry();
  }, [retry]);

  // Initial Check
  useEffect(() => {
    // Check if AMap is available globally
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
      currentLocation: location,
      initLocation,
      centerMap
    }}>
      {children}
    </MapProvider>
  );
}
