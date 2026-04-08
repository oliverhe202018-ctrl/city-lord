import type { Feature, Polygon, MultiPolygon, Geometry } from 'geojson';

/**
 * Normalizes any GeoJSON Feature/Geometry into a format suitable for AMap.Polygon's 'path'.
 * 返回值是一个数组，每个元素对应一个独立闭合环 [lng, lat][]。
 * AMap.Polygon ({ path }) 期望：
 * - 单个多边形：[[lng, lat], [lng, lat], ...]
 * - 带孔多边形：[[[lng,lat],...], [[lng,lat],...]]
 * 
 * 为了彻底解决蜘蛛网问题，我们将 MultiPolygon 拆分为多个独立的 Polygon 路径返回。
 */
export function extractPaths(
  geometry: Geometry | Feature | null | undefined
): [number, number][][] {
  if (!geometry) return [];

  // Unwrap Feature if necessary
  const geo: Geometry =
    geometry.type === 'Feature' ? geometry.geometry : (geometry as Geometry);

  if (!geo) return [];

  const paths: [number, number][][] = [];

  const validateRing = (ring: any): ring is [number, number][] => {
    return Array.isArray(ring) && ring.length >= 3 && Array.isArray(ring[0]) && typeof ring[0][0] === 'number';
  };

  switch (geo.type) {
    case 'Polygon': {
      const coord = (geo as Polygon).coordinates;
      if (!coord || coord.length === 0) break;
      const exteriorRing = coord[0];
      if (validateRing(exteriorRing)) {
        paths.push(exteriorRing as [number, number][]);
      }
      break;
    }

    case 'MultiPolygon': {
      const coord = (geo as MultiPolygon).coordinates;
      if (!coord) break;
      for (const polygonRings of coord) {
        const exteriorRing = polygonRings[0];
        if (validateRing(exteriorRing)) {
          paths.push(exteriorRing as [number, number][]);
        }
      }
      break;
    }

    default:
      break;
  }

  return paths;
}
