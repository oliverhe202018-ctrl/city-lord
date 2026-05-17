import { getDistanceFromLatLonInMeters } from '@/lib/geometry-utils';

export interface SpeedValidationResult {
  accept: boolean;
  flag?: string;
  speedMs: number;
}

const SUSPICIOUS_CYCLING_THRESHOLD = 8;
const HARD_SPEED_EXCEEDED_THRESHOLD = 12;

export function validateSegmentSpeed(
  prevLat: number,
  prevLng: number,
  prevTimestamp: number,
  newLat: number,
  newLng: number,
  newTimestamp: number
): SpeedValidationResult {
  const distanceM = getDistanceFromLatLonInMeters(prevLat, prevLng, newLat, newLng);
  const timeDiffS = Math.max(0.1, (newTimestamp - prevTimestamp) / 1000);
  const speedMs = distanceM / timeDiffS;

  if (speedMs > HARD_SPEED_EXCEEDED_THRESHOLD) {
    return { accept: false, flag: 'HARD_SPEED_EXCEEDED', speedMs };
  }

  if (speedMs > SUSPICIOUS_CYCLING_THRESHOLD) {
    return { accept: true, flag: 'SUSPICIOUS_CYCLING', speedMs };
  }

  return { accept: true, speedMs };
}
