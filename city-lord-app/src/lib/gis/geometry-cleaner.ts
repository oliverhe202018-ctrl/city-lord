import * as turf from '@turf/turf';
import { Feature, Polygon, Position } from 'geojson';
import { MIN_TERRITORY_AREA_M2 } from '@/lib/constants/territory';
import { haversineDistance } from '@/lib/geometry-utils';

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

  // 1. Closure Check: 使用 haversineDistance 判断首尾距离是否 <= 20 米
  const CLOSURE_THRESHOLD_METERS = 20;
  const MIN_PATH_LENGTH_METERS = 50;
  const closedCoords = [...coordinates];
  const first = closedCoords[0];
  const last = closedCoords[closedCoords.length - 1];
  
  // 计算首尾点之间的实际距离（米）
  const startEndDistance = haversineDistance(first[1], first[0], last[1], last[0]);
  
  // 计算路径总长度（米）
  let totalPathLength = 0;
  for (let i = 1; i < closedCoords.length; i++) {
    totalPathLength += haversineDistance(
      closedCoords[i - 1][1], closedCoords[i - 1][0],
      closedCoords[i][1], closedCoords[i][0]
    );
  }
  
  // 若首尾距离在 20m 内且路径总长 >= 50m，则自动补点闭合
  // 防止用户原地踏步（首尾距离近但路径总长不足）被误判为闭合领地
  if (startEndDistance <= CLOSURE_THRESHOLD_METERS && totalPathLength >= MIN_PATH_LENGTH_METERS) {
    closedCoords.push([...first]);
    console.log(`[GeometryCleaner] 首尾距离 ${startEndDistance.toFixed(1)}m <= ${CLOSURE_THRESHOLD_METERS}m，路径总长 ${totalPathLength.toFixed(1)}m >= ${MIN_PATH_LENGTH_METERS}m，已自动补点闭合`);
  } else if (startEndDistance > CLOSURE_THRESHOLD_METERS) {
    console.log(`[GeometryCleaner] 首尾距离 ${startEndDistance.toFixed(1)}m > ${CLOSURE_THRESHOLD_METERS}m，不满足闭合条件`);
  } else {
    console.log(`[GeometryCleaner] 首尾距离 ${startEndDistance.toFixed(1)}m <= ${CLOSURE_THRESHOLD_METERS}m，但路径总长 ${totalPathLength.toFixed(1)}m < ${MIN_PATH_LENGTH_METERS}m，判定为原地踏步，不闭合`);
  }

  try {
    // 2. Initial Polygon Generation
    let poly = turf.polygon([closedCoords]);

    // 3. Noise Reduction & Cleaning (Simplify removes redundant "jitter" points)
    // Tolerance of 0.00005 is approximately 5 meters — ideal for outdoor running data.
    poly = turf.truncate(poly, { precision: 6 });
    poly = turf.cleanCoords(poly);
    
    // Adjust simplify tolerance and prevent geometry collapse
    const preSimplifyArea = turf.area(poly);
    const simplifiedPoly = turf.simplify(poly, { tolerance: 0.00001, highQuality: true });
    
    const postSimplifyArea = turf.area(simplifiedPoly);
    if (postSimplifyArea >= preSimplifyArea * 0.5) {
      poly = simplifiedPoly;
    } else {
      console.warn(`[GeometryCleaner] simplify area dropped from ${preSimplifyArea.toFixed(1)} to ${postSimplifyArea.toFixed(1)} (>50%). Reverted to original polygon.`);
    }

    // 4. Kink (Self-intersection) Detection and Resolution
    const validPolygons: Feature<Polygon>[] = [];
    const kinks = turf.kinks(poly);
    
    if (kinks.features.length > 0) {
      // 🎯 Self-intersection detected — decomposing using unkinkPolygon
      const unkinked = turf.unkinkPolygon(poly);
      
      turf.featureEach(unkinked, (feature) => {
        // Filter out microscopic "debris" polygons created by GPS jitter/self-crossing
        // Minimum area requirement for a valid gameplay territory
        if (turf.area(feature) >= MIN_TERRITORY_AREA_M2) {
          validPolygons.push(feature as Feature<Polygon>);
        }
      });
    } else {
      // No self-intersections — straight validation
      if (turf.area(poly) >= MIN_TERRITORY_AREA_M2) {
        validPolygons.push(poly);
      }
    }

    return validPolygons;
  } catch (error) {
    console.warn('[GeometryCleaner] Failed to process geometry:', error);
    return [];
  }
}
