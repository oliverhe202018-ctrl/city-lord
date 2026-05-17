-- 为 territories 表的 geojson 列创建 GIST 空间索引
-- 使 ST_Intersects、ST_Contains、ST_DWithin 等空间查询走索引而非全表扫描

CREATE INDEX IF NOT EXISTS idx_territories_geojson_gist
ON territories USING GIST (geojson);
