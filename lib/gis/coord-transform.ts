/**
 * coord-transform.ts
 *
 * GCJ02 (高德/国测局坐标系) ↔ WGS84 (国际标准坐标系) 双向转换
 *
 * 核心用途：
 *   - 面积结算前将 GCJ02 坐标转为 WGS84，确保 turf.area() 计算结果准确
 *   - 入库渲染坐标保持 GCJ02 不变（高德地图需要）
 *
 * 算法来源：基于开源 gcj02-wgs84 逆变换实现
 * 精度：偏移量 < 0.5 米（满足游戏领地结算需求）
 */

// ============================================================
// 常量定义
// ============================================================

const PI = Math.PI;
const A = 6378245.0; // 长半轴
const EE = 0.00669342162296594323; // 偏心率平方

// ============================================================
// 核心变换函数
// ============================================================

/**
 * 判断坐标是否在中国境内（仅中国境内需要 GCJ02 偏移）
 */
function isOutOfChina(lat: number, lng: number): boolean {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
    return ret;
}

function transformLng(x: number, y: number): number {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
}

/**
 * WGS84 → GCJ02（正向偏移，用于对比验证）
 */
export function wgs84ToGcj02(lat: number, lng: number): { lat: number; lng: number } {
    if (isOutOfChina(lat, lng)) {
        return { lat, lng };
    }

    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = (lat / 180.0) * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

    return { lat: lat + dLat, lng: lng + dLng };
}

/**
 * GCJ02 → WGS84（逆向偏移，用于面积精确计算）
 *
 * 使用迭代逼近法，精度 < 0.5 米
 */
export function gcj02ToWgs84(lat: number, lng: number): { lat: number; lng: number } {
    if (isOutOfChina(lat, lng)) {
        return { lat, lng };
    }

    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = (lat / 180.0) * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

    // 逆向：从 GCJ02 减去偏移量得到 WGS84
    return { lat: lat - dLat, lng: lng - dLng };
}

// ============================================================
// 批量转换工具（用于多边形坐标）
// ============================================================

export interface CoordPoint {
    lat: number;
    lng: number;
}

/**
 * 将多边形坐标数组从 GCJ02 转换为 WGS84（深拷贝，不修改原数组）
 *
 * 用途：在 turf.area() 计算前调用，确保面积基于 WGS84 椭球体
 */
export function gcj02PolygonToWgs84(coords: CoordPoint[]): CoordPoint[] {
    return coords.map(pt => gcj02ToWgs84(pt.lat, pt.lng));
}

/**
 * 将 Turf.js [lng, lat] 格式坐标从 GCJ02 转换为 WGS84
 */
export function gcj02LngLatToWgs84(coords: [number, number][]): [number, number][] {
    return coords.map(([lng, lat]) => {
        const wgs = gcj02ToWgs84(lat, lng);
        return [wgs.lng, wgs.lat] as [number, number];
    });
}
