// src/workers/gps-worker.ts

// 1D Kalman Filter 实现（分别对 lat/lng 各一个实例）
class KalmanFilter {
  private R = 3;      // 测量噪声（GPS 精度 ~3m）
  private Q = 3;      // 过程噪声
  private A = 1; 
  private B = 0; 
  private C = 1;
  private cov = NaN; 
  private x = NaN;

  filter(z: number, u = 0): number {
    if (isNaN(this.x)) { 
      this.x = (1 / this.C) * z; 
      this.cov = (1 / this.C) * this.R * (1 / this.C); 
    }
    const predX = this.A * this.x + this.B * u;
    const predCov = this.A * this.cov * this.A + this.Q;
    const K = predCov * this.C / (this.C * predCov * this.C + this.R);
    this.x = predX + K * (z - this.C * predX);
    this.cov = predCov - K * this.C * predCov;
    return this.x;
  }

  setMeasurementNoise(r: number) { 
    this.R = r; 
  }
}

const latFilter = new KalmanFilter();
const lngFilter = new KalmanFilter();

export interface LocationUpdateEvent {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  timestamp: number;
  altitude?: number;
  bearing?: number;
  coordSystem?: 'gcj02' | 'wgs84';
  locationType?: number;
  source?: string;
  isMock?: boolean;
}

self.onmessage = (e: MessageEvent<LocationUpdateEvent>) => {
  const { lat, lng, accuracy, speed, timestamp, altitude, bearing, coordSystem, locationType, source, isMock } = e.data;

  // 根据 GPS 精度动态调整滤波强度
  latFilter.setMeasurementNoise(Math.max(accuracy, 1));
  lngFilter.setMeasurementNoise(Math.max(accuracy, 1));

  const filteredLat = latFilter.filter(lat);
  const filteredLng = lngFilter.filter(lng);

  self.postMessage({ 
    lat: filteredLat, 
    lng: filteredLng, 
    accuracy, 
    speed, 
    timestamp, 
    altitude, 
    bearing, 
    coordSystem,
    locationType,
    source,
    isMock,
    raw: { lat, lng } 
  });
};
