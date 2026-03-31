-- H3 cleanup + territory appearance persistence

ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "fill_opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.35;

DROP INDEX IF EXISTS "public"."idx_territories_active_owner_h3";
DROP INDEX IF EXISTS "public"."idx_territories_active_owner";

ALTER TABLE "public"."territories"
  DROP CONSTRAINT IF EXISTS "territories_city_id_h3_index_key",
  DROP COLUMN IF EXISTS "h3_index",
  DROP COLUMN IF EXISTS "h3_resolution";

CREATE INDEX IF NOT EXISTS "idx_territories_active_owner"
  ON "public"."territories" ("owner_id")
  WHERE "status" = 'active';
