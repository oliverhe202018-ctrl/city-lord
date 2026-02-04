import { cellToBoundary } from 'h3-js';

/**
 * 将 H3 索引转换为 AMap (高德地图) 可用的 GeoJSON Polygon 对象
 * @param h3Index H3 六边形索引字符串
 * @param properties 额外的属性 (如颜色、样式、领地等级等)
 */
export function h3ToAmapGeoJSON(h3Index: string, properties: any = {}) {
  // 1. 获取 H3 六边形的边界坐标 (默认返回是 [lat, lng])
  // 注意：h3-js 返回的是 [纬度, 经度]
  const boundary = cellToBoundary(h3Index);
  
  // 2. 转换为 GeoJSON 标准格式 [lng, lat] (经度, 纬度)
  const coordinates = boundary.map(([lat, lng]) => [lng, lat]);

  // 3. 闭合多边形 (GeoJSON 要求起点和终点重合)
  if (coordinates.length > 0) {
    coordinates.push(coordinates[0]);
  }

  // 4. 返回标准的 GeoJSON Feature 对象
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates] // 注意：Polygon 的坐标是数组的数组
    },
    properties: {
      ...properties,
      id: h3Index, // 将 H3 索引作为 ID
    }
  };
}

/**
 * 批量转换函数 (方便一次性渲染一大片领地)
 */
export function h3SetToFeatureCollection(h3Indices: string[], getProperties?: (h3: string) => any) {
  return {
    type: 'FeatureCollection',
    features: h3Indices.map(h3 => h3ToAmapGeoJSON(h3, getProperties ? getProperties(h3) : {}))
  };
}