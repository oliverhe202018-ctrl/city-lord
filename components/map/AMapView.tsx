
"use client";

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useMemo } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { useCity } from "@/contexts/CityContext";
import FogLayer from "./FogLayer";
import TerritoryLayer from "./TerritoryLayer";
import { toast } from "sonner";
import gcoord from "gcoord";

// Declare AMap globally
declare global {
  interface Window {
    _AMapSecurityConfig: any;
    AMap: any;
  }
}

import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';

import { SelfLocationMarker } from "./SelfLocationMarker";

const MapViewOrchestrator = () => {
  const { region } = useRegion();
  const { map, setMap } = useMap();
  const { setGpsStatus } = useGameActions();
  const hasDismissedGeolocationPrompt = useGameStore(
    (state) => state.hasDismissedGeolocationPrompt
  );
  const hydrated = useHydration();

  // 0. Ensure screen stays on for native apps (Double Insurance)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      KeepAwake.keepAwake();
    }
    // Note: We deliberately DO NOT call allowSleep() on unmount to keep GPS alive 
    // if the user switches tabs but stays in the app context.
    // BackgroundTask will handle the process lifecycle.
  }, []);

  // 1. Geolocation with watch enabled
  const { data: geoData, error: geoError } = useGeolocation({ 
    disabled: !hydrated || hasDismissedGeolocationPrompt,
    watch: true,
    options: {
      enableHighAccuracy: true,
      maximumAge: 0,      // Force fresh data
      timeout: 30000,     // 30s timeout for GPS fix
    }
  });

  // 2. Reverse geocode when geolocation data is available
  const validGeoData = useMemo(() => {
    if (!geoData) return null
    if (geoData.latitude === 0 && geoData.longitude === 0) return null
    return geoData
  }, [geoData])

  const { address, error: geocodeError } = useReverseGeocode(validGeoData);

  // 3. Center the map when the region is updated
  useEffect(() => {
    if (map && region?.centerLngLat) {
      map.setCenter(region.centerLngLat, false);
      map.setZoom(14, false, 500);
    }
  }, [map, region]);

  // Handle and log errors
  useEffect(() => {
    if (geoError) {
      // Filter out common "Network service" errors in dev/China without VPN
      const isNetworkServiceError = geoError.message?.includes("network service") || geoError.message?.includes("Network location provider");
      
      if (isNetworkServiceError) {
        console.warn("Geolocation network service failed (likely due to network/proxy). Falling back to default location.");
        setGpsStatus('weak', "网络定位服务不可用，使用默认位置");
        // Don't toast for this common dev environment issue, just fallback
        return;
      }

      console.error("Geolocation Error:", geoError.message);
      setGpsStatus('error', geoError.message);
      
      // Show user-friendly toast
      if (geoError.message.includes("User denied") || geoError.message.includes("permission")) {
        toast.error("定位失败：权限被拒绝", {
          description: "请在浏览器设置中允许获取位置信息，以便开始探索。",
          duration: 5000,
        });
      } else {
        toast.error("定位失败", {
          description: geoError.message || "无法获取当前位置",
        });
      }
    }
    if (geocodeError) {
      console.error("Reverse Geocode Error:", geocodeError);
    }
  }, [geoError, geocodeError, setGpsStatus]);

  return <SelfLocationMarker position={geoData} />;
};

import { useGeolocation } from "@/hooks/useGeolocation";
import { useReverseGeocode } from "@/hooks/useReverseGeocode";
import { useRegion } from "@/contexts/RegionContext";
import { MapControls } from "./MapControls";
import { useMap } from "./AMapContext";
import { useGameActions, useGameStore } from "@/store/useGameStore";
import { useHydration } from "@/hooks/useHydration";
import { SmartRoutingMode } from "@/components/citylord/map/SmartRoutingMode";

export type AMapViewHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
};

export interface AMapViewProps {
  showTerritory: boolean;
  onMapLoad?: () => void;
}

