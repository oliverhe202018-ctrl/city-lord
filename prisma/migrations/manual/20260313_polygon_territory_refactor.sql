-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE "public"."TerritoryType" AS ENUM ('NORMAL', 'HOT', 'COLD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."TerritoryStatus" AS ENUM ('ACTIVE', 'DESTROYED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."TerritoryEventType" AS ENUM ('CREATED', 'ATTACKED', 'DESTROYED', 'OWNER_CHANGED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Modify territories table
ALTER TABLE "public"."territories" 
    ADD COLUMN IF NOT EXISTS "geojson_json" JSONB,
    ADD COLUMN IF NOT EXISTS "max_hp" INTEGER NOT NULL DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS "current_hp" INTEGER NOT NULL DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS "territory_type" "public"."TerritoryType" NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN IF NOT EXISTS "score_weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

ALTER TABLE "public"."territories" RENAME COLUMN "status" TO "status_old";

ALTER TABLE "public"."territories"
    ADD COLUMN "status" "public"."TerritoryStatus" DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS "destroyed_at" TIMESTAMPTZ(6);

-- 3. Modify territory_events table
ALTER TABLE "public"."territory_events" RENAME COLUMN "event_type" TO "event_type_old";

ALTER TABLE "public"."territory_events"
    ADD COLUMN "event_type" "public"."TerritoryEventType" NOT NULL DEFAULT 'CREATED',
    ADD COLUMN IF NOT EXISTS "damage_value" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "before_hp" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "after_hp" INTEGER NOT NULL DEFAULT 0;

-- Optional: clean up old columns later after reset
-- ALTER TABLE "public"."territories" DROP COLUMN "status_old";
-- ALTER TABLE "public"."territory_events" DROP COLUMN "event_type_old";
