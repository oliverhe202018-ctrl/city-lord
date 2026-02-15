export interface OfflineRecord {
  id?: number;
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  sequenceId: string; // UUID or unique ID for idempotency
  retryCount: number;
}
