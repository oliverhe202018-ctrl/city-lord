
// lib/game/leveling-system.ts

const LEVEL_FACTOR = 1.5;

export interface LevelUpResult {
    hasLeveledUp: boolean;
    newLevel: number;
    newXp: number;
    newMaxExp: number;
}

/**
 * Calculates level-ups based on current XP and level.
 * Can handle multiple level-ups in a single calculation.
 * @param currentXp - The user's total XP after gaining new XP.
 * @param currentLevel - The user's current level.
 * @param currentMaxExp - The XP required for the user's current level.
 * @returns A LevelUpResult object with the new state.
 */
export function calculateLevelUp(currentXp: number, currentLevel: number, currentMaxExp: number): LevelUpResult {
    let hasLeveledUp = false;
    let tempXp = currentXp;
    let tempLevel = currentLevel;
    let tempMaxExp = currentMaxExp;

    while (tempXp >= tempMaxExp) {
        hasLeveledUp = true;
        tempXp -= tempMaxExp;
        tempLevel++;
        tempMaxExp = Math.floor(tempMaxExp * LEVEL_FACTOR);
    }

    return {
        hasLeveledUp,
        newLevel: tempLevel,
        newXp: tempXp,
        newMaxExp: tempMaxExp,
    };
}
