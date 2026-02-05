-- 1. 彻底补全 room_participants 表 (解决当前的 role 报错) 
ALTER TABLE room_participants 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'; -- 关键修复: 角色 (owner/admin/member) 
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'; -- 预防性修复 

ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(); 

-- 2. 彻底补全 rooms 表 (防止还有漏网之鱼) 
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS avatar_url TEXT; 
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS icon_url TEXT; -- 以防代码里混用了两个名字 
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT; 
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS category TEXT; 
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 50; 
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'; 
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allow_chat BOOLEAN DEFAULT true; 
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allow_imports BOOLEAN DEFAULT true; 

-- 3. 补全 profiles 表 (以防显示成员列表时报错) 
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT; 
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT; 

-- 4. 强制刷新 Schema 缓存 (必须执行) 
NOTIFY pgrst, 'reload schema';
