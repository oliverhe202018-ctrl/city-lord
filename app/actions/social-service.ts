'use server';

/**
 * Social Score Service — Server Actions
 *
 * Provides:
 *   awardSocialPoints  → anti-abuse scoring engine (dedup + daily cap)
 *   getSocialScoreLeaderboard → time-windowed leaderboard aggregation
 */

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { SOCIAL_RULES, type SocialActionType } from '@/lib/social-rules';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Not authenticated');
  return { supabase, user };
}

/** Returns the start of today (00:00:00) in ISO format, in UTC */
function getTodayStartUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** Returns the start of this week (Monday 00:00:00 UTC) in ISO format */
function getWeekStartUTC(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - diffToMonday,
  ));
  return monday.toISOString();
}

// ─── 1. Award Social Points (Anti-Abuse Engine) ───────────────────────────────

/**
 * Award social score points for a specific action.
 *
 * Validation pipeline:
 *   1. Target dedup  — prevents double-liking same post, etc.
 *   2. Daily cap     — prevents farming via rate-limited actions.
 *   3. Insert log    — records the successful award.
 *
 * This function is designed to be **silent on cap/dedup hits** — it never
 * throws or returns an error in those cases. The caller gets a simple
 * `{ awarded: false, reason }` so it can decide whether to show UI feedback.
 */
export async function awardSocialPoints(
  userId: string,
  actionType: SocialActionType,
  targetId?: string,
): Promise<{ awarded: boolean; points?: number; reason?: string }> {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    const rule = SOCIAL_RULES[actionType];
    if (!rule) {
      console.warn(`[SocialService] Unknown action type: ${actionType}`);
      return { awarded: false, reason: 'UNKNOWN_ACTION' };
    }

    // ── Step 1: Target dedup check ──
    // If the action requires dedup and a targetId was provided,
    // check if this exact (user, action, target) combo already exists.
    if (rule.requiresTargetDedup && targetId) {
      const { data: existing, error: dedupError } = await (supabase as any)
        .from('social_score_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('action_type', actionType)
        .eq('target_id', targetId)
        .limit(1);

      if (dedupError) {
        console.error('[SocialService] Dedup check error:', dedupError);
        return { awarded: false, reason: 'DB_ERROR' };
      }

      if (existing && existing.length > 0) {
        // Already awarded for this target — silently skip
        return { awarded: false, reason: 'DUPLICATE' };
      }
    }

    // ── Step 2: Daily limit check ──
    if (rule.dailyLimit !== undefined) {
      const todayStart = getTodayStartUTC();

      const { count, error: countError } = await (supabase as any)
        .from('social_score_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action_type', actionType)
        .gte('created_at', todayStart);

      if (countError) {
        console.error('[SocialService] Daily cap check error:', countError);
        return { awarded: false, reason: 'DB_ERROR' };
      }

      if ((count ?? 0) >= rule.dailyLimit) {
        // Daily cap reached — silently skip
        return { awarded: false, reason: 'DAILY_CAP_REACHED' };
      }
    }

    // ── Step 3: Insert log entry ──
    const { error: insertError } = await (supabase as any)
      .from('social_score_logs')
      .insert({
        user_id: userId,
        action_type: actionType,
        target_id: targetId ?? null,
        points: rule.points,
      });

    if (insertError) {
      console.error('[SocialService] Insert error:', insertError);
      return { awarded: false, reason: 'DB_ERROR' };
    }

    return { awarded: true, points: rule.points };
  } catch (error) {
    console.error('[SocialService] awardSocialPoints fatal error:', error);
    return { awarded: false, reason: 'INTERNAL_ERROR' };
  }
}

// ─── 2. Social Score Leaderboard ──────────────────────────────────────────────

export type LeaderboardTimeframe = 'WEEKLY' | 'ALL_TIME';

export interface SocialLeaderboardEntry {
  rank: number;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  level: number;
  total_points: number;
}

/**
 * Fetch the social score leaderboard.
 *
 * - `WEEKLY`   → aggregates from Monday 00:00 UTC to now
 * - `ALL_TIME` → aggregates all recorded scores
 *
 * Returns top 50 users, ordered by total points descending,
 * with joined profile data (nickname, avatar, level).
 */
