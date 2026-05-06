-- ============================================================
-- Phase 2A: Territory 持久化 — 手动迁移脚本
--
-- 【强制执行顺序】
-- 1. 在 Supabase SQL Editor 中执行此脚本内容
-- 2. 在本地执行 Prisma migration baseline（确保使用 DIRECT_URL 直连）：
--    npx prisma migrate resolve --applied 20260313000000_territory_persistence
--    (如果不做这步，Prisma 会将数据库与 migrations 重复计算成 drift)
--
-- 【连接约束注意】
-- • Prisma CLI 使用 datasource 的 `directUrl`（项目当前可用的 Prisma CLI 专用连接）
-- • App 运行时：继续使用 pooled `DATABASE_URL`
-- • 严禁混用！
-- ============================================================

-- 1. 创建枚举类型 TerritorySource
DO $$ BEGIN
  CREATE TYPE "public"."TerritorySource" AS ENUM ('RUN', 'BACKFILL', 'SYSTEM', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. 为 territories 表新增列
ALTER TABLE "public"."territories"
  ADD COLUMN IF NOT EXISTS "area_m2_exact"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "source_type"      "public"."TerritorySource" NOT NULL DEFAULT 'RUN',
  ADD COLUMN IF NOT EXISTS "source_run_id"    UUID,
  ADD COLUMN IF NOT EXISTS "first_claimed_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_claimed_at"  TIMESTAMPTZ;

-- 3. 为 territory_events 表新增列
ALTER TABLE "public"."territory_events"
  ADD COLUMN IF NOT EXISTS "payload_json"  JSON,
  ADD COLUMN IF NOT EXISTS "source_run_id" UUID,
  ADD COLUMN IF NOT EXISTS "source_type"   "public"."TerritorySource";
