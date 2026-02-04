-- 创建高性能统计函数
CREATE OR REPLACE FUNCTION get_faction_stats_rpc()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    -- 一次性统计各阵营人数，直接返回 JSON
    SELECT jsonb_object_agg(faction, count)
    INTO result
    FROM (
        SELECT faction, COUNT(*) as count
        FROM profiles
        WHERE faction IS NOT NULL
        GROUP BY faction
    ) t;

    -- 如果没有数据，返回空对象防止前端报错
    IF result IS NULL THEN
        result := '{}'::jsonb;
    END IF;

    RETURN result;
END;
$$;
