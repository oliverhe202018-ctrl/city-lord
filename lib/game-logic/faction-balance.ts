
/**
 * Calculates the bonus percentage for the minority faction.
 * Logic: The bonus increases as the population difference increases.
 * Max bonus is 200%.
 * 
 * Formula: ((Majority / Minority) - 1) * 100
 * Example: 
 * - 100 vs 100 -> 0%
 * - 200 vs 100 -> 100%
 * - 300 vs 100 -> 200% (Max)
 * - 400 vs 100 -> 200% (Capped)
 */
export function calculateFactionBonus(redCount: number, blueCount: number) {
  if (redCount === 0 && blueCount === 0) return { RED: 0, BLUE: 0 };
  
  // Avoid division by zero
  const safeRed = Math.max(redCount, 1);
  const safeBlue = Math.max(blueCount, 1);

  let redBonus = 0;
  let blueBonus = 0;

  if (safeRed > safeBlue) {
    // Blue is minority
    const ratio = safeRed / safeBlue;
    blueBonus = Math.min(200, Math.floor((ratio - 1) * 100));
  } else if (safeBlue > safeRed) {
    // Red is minority
    const ratio = safeBlue / safeRed;
    redBonus = Math.min(200, Math.floor((ratio - 1) * 100));
  }

  return {
    RED: redBonus,
    BLUE: blueBonus
  };
}
