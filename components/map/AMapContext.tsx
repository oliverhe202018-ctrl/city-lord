"use client"

import { createContext, useContext, ReactNode, RefObject } from 'react';
import { GeoPoint, LocationStatus } from '@/hooks/useSafeGeolocation';

export interface LocationState {
  status: 'loading' | 'success' | 'error';
  message?: string;
  coords?: [number, number]; // GCJ-02
}

// AMap interface (minimal typing for AMap 2.0)
export interface AMapInstance {
  setMapStyle: (style: string) => void;
  panTo: (position: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setCenter: (center: [number, number], immediately?: boolean) => void;
  getCenter: () => { lng: number; lat: number };
  getZoom: () => number;
  zoomIn: () => void;
  zoomOut: () => void;
  add: (overlay: unknown) => void;
  remove: (overlay: unknown) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  setZoomAndCenter: (zoom: number, center: [number, number], immediately?: boolean, duration?: number) => void;
}

// MapLayer handle interface
export interface MapLayerHandle {
  map: AMapInstance | null;
  flyTo: (center: [number, number], zoom?: number, duration?: number) => void;
  getCenter: () => [number, number] | null;
}

export interface AMapContextProps {
  map: AMapInstance | null;
  setMap: (map: AMapInstance | null) => void;
  isLoaded: boolean;
  viewMode: 'individual' | 'faction';
  setViewMode: (mode: 'individual' | 'faction') => void;
  locationState: LocationState; // Deprecated, use locationStatus
  currentLocation: GeoPoint | null;
  initLocation: () => Promise<void>;
  centerMap: () => void;

  // Running game state (Phase 1)
  userPath?: GeoPoint[]; // GPS trajectory history (source of truth)
  mapCenter?: [number, number]; // Map viewport center
  isTracking?: boolean; // Auto-follow mode
  setIsTracking?: (tracking: boolean) => void;
  mapLayerRef?: RefObject<MapLayerHandle>; // Properly typed ref
  handleMapMoveEnd?: (center: [number, number]) => void;
  gpsSignalStrength?: 'good' | 'weak' | 'none';
  locationStatus?: LocationStatus; // State machine status

  // Kingdom layer control (Phase 12)
  showKingdom?: boolean;
  toggleKingdom?: () => void;

  // Kingdom mode (Phase 14)
  kingdomMode?: 'personal' | 'club';
  setKingdomMode?: (mode: 'personal' | 'club') => void;

  // Fog (mask) layer control
  showFog?: boolean;
  toggleFog?: () => void;
}

export const AMapContext = createContext<AMapContextProps | undefined>(undefined);

export const MapProvider = AMapContext.Provider;

export function useMap() {
  const context = useContext(AMapContext);
  if (context === undefined) {
    throw new Error('useMap must be used within an MapRoot (formerly AMapProvider)');
  }
  return context;
}
