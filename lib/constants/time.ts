/**
 * Time Constants
 *
 * Unified time window definitions for the game economy system.
 * Replaces all inline hardcoded hour values scattered across
 * badge-conditions.ts, badge.ts, and event-spawner.ts.
 *
 * All values are in UTC+8 (Beijing Time) hours (0-23).
 */

// ==============================================================
// Night Window  🌙  22:00 - 04:00
// ==============================================================

/** Night period start hour (UTC+8). Inclusive. */
export const NIGHT_START_HOUR = 22

/** Night period end hour (UTC+8). Exclusive — i.e. ends before 04:00. */
export const NIGHT_END_HOUR = 4

// ==============================================================
// Evening Window  🌆  20:00 - 23:00
// ==============================================================

/** Evening period start hour (UTC+8). Inclusive. */
export const EVENING_START_HOUR = 20

/** Evening period end hour (UTC+8). Exclusive. */
export const EVENING_END_HOUR = 23

// ==============================================================
// Early Bird Window  🌅  05:00 - 08:00
// ==============================================================

/** Early-bird period start hour (UTC+8). Inclusive. */
export const EARLY_BIRD_START_HOUR = 5

/** Early-bird period end hour (UTC+8). Exclusive. */
export const EARLY_BIRD_END_HOUR = 8

// ==============================================================
// Utility helpers
// ==============================================================

/**
 * Returns the current hour in UTC+8.
 * Replaces the inline `getHourUTC8` helper that was previously
 * duplicated in badge-conditions.ts and badge.ts.
 */
export function getHourUTC8(dateValue: Date | string | number = new Date()): number {
  const d = new Date(dateValue)
  return (d.getUTCHours() + 8) % 24
}

/**
 * Returns true if the given UTC+8 hour falls within the night window.
 * Night spans midnight, so the check must handle the wrap-around.
 */
export function isNightHour(hourUTC8: number): boolean {
  return hourUTC8 >= NIGHT_START_HOUR || hourUTC8 < NIGHT_END_HOUR
}

/** Returns true if the given UTC+8 hour falls within the evening window. */
export function isEveningHour(hourUTC8: number): boolean {
  return hourUTC8 >= EVENING_START_HOUR && hourUTC8 < EVENING_END_HOUR
}

/** Returns true if the given UTC+8 hour falls within the early-bird window. */
export function isEarlyBirdHour(hourUTC8: number): boolean {
  return hourUTC8 >= EARLY_BIRD_START_HOUR && hourUTC8 < EARLY_BIRD_END_HOUR
}