export async function getSocialScoreLeaderboard(
  timeframe: LeaderboardTimeframe = 'WEEKLY',
  limit: number = 50,
): Promise<SocialLeaderboardEntry[]> {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    // ── Build the aggregation query ──
    // Supabase JS client doesn't support GROUP BY natively,
    // so we use the `.rpc()` pattern is ideal, but since the table
    // is fresh and we want zero migration friction, we'll use a
    // raw SQL query via the `rpc` endpoint with a simple function,
    // OR we can query all logs and aggregate client-side.
    //
    // Best approach: Use Supabase's PostgREST + a database function.
    // Fallback approach: Direct query with manual aggregation.
    //
    // We'll try RPC first; if it doesn't exist, fall back gracefully.

    const sinceDate = timeframe === 'WEEKLY' ? getWeekStartUTC() : null;

    // Try RPC-based aggregation (requires `get_social_leaderboard` function in DB)
    const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
      'get_social_leaderboard',
      {
        since_date: sinceDate,
        row_limit: limit,
      },
    );

    if (!rpcError && rpcData) {
      // RPC succeeded — map the result
      return (rpcData as any[]).map((row, index) => ({
        rank: index + 1,
        user_id: row.user_id,
        nickname: row.nickname || '未知跑者',
        avatar_url: row.avatar_url ?? null,
        level: row.level ?? 1,
        total_points: Number(row.total_points),
      }));
    }

    // ── Fallback: Manual aggregation via two queries ──
    console.warn(
      '[SocialService] RPC get_social_leaderboard not available, using fallback. Error:',
      rpcError?.message,
    );

    // Query 1: Get aggregated scores
    let logsQuery = (supabase as any)
      .from('social_score_logs')
      .select('user_id, points');

    if (sinceDate) {
      logsQuery = logsQuery.gte('created_at', sinceDate);
    }

    const { data: logs, error: logsError } = await logsQuery;

    if (logsError || !logs) {
      console.error('[SocialService] Leaderboard logs query error:', logsError);
      return [];
    }

    // Aggregate points by user_id in-memory
    const pointsMap = new Map<string, number>();
    for (const log of logs as { user_id: string; points: number }[]) {
      pointsMap.set(log.user_id, (pointsMap.get(log.user_id) ?? 0) + log.points);
    }

    // Sort by total points descending, take top N
    const sortedEntries = Array.from(pointsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    if (sortedEntries.length === 0) return [];

    // Query 2: Fetch profile data for the top users
    const topUserIds = sortedEntries.map(([uid]) => uid);
    const { data: profiles, error: profilesError } = await (supabase as any)
      .from('profiles')
      .select('id, nickname, avatar_url, level')
      .in('id', topUserIds);

    if (profilesError) {
      console.error('[SocialService] Profiles fetch error:', profilesError);
    }

    // Build a lookup map for profiles
    const profileMap = new Map<string, { nickname: string; avatar_url: string | null; level: number }>();
    for (const p of (profiles ?? []) as any[]) {
      profileMap.set(p.id, {
        nickname: p.nickname || '未知跑者',
        avatar_url: p.avatar_url ?? null,
        level: p.level ?? 1,
      });
    }

    // Merge and return
    return sortedEntries.map(([userId, totalPoints], index) => {
      const profile = profileMap.get(userId);
      return {
        rank: index + 1,
        user_id: userId,
        nickname: profile?.nickname || '未知跑者',
        avatar_url: profile?.avatar_url ?? null,
        level: profile?.level ?? 1,
        total_points: totalPoints,
      };
    });
  } catch (error) {
    console.error('[SocialService] getSocialScoreLeaderboard fatal error:', error);
    return [];
  }
}

// ─── 3. Get User's Social Score Summary ───────────────────────────────────────

export interface UserSocialSummary {
  totalPoints: number;
  todayPoints: number;
  /** Per-action breakdown: how many times used today vs daily cap */
  breakdown: {
    actionType: SocialActionType;
    label: string;
    todayCount: number;
    dailyLimit: number | null;
    pointsPerAction: number;
  }[];
}

/**
 * Fetch a user's social score summary including today's progress
 * against daily caps. Useful for rendering "3/5 likes used today" in UI.
 */
export async function getUserSocialSummary(userId: string): Promise<UserSocialSummary> {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    const todayStart = getTodayStartUTC();

    // Fetch all logs for this user today
    const { data: todayLogs, error: todayError } = await (supabase as any)
      .from('social_score_logs')
      .select('action_type, points')
      .eq('user_id', userId)
      .gte('created_at', todayStart);

    // Fetch all-time total
    const { data: allLogs, error: allError } = await (supabase as any)
      .from('social_score_logs')
      .select('points')
      .eq('user_id', userId);

    if (todayError || allError) {
      console.error('[SocialService] getUserSocialSummary error:', todayError || allError);
    }

    // Calculate today's count per action type
    const todayCounts = new Map<string, number>();
    let todayPoints = 0;
    for (const log of (todayLogs ?? []) as { action_type: string; points: number }[]) {
      todayCounts.set(log.action_type, (todayCounts.get(log.action_type) ?? 0) + 1);
      todayPoints += log.points;
    }

    // Calculate all-time total
    let totalPoints = 0;
    for (const log of (allLogs ?? []) as { points: number }[]) {
      totalPoints += log.points;
    }

    // Build breakdown
    const actionTypes = Object.keys(SOCIAL_RULES) as SocialActionType[];
    const breakdown = actionTypes.map((actionType) => {
      const rule = SOCIAL_RULES[actionType];
      return {
        actionType,
        label: rule.label,
        todayCount: todayCounts.get(actionType) ?? 0,
        dailyLimit: rule.dailyLimit ?? null,
        pointsPerAction: rule.points,
      };
    });

    return { totalPoints, todayPoints, breakdown };
  } catch (error) {
    console.error('[SocialService] getUserSocialSummary fatal error:', error);
    return { totalPoints: 0, todayPoints: 0, breakdown: [] };
  }
}
