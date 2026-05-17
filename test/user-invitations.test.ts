import { describe, it, expect, vi } from 'vitest';
import { isInviteExpired, canAcceptInvite } from '../app/utils/invitations';

describe('User Invitations Logic', () => {

    describe('isInviteExpired', () => {
        it('should return false if expired_at is null', () => {
            expect(isInviteExpired({ expired_at: null })).toBe(false);
        });

        it('should return true if expired_at is in the past', () => {
            const now = new Date('2026-03-02T12:00:00Z');
            const past = new Date('2026-03-01T12:00:00Z');
            expect(isInviteExpired({ expired_at: past }, now)).toBe(true);
        });

        it('should return false if expired_at is in the future', () => {
            const now = new Date('2026-03-02T12:00:00Z');
            const future = new Date('2026-03-03T12:00:00Z');
            expect(isInviteExpired({ expired_at: future }, now)).toBe(false);
        });
    });

    describe('canAcceptInvite', () => {
        const now = new Date('2026-03-02T12:00:00Z');
        const future = new Date('2026-03-03T12:00:00Z');

        it('rejects self-invitation', () => {
            const invite = { status: 'pending', inviter_user_id: 'userA', expired_at: future };
            const result = canAcceptInvite(invite, 'userA', now);
            expect(result).toEqual({ ok: false, error: { code: 'SELF_INVITE_NOT_ALLOWED', message: '不能接受自己的邀请' } });
        });

        it('rejects already claimed invites', () => {
            const invite = { status: 'accepted', inviter_user_id: 'userA', expired_at: future };
            const result = canAcceptInvite(invite, 'userB', now);
            expect(result).toEqual({ ok: false, error: { code: 'INVITE_ALREADY_CLAIMED', message: '邀请链接已被认领' } });
        });

        it('rejects revoked invites', () => {
            const invite = { status: 'revoked', inviter_user_id: 'userA', expired_at: future };
            const result = canAcceptInvite(invite, 'userB', now);
            expect(result).toEqual({ ok: false, error: { code: 'INVITE_REVOKED', message: '该邀请链接已失效' } });
        });

        it('rejects expired invites', () => {
            const past = new Date('2026-03-01T12:00:00Z');
            const invite = { status: 'pending', inviter_user_id: 'userA', expired_at: past };
            const result = canAcceptInvite(invite, 'userB', now);
            expect(result).toEqual({ ok: false, error: { code: 'INVITE_EXPIRED', message: '邀请链接已过期（有效期 7 天）' } });
        });

        it('accepts valid invites', () => {
            const invite = { status: 'pending', inviter_user_id: 'userA', expired_at: future };
            const result = canAcceptInvite(invite, 'userB', now);
            expect(result).toEqual({ ok: true, data: null });
        });
    });

});
