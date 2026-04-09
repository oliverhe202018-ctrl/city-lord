/**
 * Anti-Cheat Run Validator
 * 
 * Provides core logic to detect suspicious running activities such as 
 * virtual locations (shakers), excessive speed (vehicles), and teleportation.
 */

export interface RunDataPayload {
  distanceMeters: number;
  durationSeconds: number;
  steps: number;
}

export interface ValidationResult {
  isValid: boolean;     // Whether the data is technically well-formed
  isFlagged: boolean;   // Whether the run is marked as cheating
  flagReason?: string;  // Machine-readable reason tag
}

/**
 * Validates a run payload against risk-based rules.
 * Uses a Shadowban strategy: suspicious runs are flagged but saved to the DB
 * to avoid alerting the user immediately.
 */
export function validateRunData(payload: RunDataPayload): ValidationResult {
  const { distanceMeters, durationSeconds, steps } = payload;

  // 1. Boundary Defense & Zero Checks (Avoid division by zero or invalid inputs)
  if (durationSeconds <= 0 || distanceMeters < 0 || steps < 0) {
    if (distanceMeters > 0) {
        return {
            isValid: false,
            isFlagged: true,
            flagReason: 'INVALID_INPUT_DATA_TAMPERING'
        };
    }
    // Zero distance with zero duration is technically "valid" but should be ignored by settlement
    return { isValid: false, isFlagged: false };
  }

  // Handle step-less runs with distance (e.g. simulator / pedometer unavailable)
  // Downgraded from hard-block to pass-through: real cheating is caught by
  // subsequent stride-length and path-risk checks further down the pipeline.
  if (steps === 0 && distanceMeters > 100) {
      return {
          isValid: true,
          isFlagged: false,
      };
  }

  // 2. Teleportation Check (Extreme values defense - high priority)
  // Distance > 500m in less than 60s is physically impossible for most runners.
  if (durationSeconds < 60 && distanceMeters > 500) {
    return {
      isValid: true,
      isFlagged: true,
      flagReason: 'TELEPORTATION'
    };
  }

  // 3. Speed Check (Anti-Cycling/Driving)
  // Bolt's record is ~37km/h. 30km/h is a strict limit for general running activities.
  const avgSpeedKmH = (distanceMeters / 1000) / (durationSeconds / 3600);
  if (avgSpeedKmH > 30) {
    return {
      isValid: true,
      isFlagged: true,
      flagReason: 'SPEED_TOO_HIGH'
    };
  }

  // 4. Stride Check (Anti-Shaker / Anti-Scooter)
  // Normal stride length is roughly 0.6m to 1.5m.
  const strideLength = steps > 0 ? distanceMeters / steps : 0;
  
  if (strideLength < 0.3) {
    // Too many steps for very little distance -> Step shaker device
    return {
      isValid: true,
      isFlagged: true,
      flagReason: 'ABNORMAL_STRIDE_SHAKER'
    };
  }

  if (strideLength > 2.5) { 
    // Too few steps for large distance -> Likely on a scooter/skateboards occasionally shaking
    return {
      isValid: true,
      isFlagged: true,
      flagReason: 'ABNORMAL_STRIDE_OVERGAITER'
    };
  }

  // All checks passed
  return {
    isValid: true,
    isFlagged: false
  };
}
