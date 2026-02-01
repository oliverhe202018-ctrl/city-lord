import { cellToBoundary, latLngToCell, gridDisk, cellToLatLng } from "h3-js";

// ==========================================
// Constants & Types
// ==========================================
export const RENDER_RADIUS = 3;
export const H3_RESOLUTION = 9;
export const MAX_RENDER_COUNT = 1000;

export interface HexagonCell {
  id: string;
  centerLat: number;
  centerLng: number;
}

// ==========================================
// H3 Wrappers for GeoHexGrid
// ==========================================

// Wrapper for gridDisk to match GeoHexGrid expectation
// Returns an object with a 'cells' property containing enriched cell data
export function getDisk(centerId: string, k: number) {
  const cellIds = gridDisk(centerId, k);
  const cells: HexagonCell[] = cellIds.map(id => {
    const [lat, lng] = cellToLatLng(id);
    return { id, centerLat: lat, centerLng: lng };
  });
  return { cells };
}

// Helper for viewport cells
export function getViewportCells(lat: number, lng: number, zoom: number): HexagonCell[] {
  // Simple implementation using disk
  const k = Math.max(1, Math.floor(zoom / 4) + 1);
  const centerId = latLngToCell(lat, lng, H3_RESOLUTION);
  const { cells } = getDisk(centerId, k);
  return cells;
}

// Re-export core functions
export { latLngToCell, cellToBoundary };

// ==========================================
// GeoJSON Converters
// ==========================================

// 将 H3 索引转换为 GeoJSON Polygon 格式
export function h3ToGeoJSON(h3Index: string) {
  // 获取六边形的边界坐标 (默认是 [lat, lng])
  const boundary = cellToBoundary(h3Index);
  
  // GeoJSON 需要 [lng, lat] 格式，所以需要反转一下坐标
  const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
  
  // 闭合多边形（第一个点和最后一个点必须相同）
  coordinates.push(coordinates[0]);

  return {
    type: "Feature",
    properties: { h3Index },
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
  };
}

// 批量转换
export function h3SetToFeatureCollection(h3Indexes: string[]) {
  return {
    type: "FeatureCollection",
    features: h3Indexes.map(h3ToGeoJSON),
  };
}

// Alias for compatibility
export const h3ToAmapGeoJSON = h3SetToFeatureCollection;
