"use client"

import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import { loadCapacitorPlugin, isNativeApp } from '@/lib/capacitor-loader';
import type { Position } from '@capacitor/geolocation';
import { toast } from 'sonner';
import gcoord from 'gcoord';
import { MapProvider, LocationState } from './AMapContext';
import { useTheme } from '@/components/citylord/theme/theme-provider';

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
  const [locationState, setLocationState] = useState<LocationState>({ status: 'loading' });
  const { themeId } = useTheme();

  // Sync Map Style
  useEffect(() => {
    if (map && map.setMapStyle) {
      map.setMapStyle(MAP_STYLES[themeId] || 'amap://styles/normal');
    }
  }, [map, themeId]);

  // 混合定位策略 helper function
  const getPosition = async (retries = 1): Promise<Position> => {
    // 定义通用配置：关闭高精度以提高国内成功率
    const options = { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 };

    try {
      // 1. 尝试原生插件
      if (isNativeApp()) {
        const Geolocation = await loadCapacitorPlugin(
          'Geolocation',
          () => import('@capacitor/geolocation').then(m => m.Geolocation)
        );
        if (Geolocation) {
          return await Geolocation.getCurrentPosition(options);
        }
        throw new Error("Geolocation plugin failed to load");
      } else {
        throw new Error("Not native");
      }
    } catch (err) {
      console.warn(`Native location attempt failed (Left retries: ${retries})`, err);
      
      // 2. 自动重试机制
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1000)); // 歇1秒再试
        return getPosition(retries - 1);
      }

      // 3. 彻底失败后，降级到 Web API
      console.log("Falling back to Web Geolocation API...");
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => {
            // FIX: Ensure loading state is reset immediately
            try {
              const [lng, lat] = gcoord.transform(
                [pos.coords.longitude, pos.coords.latitude],
                gcoord.WGS84,
                gcoord.GCJ02
              );
              setLocationState({ 
                status: 'success', 
                coords: [lng, lat] 
              });
            } catch (e) {
              console.error("Transform error in fallback", e);
            }

            resolve({
              coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                altitude: pos.coords.altitude,
                altitudeAccuracy: pos.coords.altitudeAccuracy,
                heading: pos.coords.heading,
                speed: pos.coords.speed,
              },
              timestamp: pos.timestamp
            });
          },
          err => {
             // FIX: Ensure loading state is reset immediately
             setLocationState({ status: 'error', message: err.message || 'Web API Location failed' });
             reject(err);
          },
          { ...options, timeout: 10000 } // Web API 给更长时间
        );
      });
    }
  };

  // Core Location Logic
  const initLocation = useCallback(async () => {
    setLocationState({ status: 'loading', message: '定位中...' });
    
    try {
      // 1. Check Permissions (Native only)
      if (isNativeApp()) {
        try {
          const Geolocation = await loadCapacitorPlugin(
            'Geolocation',
            () => import('@capacitor/geolocation').then(m => m.Geolocation)
          );

          if (Geolocation) {
            const permStatus = await Geolocation.checkPermissions();
            
            if (permStatus.location !== 'granted' && permStatus.coarseLocation !== 'granted') {
               const request = await Geolocation.requestPermissions();
               if (request.location !== 'granted' && request.coarseLocation !== 'granted') {
                  throw new Error('权限被拒绝');
               }
            }
          }
        } catch (permError) {
          console.warn('Permission check failed, possibly due to GMS issues. Proceeding to try location anyway.', permError);
        }
      }

      // 2. Get Position using Hybrid Strategy (Robust getPosition)
      const position = await getPosition();

      // 3. Transform Coordinates
      // 注意：Web API 在国内通常返回 WGS84 (Android WebView) 或者 GCJ02 (某些国产浏览器内核)。
      // 作为一个混合应用，WebView 通常是系统 WebView (Chrome/Chromium based)，返回 WGS84。
      // 原生 Geolocation 插件返回的也是 WGS84。
      // 所以我们统一视为 WGS84 并转换。
      if (position?.coords) {
          const [lng, lat] = gcoord.transform(
            [position.coords.longitude, position.coords.latitude],
            gcoord.WGS84,
            gcoord.GCJ02
          );

          setLocationState({ 
            status: 'success', 
            coords: [lng, lat] 
          });
      } else {
          throw new Error("Invalid position data");
      }

    } catch (error: any) {
      console.error("Location failed:", error);
      
      let errorMsg = error.message || '定位失败';
      
      if (errorMsg.includes('location unavailable')) {
          errorMsg = "无法获取位置信息，请检查系统定位开关";
      } else if (error.code === 1) { // PERMISSION_DENIED
          errorMsg = "定位权限被拒绝，请在设置中开启";
      } else if (error.code === 2) { // POSITION_UNAVAILABLE
          errorMsg = "位置不可用 (Signal lost)";
      } else if (error.code === 3) { // TIMEOUT
          errorMsg = "定位超时，请重试";
      }

      // Show toast for error ONLY if it's not a trivial undefined error on startup
      const isUndefinedError = errorMsg.includes("undefined") || errorMsg.includes("reading 'longitude'");
      if (!isUndefinedError) {
          toast.error(`定位失败: ${errorMsg}`);
      }
      setLocationState({ status: 'error', message: errorMsg });
    }
  }, []);

  // Map Centering Logic
  const centerMap = useCallback(() => {
    if (!map) return;
    
    if (locationState.status === 'success' && locationState.coords) {
      map.setCenter(locationState.coords, true);
      map.setZoom(16, true, 500);
    } else {
      initLocation(); // Retry if clicked and no location
      toast.info("正在刷新定位...");
    }
  }, [map, locationState, initLocation]);

  // Initial Check
  useEffect(() => {
    initLocation();
    
    // Check if AMap is available globally
    const checkAMap = () => {
      if (typeof window !== 'undefined' && (window as any).AMap) {
        setIsLoaded(true);
      } else {
        setTimeout(checkAMap, 100);
      }
    };
    checkAMap();
  }, [initLocation]);

  return (
    <MapProvider value={{ 
      map, 
      setMap, 
      isLoaded, 
      viewMode, 
      setViewMode,
      locationState,
      initLocation,
      centerMap
    }}>
      {children}
    </MapProvider>
  );
}
