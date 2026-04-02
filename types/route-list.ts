export interface RoutePoint {
  lat: number
  lng: number
  isKey?: boolean
}

export interface PlannerRoute {
  id: string
  name: string
  distance: number
  capture_area: number
  created_at: string
  waypoints: RoutePoint[]
}

export type RouteListSource = 'planner' | 'game' | 'route-planner' | 'game-planner' | 'unknown'
