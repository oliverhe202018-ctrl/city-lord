/**
 * 1v1 Challenge System — Core Type Definitions
 *
 * These types define the challenge lifecycle:
 *   PENDING → ACCEPTED → COMPLETED
 *                      → EXPIRED (via cron/on-read)
 *          → DECLINED
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

/** The metric being competed on */
export type ChallengeType = 'DISTANCE' | 'HEXES' | 'PACE';

/** Lifecycle status of a challenge */
export type ChallengeStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'EXPIRED';

// ─── Database Row ─────────────────────────────────────────────────────────────

/** Maps 1:1 to the `challenges` table in Supabase */
export interface Challenge {
  id: string;

  /** User who initiated the challenge */
  challenger_id: string;
  /** User who was challenged */
  target_id: string;

  /** What metric is being competed on */
  type: ChallengeType;
  /**
   * The goal value to reach.
   * - DISTANCE → meters (e.g. 5000 = 5km)
   * - HEXES    → number of hexes
   * - PACE     → seconds/km (lower = faster, the competitor with lower pace wins)
   */
  target_value: number;

  /** ISO timestamp — when the challenge must be completed by (null = 24h from acceptance) */
  deadline: string | null;

  /** Current lifecycle status */
  status: ChallengeStatus;

  /** Accumulated progress of the challenger */
  challenger_progress: number;
  /** Accumulated progress of the target */
  target_progress: number;

  /** Set when status transitions to COMPLETED */
  winner_id: string | null;

  /** XP reward for the winner */
  reward_xp: number;

  /** When the challenge was created (PENDING) */
  created_at: string;
  /** When the challenge was accepted (status → ACCEPTED) */
  accepted_at: string | null;
  /** When the challenge was resolved (COMPLETED / DECLINED / EXPIRED) */
  resolved_at: string | null;
}

// ─── API / UI DTOs ────────────────────────────────────────────────────────────

/** Lightweight profile info joined from the profiles table */
export interface ChallengeParticipant {
  id: string;
  nickname: string;
  avatar_url: string | null;
  level: number;
}

/** Challenge row enriched with participant profiles — used by getActiveChallenges */
export interface ChallengeWithProfiles extends Challenge {
  challenger: ChallengeParticipant;
  target: ChallengeParticipant;
}

/** Payload for creating a new challenge */
export interface CreateChallengeInput {
  target_id: string;
  type: ChallengeType;
  target_value: number;
  /** Optional custom deadline in hours (defaults to 24) */
  deadline_hours?: number;
  reward_xp?: number;
}

/** Lightweight run data pushed into the progress engine after saveRun */
export interface RunProgressData {
  distance_meters: number;
  hexes_claimed: number;
  pace_seconds_per_km: number;
}
