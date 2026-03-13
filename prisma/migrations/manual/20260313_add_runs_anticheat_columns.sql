-- =============================================
-- 补齐 runs 表反作弊相关缺失列
-- 对应 prisma/schema.prisma L506-509
-- =============================================

ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS risk_level varchar(20) NOT NULL DEFAULT 'LOW';
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS cheat_flags json;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS client_distance double precision DEFAULT 0;
