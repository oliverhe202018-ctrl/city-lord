export interface BalanceResult {
  underdog: 'red' | 'blue' | null
  multiplier: number
  diffRatio: number
}

/**
 * Calculates the dynamic bonus multiplier based on faction population difference.
 * 
 * @param redCount Total population of Red faction
 * @param blueCount Total population of Blue faction
 * @param isEnabled Whether the auto-balance system is enabled (default: true)
 * @param imbalanceThreshold Configured threshold (in percentage points eg 20 for 20%) to trigger the buff
 * @param underdogMultiplier Configured multiplier to apply if triggered (eg 1.5)
 */
export function calculateFactionBalance(
  redCount: number,
  blueCount: number,
  isEnabled: boolean = true,
  imbalanceThreshold: number = 20,
  underdogMultiplier: number = 1.5
): BalanceResult {
  // If disabled or counts are invalid, return neutral state
  if (!isEnabled || redCount < 0 || blueCount < 0) {
    return { underdog: null, multiplier: 1.0, diffRatio: 0 }
  }

  const total = redCount + blueCount

  // Edge case: no users
  if (total === 0) {
    return { underdog: null, multiplier: 1.0, diffRatio: 0 }
  }

  // Edge case: equal counts
  if (redCount === blueCount) {
    return { underdog: null, multiplier: 1.0, diffRatio: 0 }
  }

  const underdog = redCount < blueCount ? 'red' : 'blue'
  const diff = Math.abs(redCount - blueCount)
  const diffRatio = diff / total

  let multiplier = 1.0

  // Apply configs if ratio crosses the threshold
  if (diffRatio >= (imbalanceThreshold / 100)) {
    multiplier = underdogMultiplier
  }

  // If multiplier is 1.0, effectively there is no underdog advantage
  const finalUnderdog = multiplier > 1.0 ? underdog : null

  return {
    underdog: finalUnderdog,
    multiplier: finalUnderdog ? multiplier : 1.0,
    diffRatio
  }
}
