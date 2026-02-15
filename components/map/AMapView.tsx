"use client";

import React, { forwardRef, useEffect, useRef, useState, useImperativeHandle, useMemo } from 'react';
import { safeLoadAMap, safeDestroyMap, safeAddControl } from '@/lib/map/safe-amap';
import { useMap } from './AMapContext';
import { MapControls } from './MapControls';
import { SelfLocationMarker } from './SelfLocationMarker';
import { CenterOverlay } from './CenterOverlay';
import { useRegion } from '@/contexts/RegionContext';
import { useGameActions, useGameStore } from '@/store/useGameStore';
import { useHydration } from '@/hooks/useHydration';
import { isNativePlatform, safeKeepAwake } from "@/lib/capacitor/safe-plugins";
import { Loader2 } from 'lucide-react';

const MapViewOrchestrator = () => {
  const { region } = useRegion();
  const { map, currentLocation, centerMap } = useMap();
  const { setGpsStatus } = useGameActions();

  // 0. Ensure screen stays on for native apps
  useEffect(() => {
    const run = async () => {
      if (await isNativePlatform()) {
        safeKeepAwake();
      }
    };
    run();
  }, []);

  // 1. Center the map when the region is updated
  useEffect(() => {
    if (map && region?.centerLngLat) {
      if (region.centerLngLat[0] !== 0 && region.centerLngLat[1] !== 0) {
        map.setCenter(region.centerLngLat, false);
        map.setZoom(14, false, 500);
      }
    }
  }, [map, region]);

  // 2. Auto-center map on first valid user location update (if map is ready)
  // We only want to do this once or when specifically requested, 
  // but "View Follow" implies following? 
  // User requirement: "打开首页时，地图应停留在上次位置或默认城市，直到获取到真实坐标才 FlyTo 到当前位置"
  // This implies an automatic FlyTo when first location arrives.
  const hasCenteredRef = useRef(false);
  useEffect(() => {
    if (map && currentLocation && !hasCenteredRef.current) {
        // First valid location -> Center
        centerMap();
        hasCenteredRef.current = true;
    }
  }, [map, currentLocation, centerMap]);

  return <SelfLocationMarker position={currentLocation} />;
};

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
  const { setMap, currentLocation } = useMap();
  const { syncCurrentRoom } = useGameActions();
  const currentRoom = useGameStore(state => state.currentRoom);
  
  // Cache Key
  const MAP_STORAGE_KEY = 'city-lord-map-state';

  // Helper to load/save state
  const getInitialState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(MAP_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  const saveMapState = () => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    const zoom = mapRef.current.getZoom();
    const state = {
      center: [center.lng, center.lat],
      zoom,
      timestamp: Date.now()
    };
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(state));
  };

  const isValidLocation = (loc: any) => {
    return Array.isArray(loc) && loc.length === 2 && loc[0] !== 0 && loc[1] !== 0 && !isNaN(loc[0]) && !isNaN(loc[1]);
  };

  useEffect(() => {
    if (currentRoom?.id) {
      syncCurrentRoom().catch((e: any) => {
         console.warn("Sync room failed", e);
      });
    }
  }, []); 

  const [err, setErr] = useState<string | null>(null);
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
    let destroyed = false;

    (async () => {
      const AMap = await safeLoadAMap({ plugins: ["AMap.Scale", "AMap.MoveAnimation"] });
      
      if (destroyed || !mapDomRef.current || !AMap) {
        if (!AMap && !destroyed) setErr('高德地图加载失败');
        return;
      }

      // Load Cached State
      const savedState = getInitialState();
      
      // Priority 3: Default (Beijing)
      let finalCenter: [number, number] = [116.397428, 39.90923]; 
      let finalZoom = 13;

      // Priority 2: Cache
      if (savedState) {
          if (savedState.center && isValidLocation(savedState.center)) {
              finalCenter = savedState.center;
          }
          if (savedState.zoom) {
              finalZoom = savedState.zoom;
          }
      }
      
      // Note: We do NOT wait for user location here to avoid blocking render.
      // MapViewOrchestrator will flyTo user location when it arrives.

      try {
        mapRef.current = new AMap.Map(mapDomRef.current, {
          zoom: finalZoom,
          center: finalCenter,
          viewMode: "2D", // 2D is lighter and better for this game style
          pitch: 0,
          mapStyle: 'amap://styles/22e069175d1afe32e9542abefde02cb5', // Dark
          showLabel: true, // Show POI labels
        });

        setMap(mapRef.current);

        if (onMapLoad) onMapLoad();

        const updateMapState = () => {
             // Optional: update React state if needed
        };

        mapRef.current.on('zoomchange', updateMapState);
        mapRef.current.on('mapmove', updateMapState);
        mapRef.current.on('moveend', saveMapState);
        mapRef.current.on('zoomend', saveMapState);

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

        await safeAddControl(mapRef.current, 'Scale');

      } catch (e: any) {
        if (!destroyed) {
            console.error(e);
            setErr(e?.message || "地图加载失败");
        }
      }
    })();

    return () => {
      destroyed = true;
      safeDestroyMap(mapRef.current);
      mapRef.current = null;
      setMap(null);
      window.removeEventListener('resize', () => {});
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapDomRef} 
        className="w-full h-full z-0" 
        style={{ touchAction: 'none' }} // Prevent browser zoom gestures
      />
      
      {/* Map Controls Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <MapControls />
        <MapViewOrchestrator />
        {/* Removed CenterOverlay per user request: "Remove green circle and dot in the center" */}
        {/* {showTerritory && <CenterOverlay />} */}
      </div>

      {err && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
          <div className="text-destructive font-medium p-4 bg-background border border-destructive rounded-lg shadow-lg">
            {err}
          </div>
        </div>
      )}
      
      {!mapRef.current && !err && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-40">
           <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
});

AMapView.displayName = 'AMapView';

export default AMapView;
