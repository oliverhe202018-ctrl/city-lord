-- 1. 禁用再启用 RLS，确保状态刷新
ALTER TABLE public.club_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- 2. 删除旧策略
DROP POLICY IF EXISTS "Allow authenticated users to view club members" ON public.club_members;
DROP POLICY IF EXISTS "Allow authenticated users to join clubs" ON public.club_members;
DROP POLICY IF EXISTS "Allow users to leave clubs" ON public.club_members;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.club_members;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.club_members;
DROP POLICY IF EXISTS "Enable delete for own membership" ON public.club_members;
DROP POLICY IF EXISTS "Users can apply" ON public.club_members;
DROP POLICY IF EXISTS "Club members are viewable by everyone" ON public.club_members;

-- 3. 创建最宽松的调试策略 (允许所有操作)
CREATE POLICY "Debug: Allow all for authenticated"
ON public.club_members
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. 显式授予权限 (防止 Role 权限缺失)
GRANT ALL ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;