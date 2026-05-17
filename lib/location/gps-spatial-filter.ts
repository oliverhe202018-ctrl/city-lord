/**
 * GpsSpatialFilter — GPS 空间滤波与卡尔曼平滑器
 *
 * 职责：
 *  - 低精度漂移过滤：accuracy > 50m 时，要求位移 > accuracy * 0.8 且绝对位移 > 10m
 *  - 速度校验：前后两点移动速度 > 30m/s（约108km/h）判定为 GPS 飞点（兼容公交/骑行）
 *  - 一维卡尔曼滤波：对 Lat 和 Lng 分别进行平滑，根据 accuracy 动态调整观测噪声 R
 *  - 距离滤波：jitter < 2m 丢弃
 *
 * 所有坐标假定为 GCJ-02，直接用于轨迹 store。
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LatLngPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

export interface SpatialFilterDecision {
  accept: boolean;
  reason: 'first-point' | 'jitter(<2m)' | 'low-accuracy-drift' | 'speed-anomaly' | 'valid';
  distanceMeters: number;
  calculatedSpeed?: number;
}

export interface KalmanFilterState {
  x: number; // 估计值
  p: number; // 估计误差协方差
  q: number; // 过程噪声协方差
  r: number; // 观测噪声协方差
}

export interface FilteredPoint extends LatLngPoint {
  smoothedLat: number;
  smoothedLng: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EARTH_RADIUS_METERS = 6371000;
const MAX_HUMAN_SPEED_MS = 30; // 约 108km/h，超过此速度视为 GPS 飞点（兼容公交/骑行）
const LOW_ACCURACY_THRESHOLD = 50; // meters
const LOW_ACCURACY_DISPLACEMENT_RATIO = 0.8; // 位移必须超过 accuracy 的 80%
const LOW_ACCURACY_MIN_DISPLACEMENT = 10; // meters
const JITTER_THRESHOLD = 2; // meters
const DEFAULT_PROCESS_NOISE = 2.0; // 默认过程噪声 Q（方差量纲，与 P/R 对齐）

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const distanceMetersBetween = (a: LatLngPoint, b: LatLngPoint): number => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const hav =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
  return EARTH_RADIUS_METERS * c;
};

// ---------------------------------------------------------------------------
// Kalman Filter (1D)
// ---------------------------------------------------------------------------

/**
 * 创建一维卡尔曼滤波器实例
 * @param initialValue 初始估计值
 * @param accuracy GPS 报告的精度（米），用于初始化观测噪声 R
 */
export const createKalmanFilter = (initialValue: number, accuracy: number = 10): KalmanFilterState => ({
  x: initialValue, // 初始估计
  p: accuracy * accuracy, // 初始估计误差协方差（方差量纲）
  q: DEFAULT_PROCESS_NOISE, // 过程噪声协方差（方差量纲）
  r: Math.max(accuracy * accuracy, 1), // 观测噪声协方差（方差量纲）
});

/**
 * 一维卡尔曼滤波更新步骤（分离预测步与更新步）
 * @param filter 滤波器状态
 * @param measurement 新观测值
 * @param measurementAccuracy 新观测值的精度（用于动态调整 R）
 */
export const kalmanUpdate = (
  filter: KalmanFilterState,
  measurement: number,
  measurementAccuracy: number = 10
): number => {
  // 预测步：P_predicted = P + Q
  const pPredicted = filter.p + filter.q;

  // 动态观测噪声 R（方差量纲）
  const r = Math.max(measurementAccuracy * measurementAccuracy, 1);

  // 更新步：卡尔曼增益
  const k = pPredicted / (pPredicted + r);

  // 更新估计值
  filter.x = filter.x + k * (measurement - filter.x);

  // 更新估计误差协方差
  filter.p = (1 - k) * pPredicted;

  return filter.x;
};

// ---------------------------------------------------------------------------
// Spatial Filter
// ---------------------------------------------------------------------------

export const shouldAcceptPointByDistance = (
  prevPoint: LatLngPoint | null,
  nextPoint: LatLngPoint & { accuracy?: number }
): SpatialFilterDecision => {
  if (!prevPoint) {
    return { accept: true, reason: 'first-point', distanceMeters: 0 };
  }

  const distanceMeters = distanceMetersBetween(prevPoint, nextPoint);
  const accuracy = nextPoint.accuracy ?? 9999;

  // --- 1. 低精度漂移过滤 ---
  // 当 GPS 信号差（accuracy > 50m，即室内/基站定位）时：
  // 必须满足位移 > accuracy * 0.8 且绝对位移 > 10m 才予通过
  if (accuracy > LOW_ACCURACY_THRESHOLD) {
    const requiredDisplacement = accuracy * LOW_ACCURACY_DISPLACEMENT_RATIO;
    if (distanceMeters < requiredDisplacement || distanceMeters < LOW_ACCURACY_MIN_DISPLACEMENT) {
      return {
        accept: false,
        reason: 'low-accuracy-drift',
        distanceMeters,
      };
    }
  }

  // --- 2. 静止抖动过滤 ---
  if (distanceMeters < JITTER_THRESHOLD) {
    return { accept: false, reason: 'jitter(<2m)', distanceMeters };
  }

  // --- 3. 速度校验与飞点兜底（合并逻辑） ---
  if (prevPoint.timestamp && nextPoint.timestamp) {
    const timeDiffMs = nextPoint.timestamp - prevPoint.timestamp;

    // 时钟回拨：直接拒绝
    if (timeDiffMs < 0) {
      return {
        accept: false,
        reason: 'speed-anomaly',
        distanceMeters,
        calculatedSpeed: Infinity,
      };
    }

    // 同一时刻两点（部分安卓设备批量推送时会出现）：直接用距离兜底，无需速度计算
    if (timeDiffMs === 0) {
      return distanceMeters > 10
        ? { accept: false, reason: 'speed-anomaly', distanceMeters, calculatedSpeed: Infinity }
        : { accept: true, reason: 'valid', distanceMeters };
    }

    const timeDiffS = timeDiffMs / 1000;

    if (timeDiffMs > 100) {
      // 时间差 > 100ms：正常计算速度
      const speed = distanceMeters / timeDiffS;
      if (speed > MAX_HUMAN_SPEED_MS) {
        return {
          accept: false,
          reason: 'speed-anomaly',
          distanceMeters,
          calculatedSpeed: speed,
        };
      }
    } else {
      // 时间差 <= 100ms：无法可靠计算速度，用绝对距离兜底
      if (distanceMeters > 100) {
        return {
          accept: false,
          reason: 'speed-anomaly',
          distanceMeters,
        };
      }
    }
  }

  return { accept: true, reason: 'valid', distanceMeters };
};

// ---------------------------------------------------------------------------
// SmoothPoint — 卡尔曼平滑入口
// ---------------------------------------------------------------------------

/**
 * 对定位点进行卡尔曼平滑
 * @param point 原始定位点
 * @param latFilter 纬度滤波器状态（会被修改）
 * @param lngFilter 经度滤波器状态（会被修改）
 */
export const smoothPoint = (
  point: LatLngPoint,
  latFilter: KalmanFilterState,
  lngFilter: KalmanFilterState
): FilteredPoint => {
  const accuracy = point.accuracy ?? 10;

  const smoothedLat = kalmanUpdate(latFilter, point.lat, accuracy);
  const smoothedLng = kalmanUpdate(lngFilter, point.lng, accuracy);

  return {
    ...point,
    smoothedLat,
    smoothedLng,
  };
};
