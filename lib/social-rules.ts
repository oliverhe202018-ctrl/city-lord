/**
 * Social Score Rules Configuration
 *
 * Single source of truth for all social scoring actions,
 * their point values, and daily rate limits.
 *
 * Actions without a `dailyLimit` are unlimited.
 */

// ─── Action Types ─────────────────────────────────────────────────────────────

export type SocialActionType =
  | 'LIKE_POST'
  | 'COMMENT'
  | 'SHARE_RUN'
  | 'CHALLENGE_ACCEPTED'
  | 'CHALLENGE_WON';

// ─── Rule Definition ──────────────────────────────────────────────────────────

export interface SocialRule {
  /** Points awarded per occurrence */
  points: number;
  /** Maximum times this action can earn points per day. `undefined` = unlimited */
  dailyLimit?: number;
  /** Human-readable label (for admin/debug UIs) */
  label: string;
  /**
   * Whether this action requires a `targetId` for dedup.
   * e.g. LIKE_POST needs a post ID to prevent double-liking.
   */
  requiresTargetDedup: boolean;
}

// ─── Rules Dictionary ─────────────────────────────────────────────────────────

export const SOCIAL_RULES: Record<SocialActionType, SocialRule> = {
  LIKE_POST: {
    points: 1,
    dailyLimit: 5,
    label: '点赞动态',
    requiresTargetDedup: true,
  },
  COMMENT: {
    points: 2,
    dailyLimit: 5,
    label: '评论',
    requiresTargetDedup: false, // A user can comment on the same post multiple times
  },
  SHARE_RUN: {
    points: 5,
    dailyLimit: 2,
    label: '分享跑步记录',
    requiresTargetDedup: true, // Cannot share the same run twice
  },
  CHALLENGE_ACCEPTED: {
    points: 5,
    dailyLimit: undefined, // unlimited
    label: '接受挑战',
    requiresTargetDedup: true, // One accept per challenge
  },
  CHALLENGE_WON: {
    points: 10,
    dailyLimit: undefined, // unlimited
    label: '赢得挑战',
    requiresTargetDedup: true, // One win per challenge
  },
} as const;
