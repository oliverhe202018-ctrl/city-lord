-- Alter notifications table to add push_status column
ALTER TABLE "public"."notifications" ADD COLUMN IF NOT EXISTS "push_status" text DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS "idx_notifications_push_status" ON "public"."notifications"("push_status");
