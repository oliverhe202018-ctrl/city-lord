/**
 * Douglas-Peucker 轨迹抽稀算法（同步实现，基于垂直距离）
 *
 * 用于在跑步结算前对超长轨迹进行主线程压缩，防止 GeoJSON 序列化超时。
 *
 * @param points 原始轨迹点数组
 * @param tolerance 抽稀容差（度），建议 0.00005 ≈ 5m
 * @returns 抽稀后的轨迹点数组（首尾点始终保留）
 */
export function simplifyPath(
  points: { lat: number; lng: number }[],
  tolerance: number
): { lat: number; lng: number }[] {
  if (points.length <= 2) return points.slice();

  const squaredTolerance = tolerance * tolerance;

  // 计算点到线段的垂直距离平方
  function perpendicularDistanceSq(
    pt: { lat: number; lng: number },
    lineStart: { lat: number; lng: number },
    lineEnd: { lat: number; lng: number }
  ): number {
    const dx = lineEnd.lng - lineStart.lng;
    const dy = lineEnd.lat - lineStart.lat;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      // 线段退化为点
      const dLng = pt.lng - lineStart.lng;
      const dLat = pt.lat - lineStart.lat;
      return dLng * dLng + dLat * dLat;
    }

    // 投影参数 t ∈ [0, 1]
    const t = ((pt.lng - lineStart.lng) * dx + (pt.lat - lineStart.lat) * dy) / lengthSq;
    const clampedT = t < 0 ? 0 : t > 1 ? 1 : t;

    const projLng = lineStart.lng + clampedT * dx;
    const projLat = lineStart.lat + clampedT * dy;

    const dLng = pt.lng - projLng;
    const dLat = pt.lat - projLat;
    return dLng * dLng + dLat * dLat;
  }

  // 递归 Douglas-Peucker
  function dpReduce(start: number, end: number): number[] {
    let maxDistSq = 0;
    let maxIndex = -1;

    for (let i = start + 1; i < end; i++) {
      const distSq = perpendicularDistanceSq(points[i], points[start], points[end]);
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        maxIndex = i;
      }
    }

    if (maxDistSq > squaredTolerance) {
      const left = dpReduce(start, maxIndex);
      const right = dpReduce(maxIndex, end);
      // 合并时去除重复的 maxIndex
      return [...left, ...right.slice(1)];
    }

    return [start, end];
  }

  const indices = dpReduce(0, points.length - 1);
  return indices.map(i => points[i]);
}
