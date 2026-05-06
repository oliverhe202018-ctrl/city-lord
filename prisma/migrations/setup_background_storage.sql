-- ============================================
-- Supabase Storage Setup for Background Assets
-- ============================================
-- Execute this in Supabase Dashboard → SQL Editor

-- Step 1: Create the public storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('background-assets', 'background-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create public read access policy
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'background-assets');

-- ============================================
-- NOTES:
-- ============================================
-- 1. This bucket is set to PUBLIC for read access
-- 2. Upload/Delete operations will be handled via Server Actions
--    using SUPABASE_SERVICE_ROLE_KEY (not RLS policies)
-- 3. Make sure your .env.local contains:
--    - NEXT_PUBLIC_SUPABASE_URL
--    - NEXT_PUBLIC_SUPABASE_ANON_KEY
--    - SUPABASE_SERVICE_ROLE_KEY (get from Supabase Dashboard → Settings → API)
