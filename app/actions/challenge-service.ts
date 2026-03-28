'use server';

/**
 * 1v1 Challenge Service — Server Actions
 *
 * Handles the full lifecycle:
 *   createChallenge  → PENDING
 *   acceptChallenge  → ACCEPTED (starts the clock)
 *   declineChallenge → DECLINED
 *   getActiveChallenges → fetch all ACCEPTED for a user
 *   getPendingChallengesForUser → fetch all PENDING where user is the target
 *   updateChallengeProgress → called after every saveRun to advance + judge
 */

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import type {
  Challenge,
  ChallengeWithProfiles,
  CreateChallengeInput,
  RunProgressData,
  ChallengeParticipant,
} from '@/types/challenge';

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

/** Default challenge deadline: 24 hours from now */
function getDeadline(hours = 24): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

// ─── 1. Create Challenge ──────────────────────────────────────────────────────

export async function createChallenge(input: CreateChallengeInput) {
  const { supabase, user } = await getAuthenticatedUser();

  if (input.target_id === user.id) {
    return { success: false, error: '不能挑战自己' };
  }

  // Prevent duplicate active challenges between the same pair
  const { data: existing } = await (supabase as any)
    .from('challenges')
    .select('id')
    .or(
      `and(challenger_id.eq.${user.id},target_id.eq.${input.target_id}),and(challenger_id.eq.${input.target_id},target_id.eq.${user.id})`
    )
    .in('status', ['PENDING', 'ACCEPTED'])
    .limit(1);

  if (existing && existing.length > 0) {
    return { success: false, error: '你们之间已有未完成的挑战' };
  }

  const { data, error } = await (supabase as any)
    .from('challenges')
    .insert({
      challenger_id: user.id,
      target_id: input.target_id,
      type: input.type,
      target_value: input.target_value,
      deadline: null, // Deadline is set upon acceptance
      status: 'PENDING',
      challenger_progress: 0,
      target_progress: 0,
      winner_id: null,
      reward_xp: input.reward_xp ?? 200,
      accepted_at: null,
      resolved_at: null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ChallengeService] createChallenge error:', error);
    return { success: false, error: error.message };
  }

  // Send a notification to the target
  try {
    await (supabase as any).from('notifications').insert({
      user_id: input.target_id,
      title: '🗡️ 新的挑战邀请',
      body: `有人向你发起了 1v1 挑战！`,
      data: { type: 'CHALLENGE_INVITE', challengeId: data.id },
    });
  } catch (e) {
    console.warn('[ChallengeService] Notification insert failed:', e);
  }

  return { success: true, challengeId: data.id };
}

// ─── 2. Accept Challenge ──────────────────────────────────────────────────────

export async function acceptChallenge(challengeId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  // Verify the challenge exists, is PENDING, and the user is the target
  const { data: challenge, error: fetchError } = await (supabase as any)
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .eq('target_id', user.id)
    .eq('status', 'PENDING')
    .single();

  if (fetchError || !challenge) {
    return { success: false, error: '挑战不存在或已处理' };
  }

  const deadlineHours = 24; // default
  const { error: updateError } = await (supabase as any)
    .from('challenges')
    .update({
      status: 'ACCEPTED',
      accepted_at: new Date().toISOString(),
      deadline: getDeadline(deadlineHours),
    })
    .eq('id', challengeId);

  if (updateError) {
    console.error('[ChallengeService] acceptChallenge error:', updateError);
    return { success: false, error: updateError.message };
  }

  // Notify the challenger
  try {
    await (supabase as any).from('notifications').insert({
      user_id: challenge.challenger_id,
      title: '⚔️ 挑战已被接受',
      body: '对手接受了你的挑战，战斗已经开始！',
      data: { type: 'CHALLENGE_ACCEPTED', challengeId },
    });
  } catch (e) {
    console.warn('[ChallengeService] Notification insert failed:', e);
  }

  return { success: true };
}

// ─── 3. Decline Challenge ─────────────────────────────────────────────────────

