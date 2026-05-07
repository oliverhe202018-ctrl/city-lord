/**
 * getTerritoryBounds —— 计算多边形包围盒
 * 输入：GCJ-02 坐标系的顶点数组 [[lng, lat], ...]
 * 输出：符合高德 AMap.Bounds 标准的对象 [[minLng, minLat], [maxLng, maxLat]]
 */
export function getTerritoryBounds(path: [number, number][]): [[number, number], [number, number]] {
  if (path.length === 0) {
    throw new Error('getTerritoryBounds: path cannot be empty');
  }

  let minLng = path[0][0];
  let maxLng = path[0][0];
  let minLat = path[0][1];
  let maxLat = path[0][1];

  for (let i = 1; i < path.length; i++) {
    const [lng, lat] = path[i];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [[minLng, minLat], [maxLng, maxLat]];
}

/**
 * getTerritoryCenter —— 计算多边形中心点
 * 输入：GCJ-02 坐标系的顶点数组
 * 输出：中心点坐标 [lng, lat]
 */
export function getTerritoryCenter(path: [number, number][]): [number, number] {
  if (path.length === 0) {
    throw new Error('getTerritoryCenter: path cannot be empty');
  }

  let sumLng = 0;
  let sumLat = 0;

  for (const [lng, lat] of path) {
    sumLng += lng;
    sumLat += lat;
  }

  return [sumLng / path.length, sumLat / path.length];
}
