import { cellToBoundary, latLngToCell } from "h3-js";

// ==========================================
// 1. 补全缺失的常量 (修复 RENDER_RADIUS 报错)
// ==========================================
// 定义地图上需要渲染的六边形半径范围 (例如：只渲染周围 3 圈)
export const RENDER_RADIUS = 3; 

// ==========================================
// 2. 重新导出 h3-js 核心函数 (修复 latLngToCell 报错)
// ==========================================
// 你的 GeoHexGrid 组件直接从这里引用了这些函数，所以必须导出
export { latLngToCell, cellToBoundary };

// ==========================================
// 3. 核心工具函数
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

// ==========================================
// 4. 兼容性导出 (Alias)
// ==========================================
// 如果有组件引用 h3ToAmapGeoJSON，让它指向单个转换函数通常更安全
// (之前的代码将它指向了 Collection 函数，可能会导致类型混乱，建议统一用下面这个)
export function h3ToAmapGeoJSON(h3Index: string) {
  return h3ToGeoJSON(h3Index);
}
