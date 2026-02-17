import React, { forwardRef } from 'react';
import { useMap } from './AMapContext';
import { MapLayer } from './layers/MapLayer';
import { ClaimedPolygonLayer } from './layers/ClaimedPolygonLayer';
import { TrajectoryLayer } from './layers/TrajectoryLayer';
import { UserMarkerLayer } from './layers/UserMarkerLayer';
import { LoadingSkeleton } from './LoadingSkeleton';
import { LocationIndicator } from './LocationIndicator';
import { KingdomLayer } from './layers/KingdomLayer';
import { ClubKingdomLayer } from './layers/ClubKingdomLayer';
import { MapControls } from './MapControls';
import { KingdomModeSwitch } from './KingdomModeSwitch';
import { useAuth } from '@/hooks/useAuth';

export type AMapViewHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
};

export interface AMapViewProps {
  showTerritory: boolean;
  onMapLoad?: () => void;
  viewMode?: 'user' | 'club';
  sessionClaims?: { lat: number; lng: number; timestamp: number }[][]; // Claimed polygons during run
}

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
  ({ showTerritory, onMapLoad, viewMode, sessionClaims = [] }, ref) => {
    const {
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
    } = useMap();

    const { user } = useAuth();

    // Removed blocking showMap logic - Always render map
    // const showMap = locationStatus === 'locked' || locationStatus === 'error';

    return (
      <div className="relative w-full h-full">
        {/* New Non-blocking Location Indicator */}
        <LocationIndicator status={locationStatus || 'initializing'} />

        {/* Loading Skeleton - hides everything until GPS locked */}
        {/* {!showMap && <LoadingSkeleton />} */}

        {/* Layer 1: Pure Map */}
        <div className="w-full h-full">
          <MapLayer
            ref={mapLayerRef}
            initialCenter={mapCenter || [116.397428, 39.90923]}
            initialZoom={13}
            onMoveEnd={handleMapMoveEnd}
            onLoad={onMapLoad}
            onMapReady={setMap}
          />

          {/* Layer 0: Kingdom (Historical Territories) - Lowest z-index */}
          {showKingdom && kingdomMode === 'personal' && (
            <KingdomLayer map={mapLayerRef?.current?.map} userId={user?.id || null} />
          )}
          {showKingdom && kingdomMode === 'club' && (
            <ClubKingdomLayer map={mapLayerRef?.current?.map} userId={user?.id || null} />
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
          {userPath && userPath.length > 0 && (
            <TrajectoryLayer
              map={mapLayerRef?.current?.map}
              path={userPath}
              strokeColor="#3B82F6"
              strokeWeight={6}
            />
          )}

          {/* Layer 4: User Marker (Blue GPS Dot - z-index 60) */}
          <UserMarkerLayer
            map={mapLayerRef?.current?.map}
            position={currentLocation}
            isTracking={isTracking}
          />

          {/* Map Controls (Location button, etc.) */}
          <MapControls />

          {/* Kingdom Mode Switch (Personal/Club toggle) */}
          <div className="absolute bottom-60 right-[72px] z-10 pointer-events-auto">
            <KingdomModeSwitch />
          </div>
        </div>
      </div>
    );
  }
);

AMapView.displayName = 'AMapView';

export default AMapView;
