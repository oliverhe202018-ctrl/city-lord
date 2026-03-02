-- Create friend_invitations table to track who invited whom for the social referral system
CREATE TABLE IF NOT EXISTS "public"."friend_invitations" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "inviter_user_id" UUID        NOT NULL,
  "invitee_user_id" UUID,
  "invite_link"     TEXT        NOT NULL,
  "status"          TEXT        NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "accepted_at"     TIMESTAMPTZ,

  CONSTRAINT "friend_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "friend_invitations_invite_link_key" UNIQUE ("invite_link"),
  CONSTRAINT "friend_invitations_inviter_fkey"
    FOREIGN KEY ("inviter_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "friend_invitations_invitee_fkey"
    FOREIGN KEY ("invitee_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_friend_invitations_inviter" ON "public"."friend_invitations"("inviter_user_id");
CREATE INDEX IF NOT EXISTS "idx_friend_invitations_link"    ON "public"."friend_invitations"("invite_link");
