import * as turf from '@turf/turf';
import { Feature, Polygon, Position } from 'geojson';

/**
 * Validates, cleans, and unkinks a trajectory into one or more valid Polygons.
 * Prevents PostGIS topology errors by ensuring high quality geometry before DB insertion.
 * 
 * @param coordinates Array of [lng, lat] coordinate pairs
 * @returns Array of GeoJSON Polygon features
 */
export function cleanAndSplitTrajectory(coordinates: Position[]): Feature<Polygon>[] {
  if (!coordinates || coordinates.length < 3) {
    return [];
  }

  // 1. Closure Check: Ensure the ring is closed as required by GeoJSON spec
  const closedCoords = [...coordinates];
  const first = closedCoords[0];
  const last = closedCoords[closedCoords.length - 1];
  
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closedCoords.push([...first]);
  }

  try {
    // 2. Initial Polygon Generation
    let poly = turf.polygon([closedCoords]);

    // 3. Noise Reduction & Cleaning (Simplify removes redundant "jitter" points)
    // Tolerance of 0.00005 is approximately 5 meters — ideal for outdoor running data.
    poly = turf.truncate(poly, { precision: 6 });
    poly = turf.cleanCoords(poly);
    poly = turf.simplify(poly, { tolerance: 0.00005, highQuality: true });

    // 4. Kink (Self-intersection) Detection and Resolution
    const validPolygons: Feature<Polygon>[] = [];
    const kinks = turf.kinks(poly);
    
    if (kinks.features.length > 0) {
      // 🎯 Self-intersection detected — decomposing using unkinkPolygon
      const unkinked = turf.unkinkPolygon(poly);
      
      turf.featureEach(unkinked, (feature) => {
        // Filter out microscopic "debris" polygons created by GPS jitter/self-crossing
        // Minimum 50m² requirement for a valid gameplay territory
        if (turf.area(feature) >= 50) {
          validPolygons.push(feature as Feature<Polygon>);
        }
      });
    } else {
      // No self-intersections — straight validation
      if (turf.area(poly) >= 50) {
        validPolygons.push(poly);
      }
    }

    return validPolygons;
  } catch (error) {
    console.warn('[GeometryCleaner] Failed to process geometry:', error);
    return [];
  }
}