const AMapView = forwardRef<AMapViewHandle, AMapViewProps>(({ showTerritory, onMapLoad }, ref) => {
  const mapDomRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const { setMap } = useMap();
  const { syncCurrentRoom } = useGameActions();
  const currentRoom = useGameStore(state => state.currentRoom);
  
  // Cache Key
  const MAP_STORAGE_KEY = 'city-lord-map-state';

  // Helper to read cache
  const getInitialState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(MAP_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load map state', e);
    }
    return null;
  };

  useEffect(() => {
    // 页面加载/组件挂载时，如果本地缓存显示我在房间里，立即同步一次最新状态
    if (currentRoom?.id) {
      syncCurrentRoom().catch((e: any) => {
        if (e?.name !== 'AbortError' && e?.digest !== 'NEXT_REDIRECT') {
          console.error("Failed to sync room", e)
        }
      });
    }
  }, []); // 空依赖数组，只在挂载时执行一次

  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(13);
  const [center, setCenter] = useState<[number, number] | undefined>();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      mapRef.current?.zoomIn();
    },
    zoomOut: () => {
      mapRef.current?.zoomOut();
    },
  }));

  useEffect(() => {
    // Force security config again before load
    if (typeof window !== "undefined") {
        (window as any)._AMapSecurityConfig = { 
            securityJsCode: 'e827ba611fad4802c48dd900d01eb4bf',
        };
    }

    const key = process.env.NEXT_PUBLIC_AMAP_KEY;

    if (!key) {
      setErr("缺少 NEXT_PUBLIC_AMAP_KEY：请检查 .env.local 并重启 pnpm dev");
      return;
    }

    const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;
    if (securityCode && typeof window !== "undefined") {
      // @ts-ignore
      window._AMapSecurityConfig = { securityJsCode: securityCode };
    }

    let destroyed = false;

    AMapLoader.load({
      key,
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.Geolocation"],
    })
      .then((AMap) => {
        if (destroyed || !mapDomRef.current) return;

        // Load Cached State
        const savedState = getInitialState();
        let initialCenter: [number, number] = [116.397428, 39.90923]; // Default: Beijing
        let initialZoom = 13;

        if (savedState) {
            if (savedState.center && Array.isArray(savedState.center)) {
                initialCenter = savedState.center;
            }
            if (savedState.zoom) {
                initialZoom = savedState.zoom;
            }
            console.log('Using cached map state:', savedState);
        }

        setCenter(initialCenter);
        setZoom(initialZoom);

        mapRef.current = new AMap.Map(mapDomRef.current, {
          zoom: initialZoom,
          center: initialCenter,
          viewMode: "2D",
          mapStyle: "amap://styles/22e069175d1afe32e9542abefde02cb5",
          // showLabel: false, // Hide all labels
        });

        // Set the map in the context
        setMap(mapRef.current);
        
        // Notify parent that map is loaded
        if (onMapLoad) {
          onMapLoad();
        }

        // Save State Logic
        const saveMapState = () => {
          if (!mapRef.current) return;
          const center = mapRef.current.getCenter();
          const zoom = mapRef.current.getZoom();
          const state = {
            center: [center.getLng(), center.getLat()],
            zoom: zoom
          };
          localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(state));
        };

        const updateMapState = () => {
          if (!mapRef.current) return;
          const currentZoom = mapRef.current.getZoom();
          const currentCenter = mapRef.current.getCenter();
          setZoom(currentZoom);
          setCenter([currentCenter.getLng(), currentCenter.getLat()]);
        };

        mapRef.current?.on('zoomchange', updateMapState);
        mapRef.current?.on('mapmove', updateMapState);
        
        // Add listeners for saving state
        mapRef.current?.on('moveend', saveMapState);
        mapRef.current?.on('zoomend', saveMapState);

        const handleResize = () => {
          if (mapDomRef.current) {
            setViewport({
              width: mapDomRef.current.offsetWidth,
              height: mapDomRef.current.offsetHeight,
            });
          }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        mapRef.current.addControl(new AMap.Scale());

        // 1. Optimize AMap.Geolocation Configuration
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true, // 开启高精度
          timeout: 15000,           // 15秒超时 (User Request)
          maximumAge: 0,            // 强制刷新 (User Request)
          convert: true,            // 自动偏移坐标
          showButton: false,        // 不显示默认按钮 (Use our custom UI)
          showMarker: false,        // Hide default marker to avoid duplication with RunningMap
          showCircle: false,        // Hide default circle
          panToLocation: true,      // 定位成功后将定位到的位置作为地图中心点
          zoomToAccuracy: true,     // 定位成功后调整地图视野范围
          noGeoLocation: 0,         // 0: 强制使用浏览器定位 (User Request for Android WebView fix)
        });

        mapRef.current.addControl(geolocation);

        // 2. Add Error Feedback
        geolocation.getCurrentPosition((status: string, result: any) => {
          if (status === 'complete') {
            console.log('AMap Location Success:', result);
            // Optional: You might want to update global store here if needed
          } else {
            console.warn('AMap Location Warning (Non-fatal):', result);
            // Suppress visible error toast unless strictly necessary
            // toast.error("定位失败...", { ... }); 
            
            // 3. Fallback Handling - REMOVED to preserve Cached State
            // If we have a cached location, we want to stay there on failure, not jump to Beijing.
            // If we started with default (Beijing), we stay there.
            /*
            if (mapRef.current) {
              console.log('Falling back to default location (Beijing)');
              mapRef.current.setCenter([116.397428, 39.90923]);
              mapRef.current.setZoom(13);
            }
            */
          }
        });

      })
      .catch((e) => {
        console.error("AMap load error:", e);
        setErr(String(e?.message || e));
      });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 bg-black">
      <div ref={mapDomRef} className="h-full w-full bg-black" />

      {mapRef.current && (
        <>
          <MapViewOrchestrator />
          <FogLayer map={mapRef.current} />
          <TerritoryLayer 
            map={mapRef.current} 
            isVisible={showTerritory} 
            onTerritoryClick={(territory) => {
              console.log("Clicked territory:", territory);
            }}
          />
          <MapControls />
        </>
      )}

      {err && (
        <div className="absolute left-3 right-3 top-3 z-[9999] rounded-xl border border-red-500/30 bg-black/70 p-3 text-sm text-red-200">
          地图加载失败：{err}
          <div className="mt-1 text-xs text-red-200/70">
            打开浏览器 Console 看 AMap 详细报错（通常是 KEY/域名白名单/SCODE）
          </div>
        </div>
      )}
    </div>
  );
});

AMapView.displayName = "AMapView";

export default AMapView;
