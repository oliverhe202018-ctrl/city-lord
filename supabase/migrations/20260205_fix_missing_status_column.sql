-- 修复 club_members 表结构：添加缺失的 status 字段
ALTER TABLE public.club_members 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'active', 'rejected')) DEFAULT 'pending';

-- 确保其他关键字段也存在
ALTER TABLE public.club_members 
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- 恢复正常的 RLS 策略 (移除 Debug 策略)
DROP POLICY IF EXISTS "Debug: Allow all for authenticated" ON public.club_members;

-- 重新应用安全的 RLS 策略

-- 1. SELECT: 允许所有已登录用户查询该表
CREATE POLICY "Allow authenticated users to view club members"
ON public.club_members
FOR SELECT
TO authenticated
USING (true);

-- 2. INSERT: 允许已登录用户添加自己为成员
CREATE POLICY "Allow authenticated users to join clubs"
ON public.club_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. DELETE: 允许用户删除自己的记录（退出俱乐部）
CREATE POLICY "Allow users to leave clubs"
ON public.club_members
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. UPDATE: 允许管理员/会长更新成员状态 (用于审核)
CREATE POLICY "Club admins/owners can update member status" 
ON public.club_members 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_members admins 
    WHERE admins.club_id = club_members.club_id 
    AND admins.user_id = auth.uid() 
    AND admins.role IN ('owner', 'admin')
  )
);
