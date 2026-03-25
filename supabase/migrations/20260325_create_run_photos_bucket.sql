-- 1. Create 'run-photos' bucket if it doesn't exist
-- We set it to public so that photos can be easily viewed in the app without constant signing of URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('run-photos', 'run-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users to upload files to their own folder
-- Path structure: [userId]/[filename]
CREATE POLICY "Allow users to upload run photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'run-photos' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- 3. Allow public read access to all photos in the bucket
-- This is necessary since the bucket is public and we use publicUrl.
CREATE POLICY "Allow public to view run photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'run-photos');

-- 4. Allow users to delete their own run photos
CREATE POLICY "Allow users to delete their own run photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'run-photos' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- 5. Allow users to update their own photos (if needed for replacement)
CREATE POLICY "Allow users to update their own run photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'run-photos' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);
