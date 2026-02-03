
"use client";

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { useCity } from "@/contexts/CityContext";
import FogLayer from "./FogLayer";
import TerritoryLayer from "./TerritoryLayer";
import { toast } from "sonner";

// Declare AMap globally
declare global {
  interface Window {
    _AMapSecurityConfig: any;
    AMap: any;
  }
}

const MapViewOrchestrator = () => {
  const { region } = useRegion();
  const { map, setMap } = useAMap();
  const { setGpsStatus } = useGameActions();
  const hasDismissedGeolocationPrompt = useGameStore(
    (state) => state.hasDismissedGeolocationPrompt
  );
  const hydrated = useHydration();
  const markerRef = useRef<any>(null);

  // 1. Geolocation with watch enabled
  const { data: geoData, error: geoError } = useGeolocation({ 
    disabled: !hydrated || hasDismissedGeolocationPrompt,
    watch: true,
    options: {
      enableHighAccuracy: true,
      maximumAge: 10000, // Increased to 10s
      timeout: 20000,    // Increased to 20s
    }
  });

  // 2. Reverse geocode when geolocation data is available
  const { address, error: geocodeError } = useReverseGeocode(geoData);

  // 3. Center the map when the region is updated
  useEffect(() => {
    if (map && region?.centerLngLat) {
      map.setCenter(region.centerLngLat, false);
      map.setZoom(14, false, 500);
    }
  }, [map, region]);

  // 4. Manage User Location Marker
  useEffect(() => {
    if (!map || !window.AMap) return;

    // Clean up existing marker if any (just in case)
    if (markerRef.current) {
      map.remove(markerRef.current);
      markerRef.current = null;
    }

    // Create a new marker
    // We use a custom content for a nice pulsing effect
    const markerContent = `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: rgba(74, 222, 128, 0.5); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background-color: #22c55e; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></div>
      </div>
    `;

    markerRef.current = new window.AMap.Marker({
      content: markerContent,
      offset: new window.AMap.Pixel(-12, -12), // Center the 24x24 div
      zIndex: 200, // Ensure it's above the FogLayer (zIndex: 100)
      anchor: 'center',
    });

    if (geoData) {
      markerRef.current.setPosition([geoData.longitude, geoData.latitude]);
    }

    map.add(markerRef.current);

    return () => {
      if (markerRef.current) {
        map.remove(markerRef.current);
        markerRef.current = null;
      }
    };
  }, [map]);

  // Update marker position when geoData changes
  useEffect(() => {
    if (markerRef.current && geoData) {
      const newPos = [geoData.longitude, geoData.latitude];
      markerRef.current.setPosition(newPos);
    }
  }, [geoData]);

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

  return null; // This component does not render anything
};

import { useGeolocation } from "@/hooks/useGeolocation";
import { useReverseGeocode } from "@/hooks/useReverseGeocode";
import { useRegion } from "@/contexts/RegionContext";
import { MapControls } from "./MapControls";
import { useAMap } from "./AMapProvider";
import { useGameActions, useGameStore } from "@/store/useGameStore";
import { useHydration } from "@/hooks/useHydration";

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
  const { setMap } = useAMap();
  const { syncCurrentRoom } = useGameActions();
  const currentRoom = useGameStore(state => state.currentRoom);

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
      plugins: ["AMap.Scale"],
    })
      .then((AMap) => {
        if (destroyed || !mapDomRef.current) return;

        const initialCenter: [number, number] = [116.397428, 39.90923];
        setCenter(initialCenter);

        mapRef.current = new AMap.Map(mapDomRef.current, {
          zoom: 13,
          center: initialCenter,
          viewMode: "2D",
          mapStyle: "amap://styles/dark",
          features: ['bg', 'road', 'point', 'building'], // Restore 'bg' to show outlines/buildings
          // showLabel: false, // Hide all labels
        });

        // Set the map in the context
        setMap(mapRef.current);
        
        // Notify parent that map is loaded
        if (onMapLoad) {
          onMapLoad();
        }

        const updateMapState = () => {
          if (!mapRef.current) return;
          const currentZoom = mapRef.current.getZoom();
          const currentCenter = mapRef.current.getCenter();
          setZoom(currentZoom);
          setCenter([currentCenter.getLng(), currentCenter.getLat()]);
        };

        mapRef.current?.on('zoomchange', updateMapState);
        mapRef.current?.on('mapmove', updateMapState);

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
