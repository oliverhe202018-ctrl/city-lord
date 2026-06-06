import { create } from 'zustand';

export type MapDisplayMode = 'personal' | 'faction' | 'club';

interface MapDisplayState {
  mapDisplayMode: MapDisplayMode;
  toggleFactionMode: () => void;
  toggleClubMode: () => void;
  setMapDisplayMode: (mode: MapDisplayMode) => void;
}

export const useMapDisplayStore = create<MapDisplayState>((set, get) => ({
  mapDisplayMode: 'personal',

  setMapDisplayMode: (mode) => set({ mapDisplayMode: mode }),

  toggleFactionMode: () => {
    const current = get().mapDisplayMode;
    if (current === 'club') return;
    set({ mapDisplayMode: current === 'personal' ? 'faction' : 'personal' });
  },

  toggleClubMode: () => {
    const current = get().mapDisplayMode;
    if (current === 'faction') return;
    set({ mapDisplayMode: current === 'personal' ? 'club' : 'personal' });
  },
}));
