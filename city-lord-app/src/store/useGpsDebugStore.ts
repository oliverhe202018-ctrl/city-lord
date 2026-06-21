import { create } from 'zustand';

export interface DebugGpsPoint {
  lat: number;
  lng: number;
  status: 'valid' | 'discarded';
  reason?: string;
  timestamp: number;
}

interface GpsDebugState {
  isGpsDebugMode: boolean;
  debugGpsTrace: DebugGpsPoint[];
  toggleGpsDebugMode: () => void;
  addDebugPoint: (point: DebugGpsPoint) => void;
  clearDebugTrace: () => void;
}

export const useGpsDebugStore = create<GpsDebugState>((set) => ({
  isGpsDebugMode: false,
  debugGpsTrace: [],
  toggleGpsDebugMode: () => set((state) => {
    const nextMode = !state.isGpsDebugMode;
    return {
      isGpsDebugMode: nextMode,
      debugGpsTrace: nextMode ? state.debugGpsTrace : [], // Clear on off
    };
  }),
  addDebugPoint: (point) => set((state) => {
    if (!state.isGpsDebugMode) return state;
    return {
      debugGpsTrace: [...state.debugGpsTrace, point]
    };
  }),
  clearDebugTrace: () => set({ debugGpsTrace: [] })
}));
