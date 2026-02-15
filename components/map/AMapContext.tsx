"use client"

import { createContext, useContext, ReactNode } from 'react';
import { GeoPoint } from '@/hooks/useSafeGeolocation';

export interface LocationState {
  status: 'loading' | 'success' | 'error';
  message?: string;
  coords?: [number, number]; // GCJ-02
}

export interface AMapContextProps {
  map: any | null;
  setMap: (map: any | null) => void;
  isLoaded: boolean;
  viewMode: 'individual' | 'faction';
  setViewMode: (mode: 'individual' | 'faction') => void;
  locationState: LocationState; // Keep for backward compatibility if needed, or deprecate
  currentLocation: GeoPoint | null; // New field
  initLocation: () => Promise<void>; // Keep for compatibility, maybe alias to retry
  centerMap: () => void;
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
