import { cellToBoundary } from "h3-js";

// 将 H3 索引转换为 GeoJSON Polygon 格式
export function h3ToGeoJSON(h3Index: string) {
  // 获取六边形的边界坐标 (默认是 [lat, lng])
  const boundary = cellToBoundary(h3Index);
  
  // GeoJSON 需要 [lng, lat] 格式，所以需要反转一下坐标
  // 注意：如果是高德地图，不需要反转，直接用 [lng, lat] 即可，取决于 h3-js 的输出配置
  // 这里假设 h3-js 输出的是 [lat, lng]，我们需要反转为 [lng, lat]
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

// Alias for compatibility if needed, or we update the usage
export const h3ToAmapGeoJSON = h3SetToFeatureCollection;
