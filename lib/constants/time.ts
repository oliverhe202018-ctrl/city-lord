/**
 * 游戏时间相关常量
 * 统一管理所有时间区间定义，避免不一致
 */

// 统一夜间时间定义（22:00 - 04:00）
export const NIGHT_START_HOUR = 22  // 晚上 10 点
export const NIGHT_END_HOUR = 4     // 凌晨 4 点

// 统一早鸟时间定义（05:00 - 08:00）
export const EARLY_START_HOUR = 5   // 早上 5 点
export const EARLY_END_HOUR = 8     // 早上 8 点

// 统一黄昏时间定义（20:00 - 23:00）
export const EVENING_START_HOUR = 20  // 晚上 8 点
export const EVENING_END_HOUR = 23    // 晚上 11 点

/**
 * 检查给定时间是否在夜间
 * @param hour UTC+8 小时数 (0-23)
 * @returns boolean
 */
export function isNightTime(hour: number): boolean {
  const h = hour % 24
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR
}

/**
 * 检查给定时间是否在早鸟时段
 * @param hour UTC+8 小时数 (0-23)
 * @returns boolean
 */
export function isEarlyBirdTime(hour: number): boolean {
  const h = hour % 24
  return h >= EARLY_START_HOUR && h < EARLY_END_HOUR
}

/**
 * 检查给定时间是否在黄昏时段
 * @param hour UTC+8 小时数 (0-23)
 * @returns boolean
 */
export function isEveningTime(hour: number): boolean {
  const h = hour % 24
  return h >= EVENING_START_HOUR && h < EVENING_END_HOUR
}
