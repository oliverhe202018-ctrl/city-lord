import { create } from 'zustand';

export interface MapCameraFocus {
  lng: number;
  lat: number;
  zoom?: number;
  territoryId?: string;
  polygonPoints?: [number, number][]; // BBox/FitView calculation
}

interface MapInteractionState {
  pendingFocusId: string | null;
  selectedTerritoryId: string | null;
  pendingCameraFocus: MapCameraFocus | null;
  
  setPendingFocusId: (id: string | null) => void;
  setSelectedTerritoryId: (id: string | null) => void;
  setPendingCameraFocus: (focus: MapCameraFocus | null) => void;
  clearFocus: () => void;
  clearInteraction: () => void;
}

export const useMapInteractionStore = create<MapInteractionState>((set) => ({
  pendingFocusId: null,
  selectedTerritoryId: null,
  pendingCameraFocus: null,
  
  setPendingFocusId: (id) => set({ pendingFocusId: id }),
  setSelectedTerritoryId: (id) => set({ selectedTerritoryId: id }),
  setPendingCameraFocus: (focus) => set({ pendingCameraFocus: focus }),
  
  clearFocus: () => set({ pendingFocusId: null }),
  clearInteraction: () => set({ pendingFocusId: null, selectedTerritoryId: null, pendingCameraFocus: null })
}));
