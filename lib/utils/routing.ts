import { cellToLatLng } from 'h3-js';

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface SmartRouteResult {
  path: RoutePoint[];
  distance: number;
  duration: number; // seconds
  steps: any[];
}

/**
 * Calculate a smart running route connecting selected H3 hexes
 * Uses AMap Walking API to find paths between points
 */
export async function calculateSmartRoute(
  h3Indices: string[],
  startPoint: RoutePoint,
  AMap: any
): Promise<SmartRouteResult> {
  if (!AMap) throw new Error("AMap instance not found");
  if (h3Indices.length === 0) throw new Error("No hexes selected");

  // Convert H3 indices to LatLng points
  // cellToLatLng returns [lat, lng]
  const targetPoints = h3Indices.map(h3 => {
    const [lat, lng] = cellToLatLng(h3);
    return new AMap.LngLat(lng, lat);
  });

  // Strategy: Connect points sequentially
  // Start -> Point 1 -> Point 2 -> ... -> Last Point
  // Since AMap Walking has waypoint limits (usually 5), we might need to chain requests 
  // or just use the first few as waypoints.
  // For V1, we'll try to use all as waypoints if count <= 5.
  // If count > 5, we'll just segment them (Start->P1, P1->P2, etc.) and merge? 
  // Merging paths is safer for arbitrary numbers.
  
  const allPoints = [new AMap.LngLat(startPoint.lng, startPoint.lat), ...targetPoints];
  const fullPath: RoutePoint[] = [];
  let totalDistance = 0;
  let totalDuration = 0;
  const allSteps: any[] = [];

  // Helper to calculate segment
  const calculateSegment = (start: any, end: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const walking = new AMap.Walking({
        hideMarkers: true,
      });
      walking.search(start, end, function(status: string, result: any) {
        if (status === 'complete' && result.routes && result.routes.length > 0) {
          resolve(result.routes[0]);
        } else {
          // Fallback to straight line if walking route fails?
          // Or reject.
          console.warn("Walking route failed, falling back to straight line");
          resolve({
            distance: start.distance(end),
            time: start.distance(end) / 1.4, // approx 1.4m/s walking speed
            steps: [],
            path: [start, end] // Just straight line
          });
        }
      });
    });
  };

  // Process segments sequentially
  // To avoid hitting API limits too fast, we might want to batch or just do it.
  // AMap JS API is usually fast enough for a few segments.
  
  try {
      // Load plugin once
      await new Promise<void>((resolve) => AMap.plugin('AMap.Walking', () => resolve()));

      for (let i = 0; i < allPoints.length - 1; i++) {
        const start = allPoints[i];
        const end = allPoints[i+1];
        
        const route: any = await calculateSegment(start, end);
        
        totalDistance += route.distance;
        totalDuration += route.time;
        if (route.steps) allSteps.push(...route.steps);
        
        // Append path points
        // If it's a fallback straight line, route.path might be AMap.LngLat[]
        // If it's real route, we extract from steps
        if (route.steps && route.steps.length > 0) {
             route.steps.forEach((step: any) => {
                step.path.forEach((p: any) => {
                    fullPath.push({ lat: p.getLat(), lng: p.getLng() });
                });
             });
        } else if (route.path) {
             // Fallback
             route.path.forEach((p: any) => {
                fullPath.push({ lat: p.getLat(), lng: p.getLng() });
             });
        }
      }
      
      return {
        path: fullPath,
        distance: totalDistance,
        duration: totalDuration,
        steps: allSteps
      };

  } catch (error) {
      console.error("Smart Route calculation failed", error);
      throw error;
  }
}
