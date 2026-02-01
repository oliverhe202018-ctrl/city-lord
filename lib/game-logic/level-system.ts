
export const LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, title: 'Wanderer' },
  { level: 6, minXp: 2001, title: 'Citizen' },
  { level: 16, minXp: 10001, title: 'Knight' },
  { level: 31, minXp: 50001, title: 'Baron' },
  { level: 51, minXp: 150001, title: 'Count' },
  { level: 71, minXp: 400001, title: 'Duke' },
  { level: 100, minXp: 1000001, title: 'City Lord' },
];

export function calculateLevel(xp: number): number {
  // Simple linear search as the array is small
  // We want the highest level where xp >= minXp
  // However, the levels are ranges (1-5, 6-15, etc.)
  // We need to interpolate or just return the base level of the tier?
  // The user spec says "Lv 1-5 (Wanderer): 0 - 2,000 XP".
  // This implies sub-levels exist within the tier.
  // Let's assume a linear progression within tiers or just return the base level for now if formula isn't specified.
  // Actually, the spec gives ranges for tiers. It doesn't give the formula for individual levels (e.g. Lv 2, Lv 3).
  // I will assume the level is determined by the tier for now, OR I'll make a best-guess formula.
  // "Lv 1-5 ... 0 - 2000". That's 2000 XP for 5 levels = 400 XP per level?
  // "Lv 6-15 ... 2001 - 10000". That's 8000 XP for 10 levels = 800 XP per level.
  // This seems like a reasonable interpolation.
  
  if (xp >= 1000001) return 100;

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    const tier = LEVEL_THRESHOLDS[i];
    if (xp >= tier.minXp) {
      // Found the tier. Now calculate specific level within tier.
      const nextTier = LEVEL_THRESHOLDS[i + 1];
      const maxLevelInTier = nextTier ? nextTier.level - 1 : 100;
      const xpRange = (nextTier ? nextTier.minXp : 1000001) - tier.minXp;
      const levelRange = maxLevelInTier - tier.level + 1;
      
      const xpPerLevel = xpRange / levelRange;
      const xpInTier = xp - tier.minXp;
      const levelsGained = Math.floor(xpInTier / xpPerLevel);
      
      return tier.level + levelsGained;
    }
  }
  return 1;
}

export function getTitle(level: number): string {
  if (level >= 100) return 'City Lord';
  if (level >= 71) return 'Duke';
  if (level >= 51) return 'Count';
  if (level >= 31) return 'Baron';
  if (level >= 16) return 'Knight';
  if (level >= 6) return 'Citizen';
  return 'Wanderer';
}

export function getNextLevelProgress(xp: number): { percent: number; current: number; next: number } {
  const currentLevel = calculateLevel(xp);
  
  // Find current tier boundaries
  // But wait, we need the boundary for the *current level*, not just the tier.
  // Re-using the logic from calculateLevel is tricky if we don't expose the per-level thresholds.
  
  // Let's define a helper to get XP requirement for a specific level.
  // Since we interpolated above, we should map back.
  
  // Alternative: Just return progress to next TIER? No, user usually wants progress to next LEVEL.
  // Let's stick to the tiers for simplicity if fine-grained levels aren't strictly defined,
  // BUT the user asked for "Level 1-5", so presumably Level 2 exists.
  
  // Let's simplify: 
  // Wanderer (1-5): 2000 XP / 5 = 400 per level.
  // Citizen (6-15): 8000 XP / 10 = 800 per level.
  // Knight (16-30): 40000 XP / 15 = 2666 per level.
  // Baron (31-50): 100000 XP / 20 = 5000 per level.
  // Count (51-70): 250000 XP / 20 = 12500 per level.
  // Duke (71-99): 600000 XP / 29 = 20689 per level.
  
  let levelBaseXp = 0;
  let xpPerLevel = 400;
  let baseLevel = 1;
  
  if (currentLevel >= 100) return { percent: 100, current: xp, next: xp };
  
  if (currentLevel >= 71) {
    levelBaseXp = 400001;
    xpPerLevel = (1000000 - 400001) / 29;
    baseLevel = 71;
  } else if (currentLevel >= 51) {
    levelBaseXp = 150001;
    xpPerLevel = (400000 - 150001) / 20;
    baseLevel = 51;
  } else if (currentLevel >= 31) {
    levelBaseXp = 50001;
    xpPerLevel = (150000 - 50001) / 20;
    baseLevel = 31;
  } else if (currentLevel >= 16) {
    levelBaseXp = 10001;
    xpPerLevel = (50000 - 10001) / 15;
    baseLevel = 16;
  } else if (currentLevel >= 6) {
    levelBaseXp = 2001;
    xpPerLevel = (10000 - 2001) / 10;
    baseLevel = 6;
  } else {
    levelBaseXp = 0;
    xpPerLevel = 2000 / 5;
    baseLevel = 1;
  }
  
  const levelsIntoTier = currentLevel - baseLevel;
  const currentLevelStartXp = levelBaseXp + (levelsIntoTier * xpPerLevel);
  const nextLevelStartXp = currentLevelStartXp + xpPerLevel;
  
  const progress = xp - currentLevelStartXp;
  const needed = nextLevelStartXp - currentLevelStartXp;
  
  return {
    percent: Math.min(100, Math.max(0, (progress / needed) * 100)),
    current: Math.floor(progress),
    next: Math.floor(needed)
  };
}
