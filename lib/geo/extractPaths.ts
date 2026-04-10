import type { Feature, Polygon, MultiPolygon, Geometry, FeatureCollection } from 'geojson';
import { polygon as turfPolygon, unkinkPolygon as turfUnkinkPolygon } from '@turf/turf';

/**
 * Helper to normalize and validate a single ring (array of points).
 * Handles both [lng, lat] and {lng, lat} formats.
 * Filters out invalid (NaN) coordinates and ensures minimum ring length.
 */
const toRing = (ring: any[]): [number, number][] =>
  ring
    .map((pt: any) => {
      // Handle [lng, lat] format
      if (Array.isArray(pt)) {
        return [Number(pt[0]), Number(pt[1])] as [number, number];
      }
      // Handle {lng, lat} format
      if (pt?.lng !== undefined && pt?.lat !== undefined) {
        return [Number(pt.lng), Number(pt.lat)] as [number, number];
      }
      return null;
    })
    .filter((pt): pt is [number, number] =>
      pt !== null && !isNaN(pt[0]) && !isNaN(pt[1])
    );

/**
 * Normalizes any GeoJSON input (Feature, FeatureCollection, or Geometry) into
 * a format suitable for AMap.Polygon's 'path'.
 * Returns an array of independent closed rings [lng, lat][].
 *
 * - FeatureCollection → recursively flattens all contained Features
 * - Feature → unwraps geometry and delegates
 * - Polygon → extracts exterior ring
 * - MultiPolygon → extracts each polygon's exterior ring
 */
export function extractPaths(
  input: Geometry | Feature | FeatureCollection | null | undefined
): [number, number][][] {
  if (!input) return [];

  // --- FeatureCollection: recursively flatten all features ---
  if ((input as any).type === 'FeatureCollection') {
    return (input as FeatureCollection).features.flatMap((f) => extractPaths(f));
  }

  // Unwrap Feature wrapper if present
  const geo: Geometry =
    (input as Feature).type === 'Feature'
      ? (input as Feature).geometry
      : (input as Geometry);

  if (!geo || !geo.type) return [];

  const paths: [number, number][][] = [];

  switch (geo.type) {
    case 'Polygon': {
      const coords = (geo as Polygon).coordinates;
      if (!coords || coords.length === 0) break;

      try {
        // ✅ 防卫性客户端 unkink — 解决存储时未 unkink 的自交多边形导致的蜘蛛网渲染
        const rawPoly = turfPolygon(coords);
        const unkinked = turfUnkinkPolygon(rawPoly);
        for (const f of unkinked.features) {
          const ring = toRing(f.geometry.coordinates[0]);
          if (ring.length >= 3) paths.push(ring);
        }
      } catch {
        // 降级：直接取外环
        const ring = toRing(coords[0]);
        if (ring.length >= 3) paths.push(ring);
      }
      break;
    }

    case 'MultiPolygon': {
      const coords = (geo as MultiPolygon).coordinates;
      if (!coords) break;

      for (const polygonRings of coords) {
        if (!polygonRings || polygonRings.length === 0) continue;

        // Extract exterior ring for each polygon in the multi-polygon
        const ring = toRing(polygonRings[0]);
        if (ring.length >= 3) {
          paths.push(ring);
        }
      }
      break;
    }

    default:
      break;
  }

  return paths;
}
