
-- 1. 确保存储桶存在
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 允许认证用户上传 (INSERT)
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

-- 3. 允许任何人读取 (SELECT) - 用于显示头像
CREATE POLICY "Allow public viewing"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'avatars' );
