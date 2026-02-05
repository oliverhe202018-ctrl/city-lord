-- 1. 补全缺失的 avatar_url 字段 
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS avatar_url TEXT; 

-- 2. 再次刷新 Schema 缓存 (至关重要) 
NOTIFY pgrst, 'reload schema';
