
-- 补全 rooms 表缺失字段
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS allow_chat BOOLEAN DEFAULT true;

-- 刷新 Schema Cache (Supabase 必须步骤)
NOTIFY pgrst, 'reload schema';
