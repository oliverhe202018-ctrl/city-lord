import React, { forwardRef, useMemo, useRef, useImperativeHandle, useState, useCallback, useEffect } from 'react';
import { useMap } from './AMapContext';
import { MapLayer } from './layers/MapLayer';
import { ClaimedPolygonLayer } from './layers/ClaimedPolygonLayer';
import { TrajectoryLayer } from './layers/TrajectoryLayer';
import { GhostPathLayer } from './layers/GhostPathLayer';
import { UserMarkerLayer } from './layers/UserMarkerLayer';
import { LoadingSkeleton } from './LoadingSkeleton';
import { DataLoadFailedCard } from '@/components/citylord/feedback/error-feedback';
import TerritoryLayer from './TerritoryLayer';
import FogLayer from './FogLayer';
import { MapControls } from './MapControls';
import { useAuth } from '@/hooks/useAuth';
import { useMapInteraction } from '@/components/map/MapInteractionContext';
import { useGameStore } from '@/store/useGameStore';
import { useMapInteractionStore } from '@/store/useMapInteractionStore';

export type AMapViewHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
};

export interface AMapViewProps {
  showTerritory: boolean;
  showControls?: boolean;
  onMapLoad?: () => void;
  viewMode?: 'user' | 'club';
  sessionClaims?: { lat: number; lng: number; timestamp: number }[][]; // Claimed polygons during run
  runPath?: { lat: number; lng: number; timestamp: number }[];
  path?: { lat: number; lng: number; timestamp: number }[];
  ghostPath?: [number, number][] | null;
  onViewportKingChange?: (king: ViewportKingData | null) => void;
  isRunTakeoverActive?: boolean;
}

export interface ViewportKingData {
  ownerId: string;
  nickname: string;
  avatarUrl: string | null;
  totalArea: number;
  clubId?: string | null;
  clubName?: string | null;
  clubAvatarUrl?: string | null;
  clubTotalArea?: number | null;
}

const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923];

/**
 * AMapView: Layered map architecture for running game
 * 
 * Layers (bottom to top):
 * 1. MapLayer - Pure map rendering
 * 2. TrajectoryLayer - Real-time GPS polyline (SOURCE OF TRUTH)
 * 3. UserMarkerLayer - Blue dot (current position)
 * 4. UIOverlayLayer - Green circle + controls
 * 
 * State flows from MapRoot downward via context.
 */
