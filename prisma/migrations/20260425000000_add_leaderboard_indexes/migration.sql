-- Add city tracking columns to profiles
ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "city_code" TEXT,
  ADD COLUMN IF NOT EXISTS "city_name" TEXT,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Create indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS "idx_profiles_city_code_area" ON "public"."profiles"("city_code", "total_area" DESC);
CREATE INDEX IF NOT EXISTS "idx_profiles_total_area" ON "public"."profiles"("total_area" DESC);
CREATE INDEX IF NOT EXISTS "idx_profiles_is_active" ON "public"."profiles"("is_active");
CREATE INDEX IF NOT EXISTS "idx_profiles_active_area" ON "public"."profiles"("is_active", "total_area" DESC);
