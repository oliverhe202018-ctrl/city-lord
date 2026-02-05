-- 1. 补全缺失字段
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allow_chat BOOLEAN DEFAULT true;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS icon_url TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. 修复存储桶权限 (Avatars)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public View Avatars" ON storage.objects;
CREATE POLICY "Public View Avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Auth Upload Avatars" ON storage.objects;
CREATE POLICY "Auth Upload Avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Auth Update Avatars" ON storage.objects;
CREATE POLICY "Auth Update Avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
