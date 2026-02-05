-- 1. 确认表是否存在以及所有者
SELECT * FROM pg_tables WHERE schemaname = 'public' AND tablename = 'club_members';

-- 2. 确认列定义
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'club_members';

-- 3. 检查 RLS 是否开启
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE oid = 'public.club_members'::regclass;

-- 4. 再次强制重置 RLS (更加彻底)
ALTER TABLE public.club_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- 删除所有相关策略
DROP POLICY IF EXISTS "Allow authenticated users to view club members" ON public.club_members;
DROP POLICY IF EXISTS "Allow authenticated users to join clubs" ON public.club_members;
DROP POLICY IF EXISTS "Allow users to leave clubs" ON public.club_members;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.club_members;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.club_members;
DROP POLICY IF EXISTS "Enable delete for own membership" ON public.club_members;

-- 创建最宽松的策略用于调试 (之后可以收紧)
-- 允许所有认证用户进行所有操作
CREATE POLICY "Debug: Allow all for authenticated"
ON public.club_members
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 确保 authenticated 角色有表的使用权限
GRANT ALL ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;
