import { create } from 'zustand'
import type { PlannerRoute, RouteListSource } from '@/types/route-list'

interface RouteListStoreState {
  isOpen: boolean
  source: RouteListSource
  selectedRoute: PlannerRoute | null
  openRouteList: (source?: RouteListSource) => void
  closeRouteList: () => void
  setSelectedRoute: (route: PlannerRoute | null) => void
  clearSelectedRoute: () => void
}

export const useRouteListStore = create<RouteListStoreState>((set) => ({
  isOpen: false,
  source: 'unknown',
  selectedRoute: null,
  openRouteList: (source = 'unknown') => set({ isOpen: true, source }),
  closeRouteList: () => set({ isOpen: false }),
  setSelectedRoute: (route) => set({ selectedRoute: route }),
  clearSelectedRoute: () => set({ selectedRoute: null })
}))
