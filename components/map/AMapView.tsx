import React, { forwardRef, useMemo, useRef } from 'react';
import { useMap } from './AMapContext';
import { MapLayer } from './layers/MapLayer';
import { ClaimedPolygonLayer } from './layers/ClaimedPolygonLayer';
import { TrajectoryLayer } from './layers/TrajectoryLayer';
import { GhostPathLayer } from './layers/GhostPathLayer';
import { UserMarkerLayer } from './layers/UserMarkerLayer';
import { LoadingSkeleton } from './LoadingSkeleton';
import { LocationIndicator } from './LocationIndicator';
import { KingdomLayer } from './layers/KingdomLayer';
import TerritoryLayer from './TerritoryLayer';
import FogLayer from './FogLayer';
import { MapControls } from './MapControls';
import { useAuth } from '@/hooks/useAuth';
import { useMapInteraction } from '@/components/map/MapInteractionContext';
import { useEffect } from 'react';

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
  ghostPath?: [number, number][] | null;
  onViewportKingChange?: (king: ViewportKingData | null) => void;
  isRunTakeoverActive?: boolean;
}

export interface ViewportKingData {
  ownerId: string;
  nickname: string;
  avatarUrl: string | null;
  totalArea: number;
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
  ({ showTerritory, showControls = true, onMapLoad, viewMode, sessionClaims = [], runPath = [], ghostPath = null, onViewportKingChange, isRunTakeoverActive = false }, ref) => {
    const {
      map, // Added map instance
      currentLocation, // User GPS position
      userPath, // GPS trajectory history (source of truth)
      mapCenter, // Map viewport center
      isTracking, // Auto-follow mode
      mapLayerRef, // Ref to MapLayer
      handleMapMoveEnd, // Reverse data flow handler
      setMap, // Set map instance in context
      locationStatus, // State machine status
      showKingdom, // Kingdom layer visibility
      kingdomMode, // 'personal' | 'club'
      showFog, // Fog layer visibility
      showFactionColors,
      viewMode: mapViewMode, // 'individual' | 'faction'
      setIsTracking,
      centerMap,
    } = useMap();

    const { setSelectedTerritory, setIsDetailSheetOpen } = useMapInteraction();
    const { user } = useAuth();
    const recenterTimerRef = useRef<number | null>(null);
    const isUserInteractingRef = useRef(false);
    const currentLocationRef = useRef(currentLocation);
    const initialCenter = useMemo<[number, number]>(() => mapCenter || DEFAULT_CENTER, [mapCenter]);

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
            setSelectedTerritory?.(null);
            setIsDetailSheetOpen?.(false);
          }
        }, 100);
      };

      map.on('click', handleRootClick);
      return () => {
        if (map.off) map.off('click', handleRootClick);
      };
    }, [map, setSelectedTerritory, setIsDetailSheetOpen]);

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

    return (
      <div className="relative w-full h-full">
        {/* New Non-blocking Location Indicator */}
        <LocationIndicator status={locationStatus || 'initializing'} isRunTakeoverActive={isRunTakeoverActive} />

        {/* Layer 1: Pure Map */}
        <div className="w-full h-full">
          <MapLayer
            ref={mapLayerRef}
            initialCenter={initialCenter}
            initialZoom={isRunTakeoverActive ? 18 : 13}
            onMoveEnd={handleMapMoveEnd}
            onMapLoad={onMapLoad}
            onMapReady={setMap}
          />

          {/* Layer 0: Kingdom (Historical Territories) - Lowest z-index */}
          {showKingdom && kingdomMode === 'personal' && (
            <KingdomLayer map={mapLayerRef?.current?.map} userId={user?.id || null} />
          )}
          {/* Layer 0b: All Territories (all kingdom modes) */}
          {showKingdom && (
            <TerritoryLayer
              map={mapLayerRef?.current?.map}
              isVisible={true}
              kingdomMode={kingdomMode}
              showFactionColors={showFactionColors}
              onViewportKingChange={onViewportKingChange}
            />
          )}

          {/* Layer 2a: Claimed Polygons (BEFORE TrajectoryLayer - z-index 40) */}
          {sessionClaims && sessionClaims.length > 0 && (
            <ClaimedPolygonLayer
              map={mapLayerRef?.current?.map}
              polygons={sessionClaims}
              fillColor="#F59E0B" // Gold/Amber
              fillOpacity={0.3}
              strokeColor="#D97706" // Darker amber border
              strokeWeight={1}
            />
          )}

          {/* Layer 2b: GPS Trajectory (Real-time Polyline - z-index 50) */}
          {activeTrajectoryPath && activeTrajectoryPath.length > 0 && (
            <TrajectoryLayer
              map={mapLayerRef?.current?.map as any}
              path={activeTrajectoryPath}
              strokeColor="#3B82F6"
              strokeWeight={6}
            />
          )}

          {ghostPath && ghostPath.length > 1 && (
            <GhostPathLayer
              map={mapLayerRef?.current?.map as any}
              ghostPath={ghostPath}
              strokeColor="#22C55E"
              strokeWeight={7}
            />
          )}

          {/* Layer 4: User Marker (Blue GPS Dot - z-index 60) */}
          <UserMarkerLayer
            map={mapLayerRef?.current?.map}
            position={markerPosition}
            isTracking={isTracking}
          />

          {/* Map Controls (includes fog toggle, mode switch, zoom, locate) */}
          {showControls && <MapControls />}

          {/* Fog Layer — only when fog toggle is ON */}
          {showFog && (
            <FogLayer map={mapLayerRef?.current?.map} />
          )}
        </div>
      </div>
    );
  }
);

AMapView.displayName = 'AMapView';

export default AMapView;
