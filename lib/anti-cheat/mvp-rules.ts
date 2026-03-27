/**
 * P0 Anti-Cheat MVP Rules Engine
 * 
 * Physical and Spatio-temporal validation for exercise settlement.
 */

export interface RunLegitimacyData {
  distanceKm: number;
  durationSeconds: number;
  pathPointsCount: number;
}

export interface LegitimacyResult {
  isValid: boolean;
  reason?: 'SPEED_TOO_FAST' | 'FAKE_TRAJECTORY' | 'DISTANCE_TOO_SHORT';
}

/**
 * Validates the legitimacy of a run based on physical limits and trajectory density.
 * 
 * @param data - The run data to validate
 * @returns Validation result
 */
export function validateRunLegitimacy(data: RunLegitimacyData): LegitimacyResult {
  const { distanceKm, durationSeconds, pathPointsCount } = data;

  // 1. Pre-computation Safety Check
  // If the distance is too short (e.g., < 50m), we don't apply these rules 
  // as they might produce extreme values or division by zero.
  if (distanceKm < 0.05) {
    return { isValid: false, reason: 'DISTANCE_TOO_SHORT' };
  }

  // 2. Rule 1: Speed Limit Check (Average Pace)
  // Kipchoge's marathon pace is ~172 s/km (2:52/km).
  // 150 s/km (2:30/km) is 24 km/h, which is the physical limit for sustained running.
  const paceSecondsPerKm = durationSeconds / distanceKm;
  if (paceSecondsPerKm < 150) {
    return {
      isValid: false,
      reason: 'SPEED_TOO_FAST'
    };
  }

  // 3. Rule 3: Trajectory Density Check
  // Real runs should have a dense set of GPS points. 
  // If points are too sparse, it likely suggests a manually faked straight-line path.
  const density = pathPointsCount / distanceKm;
  if (density < 10) {
    return {
      isValid: false,
      reason: 'FAKE_TRAJECTORY'
    };
  }

  // All P0 rules passed
  return { isValid: true };
}
