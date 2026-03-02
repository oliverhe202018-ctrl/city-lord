import { ActionResult } from '../actions/user-invitations'

/**
 * Pure function: Check if an invitation is expired
 */
export function isInviteExpired(
    invitation: { expired_at: Date | null },
    now: Date = new Date()
): boolean {
    if (!invitation.expired_at) return false
    return invitation.expired_at < now
}

/**
 * Pure function: Validate if an invitation can be accepted by the current user
 */
export function canAcceptInvite(
    invitation: {
        status: string
        inviter_user_id: string
        expired_at: Date | null
    },
    currentUserId: string,
    now: Date = new Date()
): ActionResult<null> {
    if (invitation.inviter_user_id === currentUserId) {
        return { ok: false, error: { code: 'SELF_INVITE_NOT_ALLOWED', message: '不能接受自己的邀请' } }
    }
    if (invitation.status === 'accepted') {
        return { ok: false, error: { code: 'INVITE_ALREADY_CLAIMED', message: '邀请链接已被认领' } }
    }
    if (invitation.status === 'revoked' || invitation.status === 'rejected') {
        return { ok: false, error: { code: 'INVITE_REVOKED', message: '该邀请链接已失效' } }
    }
    if (isInviteExpired(invitation, now) || invitation.status === 'expired') {
        return { ok: false, error: { code: 'INVITE_EXPIRED', message: '邀请链接已过期（有效期 7 天）' } }
    }
    return { ok: true, data: null }
}
