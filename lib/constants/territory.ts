/**
 * Territory System Constants
 *
 * Shared constants for the territory HP / hot zone system.
 * Imported by territory-hp-service, hotzone-service, and claimTerritory.
 *
 * H3 Resolution is defined in hex-utils.ts as H3_RESOLUTION = 9.
 * The tile area below corresponds to H3 resolution 9 (~0.0001053 km²).
 */

// ============================================================
// H3 Grid
// ============================================================

/** H3 resolution used across the entire territory system.
 *  MUST match the value in lib/hex-utils.ts (H3_RESOLUTION = 9). */
export const TERRITORY_H3_RESOLUTION = 9

/** Approximate area of a single H3 resolution-9 hex tile in km² */
export const H3_TILE_AREA_KM2 = 0.0001053

// ============================================================
// Territory HP
// ============================================================

/** Maximum HP for new/reset territories */
export const MAX_TERRITORY_HP = 1000

/** Minimum damage per attack */
export const MIN_DAMAGE = 10

/** Maximum damage per attack */
export const MAX_DAMAGE = 200

/** Damage per km² of intersecting area */
export const DAMAGE_PER_KM2 = 5

/** Neutral cooldown duration after HP reaches 0 (minutes) */
export const NEUTRAL_COOLDOWN_MINUTES = 5

// ============================================================
// Hot Zone
// ============================================================

/** Minimum real owner transfers (A→B) in 7 days to qualify as hot zone */
export const HOT_ZONE_THRESHOLD = 2

/** Time window for hot zone determination (days) */
export const HOT_ZONE_WINDOW_DAYS = 7

// ============================================================
// Scoring
// ============================================================

/** Base score per km² of territory */
export const BASE_SCORE_PER_KM2 = 1000

/** Score multiplier for capturing a hot zone (reduced — contested territory) */
export const HOT_ZONE_CAPTURE_MULTIPLIER = 0.5

/** Score multiplier for capturing a normal zone */
export const NORMAL_CAPTURE_MULTIPLIER = 1.0

/** Penalty ratio when losing a territory (applied to original score) */
export const LOSS_PENALTY_RATIO = 0.5

// ============================================================
// Run Settlement
// ============================================================

/** Maximum number of enemy territories attacked per single run settlement.
 *  Prevents abuse from extremely long runs or GPS spoofing. */
export const MAX_ATTACKS_PER_RUN = 50

/** User-facing message when attack count is truncated */
export const ATTACK_TRUNCATED_MESSAGE =
    '本次结算超过最大攻占领地数（50个），剩余部分已被截断'

// ============================================================
// Performance Advisory
// ============================================================
// Hot zone detection queries territory_owner_change_logs with index
// idx_ocl_territory_time (territory_id, changed_at DESC).
// For high-traffic deployments, consider:
//   1. Redis cache for hot zone status (TTL 5-10 min)
//   2. Materialized view refreshed by decay_territories_daily()
//   3. Date-based partitioning on owner_change_logs if table > 1M rows
