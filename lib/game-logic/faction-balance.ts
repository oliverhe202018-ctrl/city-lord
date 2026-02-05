
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

  const total = safeRed + safeBlue;

  if (safeRed > safeBlue) {
    // Blue is minority (Underdog)
    const gap = (safeRed - safeBlue) / total; 
    
    if (gap >= 0.8) blueBonus = 200;
    else if (gap >= 0.6) blueBonus = 150;
    else if (gap >= 0.4) blueBonus = 100;
    else if (gap >= 0.2) blueBonus = 50;
    else blueBonus = 0;

  } else if (safeBlue > safeRed) {
    // Red is minority (Underdog)
    const gap = (safeBlue - safeRed) / total;

    if (gap >= 0.8) redBonus = 200;
    else if (gap >= 0.6) redBonus = 150;
    else if (gap >= 0.4) redBonus = 100;
    else if (gap >= 0.2) redBonus = 50;
    else redBonus = 0;
  }

  return {
    RED: redBonus,
    BLUE: blueBonus
  };
}
