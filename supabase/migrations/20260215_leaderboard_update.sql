
-- 1. Create ProvinceStat table
CREATE TABLE IF NOT EXISTS "ProvinceStat" (
    "id" SERIAL PRIMARY KEY,
    "provinceName" TEXT NOT NULL UNIQUE,
    "totalTerritoryArea" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add province column to clubs if not exists
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "province" TEXT;

-- 3. Create index on clubs(province)
CREATE INDEX IF NOT EXISTS "idx_clubs_province" ON "clubs"("province");

-- 4. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
