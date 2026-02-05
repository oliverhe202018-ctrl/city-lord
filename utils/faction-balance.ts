export interface BalanceResult {
  underdog: 'red' | 'blue' | null
  multiplier: number
  diffRatio: number
}

/**
 * Calculates the dynamic bonus multiplier based on faction population difference.
 * 
 * Rules:
 * - Difference >= 80% -> 4.0x
 * - Difference >= 60% -> 3.0x
 * - Difference >= 40% -> 2.0x
 * - Difference >= 20% -> 1.5x
 * - Difference < 20%  -> 1.0x
 * 
 * @param redCount Total population of Red faction
 * @param blueCount Total population of Blue faction
 * @param isEnabled Whether the auto-balance system is enabled (default: true)
 */
export function calculateFactionBalance(
  redCount: number, 
  blueCount: number, 
  isEnabled: boolean = true
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

  if (diffRatio >= 0.80) {
    multiplier = 3.0
  } else if (diffRatio >= 0.60) {
    multiplier = 2.5
  } else if (diffRatio >= 0.40) {
    multiplier = 2.0
  } else if (diffRatio >= 0.20) {
    multiplier = 1.5
  }

  // If multiplier is 1.0, effectively there is no underdog advantage
  const finalUnderdog = multiplier > 1.0 ? underdog : null

  return {
    underdog: finalUnderdog,
    multiplier,
    diffRatio
  }
}
