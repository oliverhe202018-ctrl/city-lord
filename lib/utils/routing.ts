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
 * Calculate a smart running route connecting selected territory waypoints.
 */
export async function calculateSmartRoute(
  points: RoutePoint[],
  startPoint: RoutePoint,
  AMap: any
): Promise<SmartRouteResult> {
  if (!AMap) throw new Error("AMap instance not found");
  if (points.length === 0) throw new Error("No points provided");

  const targetPoints = points.map(p => new AMap.LngLat(p.lng, p.lat));
  
  const allPoints = [new AMap.LngLat(startPoint.lng, startPoint.lat), ...targetPoints];
  const fullPath: RoutePoint[] = [];
  let totalDistance = 0;
  let totalDuration = 0;
  const allSteps: any[] = [];

  const calculateSegment = (start: any, end: any): Promise<any> => {
    return new Promise((resolve) => {
      const walking = new AMap.Walking({
        hideMarkers: true,
      });
      walking.search(start, end, function(status: string, result: any) {
        if (status === 'complete' && result.routes && result.routes.length > 0) {
          resolve(result.routes[0]);
        } else {
          console.warn("Walking route failed, falling back to straight line");
          resolve({
            distance: start.distance(end),
            time: start.distance(end) / 1.4,
            steps: [],
            path: [start, end]
          });
        }
      });
    });
  };

  try {
      await new Promise<void>((resolve) => AMap.plugin('AMap.Walking', () => resolve()));

      for (let i = 0; i < allPoints.length - 1; i++) {
        const start = allPoints[i];
        const end = allPoints[i+1];
        
        const route: any = await calculateSegment(start, end);
        
        totalDistance += route.distance;
        totalDuration += route.time;
        if (route.steps) allSteps.push(...route.steps);
        
        if (route.steps && route.steps.length > 0) {
             route.steps.forEach((step: any) => {
                step.path.forEach((p: any) => {
                    fullPath.push({ lat: p.getLat(), lng: p.getLng() });
                });
             });
        } else if (route.path) {
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
