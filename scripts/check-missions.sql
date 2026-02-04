-- 诊断查询：检查任务表和用户任务表的状态

-- 1. 检查 missions 表是否有数据
SELECT 'missions 表记录数' as info, COUNT(*) as count FROM public.missions;

-- 2. 检查 missions 表的数据
SELECT * FROM public.missions ORDER BY frequency, id;

-- 3. 检查 user_missions 表的数据
SELECT 'user_missions 表记录数' as info, COUNT(*) as count FROM public.user_missions;

-- 4. 检查当前认证用户的任务 (需要替换 user_id)
-- SELECT * FROM public.user_missions WHERE user_id = 'YOUR_USER_ID_HERE';

-- 5. 检查 user_missions 表的约束
SELECT conname as constraint_name, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.user_missions'::regclass
  AND contype = 'c';

-- 6. 检查 RLS 策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'missions' OR tablename = 'user_missions'
ORDER BY tablename, policyname;

-- 7. 检查 auth.users 表中的用户数
SELECT 'auth.users 记录数' as info, COUNT(*) as count FROM auth.users;

-- 8. 检查 profiles 表中的用户数
SELECT 'profiles 表记录数' as info, COUNT(*) as count FROM public.profiles;
