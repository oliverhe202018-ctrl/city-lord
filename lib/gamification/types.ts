
export type EventType = 'TREASURE' | 'AMBUSH' | 'MYSTERY' | 'BLESSING';

/**
 * Defines the deterministic reward payload for a gamification event.
 * This structure ensures that the outcome of an event is pre-calculated and stored,
 * preventing inconsistencies and allowing for easy replay or verification.
 */
export interface EventRewardPayload {
  points?: number;
  levelXp?: number;
  areaMultiplier?: number;
  staminaBoost?: number;
  temporaryShield?: {
    duration_minutes: number;
  };
  ambush?: {
    health_reduction_percent: number;
  };
  mysteryBonus?: {
    pointsMultiplier: number; // 随机双倍倍数: 1.0-3.0
    coinsBonus: number; // 额外金币
  };
}

/**
 * Provides the context of a user's run when evaluating an event's outcome.
 * This data is used by the rules engine to apply rewards or penalties correctly.
 */
export interface RunRewardContext {
  userId: string;
  runId: string;
  totalAreaGained: number;
  totalDistance: number;
}

/**
 * The central context object for a post-run gamification pipeline.
 * It holds all necessary data for reward resolution, task evaluation, and leveling.
 */
export interface RunContext {
  userId: string;
  runId: string;
  totalAreaGained: number;
  totalDistance: number;
  triggeredEventIds: string[];
  leveledUp?: boolean;
  newLevel?: number;
}
