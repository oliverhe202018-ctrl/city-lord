-- Harden the friend_invitations table
-- 1. Add expired_at: invite links expire after 7 days by default
ALTER TABLE "public"."friend_invitations"
  ADD COLUMN IF NOT EXISTS "expired_at" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- 2. Add a unique constraint so the same invitee cannot claim two different links
--    and cannot claim the same link twice (combine with invite_link PK unique).
--    The key scenario: invitee_user_id + invite_link must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_friend_invitations_invitee_link"
  ON "public"."friend_invitations"("invite_link", "invitee_user_id");
