-- 1. Enable PostGIS Extension
-- 必须先启用 PostGIS 才能使用 Geometry 类型和空间索引
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Modify territories table to support spatial optimization
-- 添加 geojson 字段用于存储几何数据（如果是 H3 索引，通常也会存储对应的多边形用于空间查询）
-- 添加 h3_index 字段（如果 id 已经是 h3_index，这里可能是为了显式索引或兼容性，或者 id 是 UUID）
-- 添加 status 字段用于部分索引
ALTER TABLE territories 
ADD COLUMN IF NOT EXISTS geojson GEOMETRY(Polygon, 4326),
ADD COLUMN IF NOT EXISTS h3_index TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 3. Create GiST Index on territories.geojson
-- 空间索引，加速 ST_Intersects, ST_Contains 等查询
CREATE INDEX IF NOT EXISTS idx_territories_geojson 
ON territories USING GIST (geojson);

-- 4. Create user_locations table and spatial index
-- 如果表不存在则创建（假设用于存储用户实时位置）
CREATE TABLE IF NOT EXISTS user_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为用户位置创建空间索引
CREATE INDEX IF NOT EXISTS idx_user_locations_location 
ON user_locations USING GIST (location);

-- 5. Create Partial Index on territories
-- 仅针对 status = 'active' 的记录索引 owner_id 和 h3_index
-- 优化查询活跃领地的性能
CREATE INDEX IF NOT EXISTS idx_territories_active_owner_h3 
ON territories (owner_id, h3_index) 
WHERE status = 'active';

-- 6. Create Materialized View for Territory Stats
-- 用于快速获取领地统计数据（如各阵营/俱乐部占领面积）
-- 避免对大表 territories 进行实时 count/sum
CREATE MATERIALIZED VIEW IF NOT EXISTS territory_stats AS
SELECT
    owner_id,
    COUNT(*) as territory_count,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
    NOW() as last_updated
FROM
    territories
GROUP BY
    owner_id;

-- 创建唯一索引以便并发刷新
CREATE UNIQUE INDEX IF NOT EXISTS idx_territory_stats_owner_id 
ON territory_stats (owner_id);

-- 7. Refresh Strategy (Function)
-- 创建一个函数用于刷新物化视图，可以由 pg_cron 或触发器调用
CREATE OR REPLACE FUNCTION refresh_territory_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY territory_stats;
END;
$$ LANGUAGE plpgsql;

-- 注意：pg_cron 需要在 Supabase Dashboard 的 Database -> Extensions 中启用
-- 并且需要在 pg_cron 表中添加作业。以下是 SQL 示例（如果 pg_cron 可用）：
-- SELECT cron.schedule(
--   'refresh_territory_stats_job', -- job name
--   '*/15 * * * *',                -- every 15 minutes
--   'SELECT refresh_territory_stats()'
-- );
