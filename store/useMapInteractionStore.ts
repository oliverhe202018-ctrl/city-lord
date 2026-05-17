import { create } from 'zustand'

interface MapInteractionState {
  pendingFocusId: string | null
  selectedTerritoryId: string | null
  setPendingFocusId: (id: string | null) => void
  setSelectedTerritoryId: (id: string | null) => void
  clearFocus: () => void
}

export const useMapInteractionStore = create<MapInteractionState>((set) => ({
  pendingFocusId: null,
  selectedTerritoryId: null,
  setPendingFocusId: (id) => set({ pendingFocusId: id }),
  setSelectedTerritoryId: (id) => set({ selectedTerritoryId: id }),
  clearFocus: () => set({ pendingFocusId: null }),
}))
