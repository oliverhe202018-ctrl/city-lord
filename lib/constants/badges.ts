/**
 * Badge System Constants
 *
 * Centralizes all badge target values that were previously hardcoded
 * in badge-conditions.ts and badge.ts. Import from here to ensure
 * a single source of truth across the badge evaluation pipeline.
 */

// ==============================================================
// Mission Badges
// ==============================================================

/** Number of missions required for 'mission-master' badge */
export const BADGE_MISSION_MASTER_TARGET = 10

// ==============================================================
// Territory Badges
// ==============================================================

/** Active territory tiles required for 'landlord' badge */
export const BADGE_LANDLORD_TARGET = 10

/** Historical total tiles captured for 'territory-raider' badge */
export const BADGE_TERRITORY_RAIDER_TARGET = 50

// ==============================================================
// Running / Fitness Badges
// ==============================================================

/** Total running distance (km) for 'shoe-killer' badge */
export const BADGE_SHOE_KILLER_KM = 500

/** Single-run distance (km) for 'marathon-god' badge */
export const BADGE_MARATHON_GOD_KM = 42

/** Single-run distance (km) for 'half-marathon' badge */
export const BADGE_HALF_MARATHON_KM = 21

/** Total running distance (km) for 'century-runner' badge */
export const BADGE_CENTURY_RUNNER_KM = 100

// ==============================================================
// Level Badges
// ==============================================================

/** Player level required for 'level-10' badge */
export const BADGE_LEVEL_10_TARGET = 10

/** Player level required for 'level-50' badge */
export const BADGE_LEVEL_50_TARGET = 50

// ==============================================================
// Aggregate export (for dynamic badge config UI in admin)
// ==============================================================

export const BADGE_TARGETS = {
  missionMaster: BADGE_MISSION_MASTER_TARGET,
  landlord: BADGE_LANDLORD_TARGET,
  territoryRaider: BADGE_TERRITORY_RAIDER_TARGET,
  shoeKillerKm: BADGE_SHOE_KILLER_KM,
  marathonGodKm: BADGE_MARATHON_GOD_KM,
  halfMarathonKm: BADGE_HALF_MARATHON_KM,
  centuryRunnerKm: BADGE_CENTURY_RUNNER_KM,
  level10: BADGE_LEVEL_10_TARGET,
  level50: BADGE_LEVEL_50_TARGET,
} as const

export type BadgeTargetKey = keyof typeof BADGE_TARGETS