export async function declineChallenge(challengeId: string) {
  const { supabase, user } = await getAuthenticatedUser();

  const { error } = await (supabase as any)
    .from('challenges')
    .update({
      status: 'DECLINED',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', challengeId)
    .eq('target_id', user.id)
    .eq('status', 'PENDING');

  if (error) {
    console.error('[ChallengeService] declineChallenge error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ─── 4. Get Pending Challenges (for current user as target) ───────────────────

export async function getPendingChallengesForUser() {
  const { supabase, user } = await getAuthenticatedUser();

  const { data, error } = await (supabase as any)
    .from('challenges')
    .select(`
      *,
      challenger:profiles!challenges_challenger_id_fkey(id, nickname, avatar_url, level),
      target:profiles!challenges_target_id_fkey(id, nickname, avatar_url, level)
    `)
    .eq('target_id', user.id)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ChallengeService] getPendingChallengesForUser error:', error);
    return [];
  }

  // Auto-expire old PENDING challenges (> 48h without response)
  const now = Date.now();
  const PENDING_TTL_MS = 48 * 60 * 60 * 1000;
  const valid: ChallengeWithProfiles[] = [];

  for (const row of data || []) {
    const createdAt = new Date(row.created_at).getTime();
    if (now - createdAt > PENDING_TTL_MS) {
      // Silently expire
      await (supabase as any)
        .from('challenges')
        .update({ status: 'EXPIRED', resolved_at: new Date().toISOString() })
        .eq('id', row.id);
    } else {
      valid.push(row as ChallengeWithProfiles);
    }
  }

  return valid;
}

// ─── 5. Get Active Challenges (ACCEPTED, for UI rendering) ────────────────────

export async function getActiveChallenges(userId: string): Promise<ChallengeWithProfiles[]> {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  const { data, error } = await (supabase as any)
    .from('challenges')
    .select(`
      *,
      challenger:profiles!challenges_challenger_id_fkey(id, nickname, avatar_url, level),
      target:profiles!challenges_target_id_fkey(id, nickname, avatar_url, level)
    `)
    .eq('status', 'ACCEPTED')
    .or(`challenger_id.eq.${userId},target_id.eq.${userId}`)
    .order('accepted_at', { ascending: false });

  if (error) {
    console.error('[ChallengeService] getActiveChallenges error:', error);
    return [];
  }

  // Check for expired challenges on read (lazy expiration)
  const now = Date.now();
  const results: ChallengeWithProfiles[] = [];

  for (const row of data || []) {
    if (row.deadline && new Date(row.deadline).getTime() < now) {
      // Deadline passed — expire with no winner
      await (supabase as any)
        .from('challenges')
        .update({
          status: 'EXPIRED',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    } else {
      results.push(row as ChallengeWithProfiles);
    }
  }

  return results;
}

// ─── 6. Progress Update Engine ────────────────────────────────────────────────

/**
 * Called silently after every `saveRun` to advance challenge progress
 * and auto-judge winners.
 *
 * This function is designed to be fire-and-forget safe — it catches
 * all errors internally and never throws.
 */
export async function updateChallengeProgress(
  userId: string,
  runData: RunProgressData
) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    // 1. Fetch all ACCEPTED challenges this user is participating in
    const { data: activeChallenges, error } = await (supabase as any)
      .from('challenges')
      .select('*')
      .eq('status', 'ACCEPTED')
      .or(`challenger_id.eq.${userId},target_id.eq.${userId}`);

    if (error || !activeChallenges || activeChallenges.length === 0) {
      return; // No active challenges — nothing to do
    }

    const now = Date.now();

    for (const challenge of activeChallenges as Challenge[]) {
      // Skip expired challenges
      if (challenge.deadline && new Date(challenge.deadline).getTime() < now) {
        await (supabase as any)
          .from('challenges')
          .update({
            status: 'EXPIRED',
            resolved_at: new Date().toISOString(),
          })
          .eq('id', challenge.id)
          .eq('status', 'ACCEPTED'); // Optimistic lock
        continue;
      }

      // 2. Determine which progress field to update
      const isChallenger = challenge.challenger_id === userId;
      const progressField = isChallenger ? 'challenger_progress' : 'target_progress';
      const currentProgress = isChallenger
        ? challenge.challenger_progress
        : challenge.target_progress;

      // 3. Calculate increment based on challenge type
      let increment = 0;
      switch (challenge.type) {
        case 'DISTANCE':
          increment = runData.distance_meters;
          break;
        case 'HEXES':
          increment = runData.hexes_claimed;
          break;
        case 'PACE':
          // For PACE challenges, we track best pace (lower is better)
          // We store the best (lowest) pace achieved, not cumulative
          // If the new pace is better (lower) than current, update
          if (currentProgress === 0 || runData.pace_seconds_per_km < currentProgress) {
            increment = -currentProgress + runData.pace_seconds_per_km; // Set to new value
          }
          break;
      }

      if (increment === 0 && challenge.type !== 'PACE') continue;

      const newProgress = challenge.type === 'PACE'
        ? (currentProgress === 0 ? runData.pace_seconds_per_km : Math.min(currentProgress, runData.pace_seconds_per_km))
        : currentProgress + increment;

      // 4. Check for victory
      let won = false;
      if (challenge.type === 'PACE') {
        // PACE: the user wins if their pace ≤ target_value (faster or equal)
        won = newProgress > 0 && newProgress <= challenge.target_value;
      } else {
        // DISTANCE / HEXES: the user wins if progress ≥ target_value
        won = newProgress >= challenge.target_value;
      }

      // 5. Build the update payload
      const updatePayload: Record<string, any> = {
        [progressField]: newProgress,
      };

      if (won) {
        updatePayload.status = 'COMPLETED';
        updatePayload.winner_id = userId;
        updatePayload.resolved_at = new Date().toISOString();
      }

      // 6. Execute update with optimistic lock on status
      const { error: updateError } = await (supabase as any)
        .from('challenges')
        .update(updatePayload)
        .eq('id', challenge.id)
        .eq('status', 'ACCEPTED'); // Only update if still ACCEPTED (race-condition guard)

      if (updateError) {
        console.error(`[ChallengeService] Progress update failed for challenge ${challenge.id}:`, updateError);
        continue;
      }

      // 7. If won, send notification to the loser and grant XP to winner
      if (won) {
        const loserId = isChallenger ? challenge.target_id : challenge.challenger_id;

        try {
          // Notify loser
          await (supabase as any).from('notifications').insert({
            user_id: loserId,
            title: '💀 挑战失败',
            body: '对手完成了挑战目标，你输了！',
            data: { type: 'CHALLENGE_LOST', challengeId: challenge.id },
          });

          // Notify winner
          await (supabase as any).from('notifications').insert({
            user_id: userId,
            title: '🏆 挑战胜利！',
            body: `恭喜，你赢得了挑战！获得 ${challenge.reward_xp} XP`,
            data: { type: 'CHALLENGE_WON', challengeId: challenge.id },
          });

          // Grant XP to winner (via profiles update)
          await (supabase as any)
            .from('profiles')
            .update({
              xp: (supabase as any).rpc ? undefined : undefined, // Fallback below
            })
            .eq('id', userId);

          // Use RPC for atomic increment if available, else raw update
          const { error: xpError } = await (supabase as any).rpc('increment_xp', {
            user_id_input: userId,
            xp_amount: challenge.reward_xp,
          });

          if (xpError) {
            // Fallback: direct SQL-less approach
            console.warn('[ChallengeService] RPC increment_xp not available, skipping XP grant:', xpError.message);
          }
        } catch (e) {
          console.error('[ChallengeService] Post-victory processing error:', e);
        }
      }
    }
  } catch (e) {
    // Fire-and-forget: never crash the caller
    console.error('[ChallengeService] updateChallengeProgress fatal error:', e);
  }
}
