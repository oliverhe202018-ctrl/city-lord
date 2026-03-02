'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
export type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } }

// Reward amounts (in coins)
const INVITE_REWARD_COINS = 10

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/**
 * Generate a secure, hard-to-guess invite hash.
 * Format: /invite?ref=<hex> (16 bytes = 32 hex chars)
 * Recommendation from review: use user_id + random salt, then HMAC-SHA256.
 */
function generateInviteHash(userId: string): string {
    const salt = crypto.randomBytes(8).toString('hex')
    const hash = crypto
        .createHmac('sha256', process.env.INVITE_SECRET || 'city-lord-secret')
        .update(`${userId}:${salt}`)
        .digest('hex')
        .slice(0, 32)
    return hash
}

import { isInviteExpired, canAcceptInvite } from '../utils/invitations'

// ─────────────────────────────────────────
// Action 1: Generate Invite Link
// ─────────────────────────────────────────

/**
 * Creates a new, unique invite link for the currently authenticated user.
 * Multiple links can exist for the same user (one per call).
 */
export async function generateInviteLink(): Promise<ActionResult<{ inviteLink: string }>> {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: '未登录' } }

        const hash = generateInviteHash(user.id)
        const inviteLink = `/invite?ref=${hash}`

        await prisma.friend_invitations.create({
            data: {
                inviter_user_id: user.id,
                invite_link: inviteLink,
                status: 'pending',
            },
        })

        return { ok: true, data: { inviteLink } }
    } catch (error: any) {
        console.error('[generateInviteLink] Error:', error)
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: error.message || '内部错误' } }
    }
}

// ─────────────────────────────────────────
// Action 2: Accept an Invite
// ─────────────────────────────────────────

/**
 * Called after a new user has registered via an invite link.
 * - Validates the link & prevents double-claiming.
 * - Uses a Prisma transaction to atomically:
 *    1. Mark invitation as accepted.
 *    2. Award INVITE_REWARD_COINS to both inviter and invitee.
 * Idempotent: if the invitation is already accepted, returns `alreadyAccepted: true`.
 */
export async function acceptInvite(inviteLink: string): Promise<ActionResult<{ alreadyAccepted: boolean }>> {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: '未登录' } }

        // Find the pending invitation
        const invitation = await prisma.friend_invitations.findUnique({
            where: { invite_link: inviteLink },
        })

        if (!invitation) {
            console.warn('[acceptInvite] Invalid link attempt', {
                event: 'INVITE_NOT_FOUND',
                reason: 'Link does not exist in db',
                inviteHash: inviteLink,
                inviteeUserId: user.id,
                ts: new Date().toISOString()
            })
            return { ok: false, error: { code: 'INVITE_NOT_FOUND', message: '邀请链接无效' } }
        }

        const validation = canAcceptInvite(invitation, user.id)
        if (!validation.ok) {
            // If already claimed by THIS user, we might want to return a soft success idempontently
            if (validation.error.code === 'INVITE_ALREADY_CLAIMED' && invitation.invitee_user_id === user.id) {
                return { ok: true, data: { alreadyAccepted: true } }
            }

            // Structured logging for abuse tracking
            console.warn('[acceptInvite] Validation failed', {
                event: validation.error.code,
                reason: validation.error.message,
                inviteId: invitation.id,
                inviteeUserId: user.id,
                inviterUserId: invitation.inviter_user_id,
                ts: new Date().toISOString()
            })
            return validation
        }

        // Atomic transaction with CAS (Compare-And-Swap) approach
        const result = await prisma.$transaction(async (tx) => {
            // 1. CAS: Update status ONLY IF it is still 'pending'
            const updateResult = await tx.friend_invitations.updateMany({
                where: {
                    id: invitation.id,
                    status: 'pending' // CAS condition
                },
                data: {
                    status: 'accepted',
                    accepted_at: new Date(),
                    invitee_user_id: user.id,
                },
            });

            if (updateResult.count === 0) {
                // Another request beat us to it
                throw new Error('CAS_FAILED');
            }

            // 2. Reward the inviter
            await tx.profiles.update({
                where: { id: invitation.inviter_user_id },
                data: { coins: { increment: INVITE_REWARD_COINS } },
            });

            // 3. Reward the invitee
            await tx.profiles.update({
                where: { id: user.id },
                data: { coins: { increment: INVITE_REWARD_COINS } },
            });

            return true;
        });

        return { ok: true, data: { alreadyAccepted: false } }
    } catch (error: any) {
        if (error.message === 'CAS_FAILED') {
            console.warn('[acceptInvite] Concurrency collision', { event: 'CAS_FAILED', inviteHash: inviteLink, ts: new Date().toISOString() });
            return { ok: false, error: { code: 'INVITE_ALREADY_CLAIMED', message: '邀请链接已被认领' } }
        }
        console.error('[acceptInvite] Error:', error)
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: error.message || '内部错误' } }
    }
}

// ─────────────────────────────────────────
// Action 3: Get User's Invitations
// ─────────────────────────────────────────

export interface SentInvitation {
    id: string
    inviteLink: string
    status: string
    createdAt: Date
    acceptedAt: Date | null
    invitee: { nickname: string | null; avatar_url: string | null } | null
}

/**
 * Returns all invitations sent by the currently logged-in user.
 */
export async function getMyInvitations(): Promise<ActionResult<SentInvitation[]>> {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: '未登录' } }

        const rows = await prisma.friend_invitations.findMany({
            where: { inviter_user_id: user.id },
            orderBy: { created_at: 'desc' },
            include: {
                invitee: {
                    select: { nickname: true, avatar_url: true },
                },
            },
        })

        const data: SentInvitation[] = rows.map((r: typeof rows[number]) => ({
            id: r.id,
            inviteLink: r.invite_link,
            status: r.status,
            createdAt: r.created_at,
            acceptedAt: r.accepted_at,
            invitee: r.invitee
                ? { nickname: r.invitee.nickname ?? null, avatar_url: r.invitee.avatar_url ?? null }
                : null,
        }))

        return { ok: true, data }
    } catch (error: any) {
        console.error('[getMyInvitations] Error:', error)
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: error.message || '内部错误' } }
    }
}