const AMapView = forwardRef<AMapViewHandle, AMapViewProps>(
  ({ showTerritory, showControls = true, onMapLoad, viewMode, sessionClaims = [], runPath = [], path = [], ghostPath = null, onViewportKingChange, isRunTakeoverActive = false }, ref) => {
    const {
      map, // Added map instance
      currentLocation, // User GPS position
      userPath, // GPS trajectory history (source of truth)
      currentSegment,
      completedSegments,
      mapCenter, // Map viewport center
      isTracking, // Auto-follow mode
      mapLayerRef, // Ref to MapLayer
      handleMapMoveEnd, // Reverse data flow handler
      setMap, // Set map instance in context
      locationStatus, // State machine status
      viewMode: mapViewMode, // 'individual' | 'faction'
      setIsTracking,
      centerMap,
      gpsSignalStrength = 'none', // GPS signal strength with default value
      injectLocationPoints,
    } = useMap();

    const [mapLoadError, setMapLoadError] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    const handleMapReady = useCallback((mapInstance: any) => {
      if (!mapInstance) {
        setMapLoadError(true);
      }
      setMap(mapInstance);
    }, [setMap]);

    // 🟢 新增探头 3：看看底层的视图组件有没有拿到 map
    useEffect(() => {
      console.log('🚨 [探头 3 - AMapView] 当前 map=', map, 'isMapReady=', !!map);
    }, [map]);

    const { 
      setSelectedTerritory, 
      setIsDetailSheetOpen,
      showKingdom, // Kingdom layer visibility
      showFog, // Fog layer visibility
    } = useMapInteraction();
    const setSelectedTerritoryId = useGameStore((state) => state.setSelectedTerritoryId);
    const resetRunState = useGameStore((state) => state.resetRunState);
    const { user } = useAuth();
    const recenterTimerRef = useRef<number | null>(null);
    const isUserInteractingRef = useRef(false);
    const currentLocationRef = useRef(currentLocation);

    const pendingCameraFocus = useMapInteractionStore((s) => s.pendingCameraFocus);
    const setPendingCameraFocus = useMapInteractionStore((s) => s.setPendingCameraFocus);

    // 🎯 社交排行联动底图自动飞越聚焦与 Bounds 自适应框选
    useEffect(() => {
      if (!map || !pendingCameraFocus) return;
      
      const { lng, lat, zoom = 17, territoryId, polygonPoints } = pendingCameraFocus;
      const AMapGlobal = (window as any).AMap;

      try {
        if (polygonPoints && polygonPoints.length >= 3 && AMapGlobal) {
          // 1. 自动计算多边形 BBox 并通过 map.setBounds 执行 80px 留白自适应框选
          let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
          for (const [ptLng, ptLat] of polygonPoints) {
            if (ptLng < minLng) minLng = ptLng;
            if (ptLng > maxLng) maxLng = ptLng;
            if (ptLat < minLat) minLat = ptLat;
            if (ptLat > maxLat) maxLat = ptLat;
          }

          if (minLng !== Infinity && maxLng !== -Infinity && minLat !== Infinity && maxLat !== -Infinity) {
            console.log(`[Linkage-Flight] Smooth FitView/SetBounds to BBox bounds with 80px margins.`);
            const sw = new AMapGlobal.LngLat(minLng, minLat);
            const ne = new AMapGlobal.LngLat(maxLng, maxLat);
            const bounds = new AMapGlobal.Bounds(sw, ne);
            
            // 使用高德底图原生的 setBounds 平滑过渡，设置四周 Padding 为 80
            map.setBounds(bounds, false, [80, 80, 80, 80]);
          } else {
            // Fallback: 仅平滑飞行到中心点
            if (map.setZoomAndCenter) {
              map.setZoomAndCenter(zoom, [lng, lat], false, 800);
            }
          }
        } else {
          // 2. 仅平滑滑行到指定中心点和 zoom
          console.log(`[Linkage-Flight] Smooth pan/zoom to coordinates: ${lng}, ${lat}`);
          if (map.setZoomAndCenter) {
            map.setZoomAndCenter(zoom, [lng, lat], false, 800);
          } else {
            map.setCenter([lng, lat]);
            map.setZoom(zoom);
          }
        }

        // 3. 同时激活 Canvas 高亮和详情抽屉
        if (territoryId) {
          setSelectedTerritoryId(territoryId);
          // 在底图交互 Context 中同步打开详情
          setSelectedTerritory?.({ id: territoryId } as any);
          setIsDetailSheetOpen?.(true);
        }
      } catch (e) {
        console.error('[Linkage-Flight] Map flight transition failed:', e);
      } finally {
        // 完成后重置飞行状态，防循环重入
        setPendingCameraFocus(null);
      }
    }, [map, pendingCameraFocus, setSelectedTerritoryId, setSelectedTerritory, setIsDetailSheetOpen, setPendingCameraFocus]);
    const initialCenter = useMemo<[number, number]>(() => mapCenter || DEFAULT_CENTER, [mapCenter]);

    // Action 2: Zoom tracking with throttle (批示 2)
    const [currentZoom, setCurrentZoom] = useState<number>(13);
    const zoomThrottleRef = useRef<number | null>(null);

    useEffect(() => {
      if (!map) return;

      const handleZoomChange = () => {
        if (zoomThrottleRef.current !== null) return;
        zoomThrottleRef.current = window.setTimeout(() => {
          const z = map.getZoom();
          setCurrentZoom(typeof z === 'number' ? z : 13);
          zoomThrottleRef.current = null;
        }, 200);
      };

      map.on('zoomchange', handleZoomChange);
      const initialZoom = map.getZoom();
      if (typeof initialZoom === 'number') setCurrentZoom(initialZoom);

      return () => {
        if (zoomThrottleRef.current !== null) {
          window.clearTimeout(zoomThrottleRef.current);
          zoomThrottleRef.current = null;
        }
        if (map.off) map.off('zoomchange', handleZoomChange);
      };
    }, [map]);

    // Expose AMapView methods to parent via ref
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (map) {
          const currentZoom = map.getZoom();
          map.setZoom(currentZoom + 1);
        }
      },
      zoomOut: () => {
        if (map) {
          const currentZoom = map.getZoom();
          map.setZoom(currentZoom - 1);
        }
      }
    }), [map]);

    useEffect(() => {
      currentLocationRef.current = currentLocation;
    }, [currentLocation]);

    // Map Click Root Handler: uniform empty space click to clear selection
    useEffect(() => {
      if (!map) return;

      const handleRootClick = () => {
        // Deferred to allow overlay elements to write their timestamp first
        setTimeout(() => {
          const lastClick = (window as any).__amap_polygon_clicked || 0;
          if (Date.now() - lastClick > 300) {
            console.log(`[Interaction] map.click (ROOT): clear selection and close sheet`);
            setSelectedTerritoryId(null);
            setSelectedTerritory?.(null);
            setIsDetailSheetOpen?.(false);
          }
        }, 100);
      };

      map.on('click', handleRootClick);
      return () => {
        if (map.off) map.off('click', handleRootClick);
      };
    }, [map, setSelectedTerritory, setIsDetailSheetOpen, setSelectedTerritoryId]);

    // [底部导航联动] BottomNav 在 MapInteractionProvider 树外，无法直接调用 useMapInteraction()
    // 通过 CustomEvent 解耦：BottomNav 派发 citylord:close-detail-sheet，AMapView 在 provider 内响应
    useEffect(() => {
      const handleCloseDetailSheet = () => {
        setSelectedTerritory?.(null);
        setIsDetailSheetOpen?.(false);
        setSelectedTerritoryId(null);
      };
      window.addEventListener('citylord:close-detail-sheet', handleCloseDetailSheet);
      return () => {
        window.removeEventListener('citylord:close-detail-sheet', handleCloseDetailSheet);
      };
    }, [setSelectedTerritory, setIsDetailSheetOpen, setSelectedTerritoryId]);

    useEffect(() => {
      if (!isRunTakeoverActive) {
        resetRunState();
      }
    }, [isRunTakeoverActive, resetRunState]);

    useEffect(() => {
      if (!map || !isRunTakeoverActive) return;
      map.setZoom(18);
    }, [map, isRunTakeoverActive]);

    useEffect(() => {
      if (!map || !isRunTakeoverActive) return;

      const clearRecenterTimer = () => {
        if (recenterTimerRef.current !== null) {
          window.clearTimeout(recenterTimerRef.current);
          recenterTimerRef.current = null;
        }
      };

      const handleInteractionStart = () => {
        isUserInteractingRef.current = true;
        setIsTracking?.(false);
        clearRecenterTimer();
      };

      const handleInteractionEnd = () => {
        clearRecenterTimer();
        recenterTimerRef.current = window.setTimeout(() => {
          if (!isUserInteractingRef.current) return;
          const loc = currentLocationRef.current;
          if (!loc) return;
          isUserInteractingRef.current = false;
          setIsTracking?.(true);
          if (map.setZoomAndCenter) {
            map.setZoomAndCenter(18, [loc.lng, loc.lat], false, 600);
            return;
          }
          map.setCenter([loc.lng, loc.lat]);
          map.setZoom(18);
        }, 3000);
      };

      map.on('dragstart', handleInteractionStart);
      map.on('touchstart', handleInteractionStart);
      map.on('zoomstart', handleInteractionStart);
      map.on('dragend', handleInteractionEnd);
      map.on('touchend', handleInteractionEnd);
      map.on('zoomend', handleInteractionEnd);

      return () => {
        clearRecenterTimer();
        map.off('dragstart', handleInteractionStart);
        map.off('touchstart', handleInteractionStart);
        map.off('zoomstart', handleInteractionStart);
        map.off('dragend', handleInteractionEnd);
        map.off('touchend', handleInteractionEnd);
        map.off('zoomend', handleInteractionEnd);
      };
    }, [map, isRunTakeoverActive, setIsTracking]);

    const activeTrajectoryPath = ((isRunTakeoverActive && runPath.length > 0) ? runPath : (userPath || []));

    useEffect(() => {
      if (!isRunTakeoverActive || !centerMap) return;
      centerMap();
    }, [isRunTakeoverActive, centerMap]);

    useEffect(() => {
      if (isRunTakeoverActive && injectLocationPoints) {
        if (runPath && runPath.length > 0) {
          injectLocationPoints(runPath, true);
        } else if (path && path.length > 0) {
          injectLocationPoints(path, true);
        }
      }
    }, [isRunTakeoverActive, runPath, path, injectLocationPoints]);

    useEffect(() => {
      if (!isRunTakeoverActive) return;

      const handleImmersiveRecenter = () => {
        if (centerMap) {
          centerMap();
          return;
        }
        if (!map) return;
        const loc = currentLocationRef.current;
        if (!loc) return;
        if (recenterTimerRef.current !== null) {
          window.clearTimeout(recenterTimerRef.current);
          recenterTimerRef.current = null;
        }
        isUserInteractingRef.current = false;
        setIsTracking?.(true);
        if (map.setZoomAndCenter) {
          map.setZoomAndCenter(18, [loc.lng, loc.lat], false, 600);
          return;
        }
        map.setCenter([loc.lng, loc.lat]);
        map.setZoom(18);
      };

      window.addEventListener('immersive-recenter-request', handleImmersiveRecenter);
      return () => {
        window.removeEventListener('immersive-recenter-request', handleImmersiveRecenter);
      };
    }, [map, isRunTakeoverActive, setIsTracking, centerMap]);

    const markerPosition = (isRunTakeoverActive && activeTrajectoryPath.length > 0)
      ? activeTrajectoryPath[activeTrajectoryPath.length - 1]
      : currentLocation;
    const shouldShowTerritoryLayers = showTerritory;
    const resolvedViewMode = mapViewMode;

    const isMapReady = !!map;

    return (
      <div className="relative w-full h-full">
        {/* Layer 1: Pure Map - 始终渲染，确保容器有正确尺寸 */}
        <MapLayer
          key={retryKey}
          ref={mapLayerRef}
          initialCenter={initialCenter}
          initialZoom={isRunTakeoverActive ? 18 : 13}
          onMoveEnd={handleMapMoveEnd}
          onMapLoad={onMapLoad}
          onMapReady={handleMapReady}
        />

        {mapLoadError && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-6">
            <DataLoadFailedCard
              title="地图加载失败"
              message="网络异常，地图引擎加载失败。请检查网络连接后重试。"
              onRetry={() => {
                setMapLoadError(false);
                setMap(null);
                setRetryKey(k => k + 1);
              }}
            />
          </div>
        )}

        {!isMapReady && !mapLoadError && (
          <div className="absolute inset-0 z-50 bg-white">
            <LoadingSkeleton />
          </div>
        )}

        {/* All other layers - only render when map is ready */}
        {isMapReady && (
          <>
            {/* Layer 0b: All Territories (all kingdom modes) */}
            {shouldShowTerritoryLayers && showKingdom && (
              <TerritoryLayer
                map={map}
                isVisible={true}
                viewMode={resolvedViewMode}
                onViewportKingChange={onViewportKingChange}
                currentZoom={currentZoom}
              />
            )}

            {/* Layer 2a: Claimed Polygons (BEFORE TrajectoryLayer - z-index 40) */}
            {sessionClaims && sessionClaims.length > 0 && (
              <ClaimedPolygonLayer
                map={map}
                polygons={sessionClaims}
                fillOpacity={0.3}
                strokeWeight={1}
                currentZoom={currentZoom}
              />
            )}

            {/* Layer 2b: GPS Trajectory (Real-time Polyline - z-index 50) */}
            {isRunTakeoverActive && (
              runPath && runPath.length > 0 ? (
                <TrajectoryLayer
                  map={map as any}
                  path={runPath}
                  strokeColor="#3B82F6"
                  strokeWeight={6}
                />
              ) : (
                <>
                  {completedSegments && completedSegments.map((segment, idx) => (
                    <TrajectoryLayer
                      key={`completed-seg-${idx}`}
                      map={map as any}
                      path={segment}
                      strokeColor="#3B82F6"
                      strokeWeight={5}
                    />
                  ))}
                  {currentSegment && currentSegment.length > 0 && (
                    <TrajectoryLayer
                      map={map as any}
                      path={currentSegment}
                      strokeColor="#3B82F6"
                      strokeWeight={6}
                    />
                  )}
                </>
              )
            )}

            {ghostPath && ghostPath.length > 1 && (
              <GhostPathLayer
                map={map as any}
                ghostPath={ghostPath}
                strokeColor="#22C55E"
                strokeWeight={7}
              />
            )}

            {/* Layer 4: User Marker (Blue GPS Dot - z-index 60) */}
            <UserMarkerLayer
              map={map}
              position={markerPosition}
              isTracking={isTracking}
              instantSync={isRunTakeoverActive}
              accuracy={currentLocation?.accuracy}
              signalStrength={gpsSignalStrength}
            />

            {/* Map Controls (includes fog toggle, mode switch, zoom, locate) */}
            {showControls && <MapControls />}

            {/* Fog Layer — only when fog toggle is ON */}
            {showFog && (
              <FogLayer map={map} />
            )}
          </>
        )}
      </div>
    );
  }
);

AMapView.displayName = 'AMapView';

export default AMapView;
