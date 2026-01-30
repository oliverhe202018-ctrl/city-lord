
"use client";

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { useCity } from "@/contexts/CityContext";
import FogLayer from "./FogLayer";
import TerritoryLayer from "./TerritoryLayer";

const MapViewOrchestrator = () => {
  const { region } = useRegion();
  const { map, setMap } = useAMap();
  const { setGpsStatus } = useGameActions();
  const hasDismissedGeolocationPrompt = useGameStore(
    (state) => state.hasDismissedGeolocationPrompt
  );
  const hydrated = useHydration();

  // 1. One-time geolocation on startup
  const { data: geoData, error: geoError } = useGeolocation({ disabled: !hydrated || hasDismissedGeolocationPrompt });

  // 2. Reverse geocode when geolocation data is available
  const { address, error: geocodeError } = useReverseGeocode(geoData);

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
      console.error("Geolocation Error:", geoError.message);
      setGpsStatus('error', geoError.message);
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
}

const AMapView = forwardRef<AMapViewHandle, AMapViewProps>(({ showTerritory }, ref) => {
  const mapDomRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const { setMap } = useAMap();
  const { syncCurrentRoom } = useGameActions();
  const currentRoom = useGameStore(state => state.currentRoom);

  useEffect(() => {
    // 页面加载/组件挂载时，如果本地缓存显示我在房间里，立即同步一次最新状态
    if (currentRoom?.id) {
      syncCurrentRoom();
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
