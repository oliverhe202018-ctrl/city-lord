-- 1. Ensure voice-messages bucket is private
UPDATE storage.buckets
SET "public" = false
WHERE id = 'voice-messages';

-- 2. Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated uploads to voice_messages" ON storage.objects;
DROP POLICY IF EXISTS "Allow public viewing of voice_messages" ON storage.objects;

-- 3. Policy to allow uploads ONLY to private/senderId/...
CREATE POLICY "Allow sender to upload voice message"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-messages' AND
  (string_to_array(name, '/'))[1] = 'private' AND
  auth.uid()::text = (string_to_array(name, '/'))[2]
);

-- 4. Policy to allow sender OR receiver to view voice message
CREATE POLICY "Allow involved users to view voice message"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-messages' AND
  (string_to_array(name, '/'))[1] = 'private' AND
  (
    auth.uid()::text = (string_to_array(name, '/'))[2] OR
    auth.uid()::text = (string_to_array(name, '/'))[3]
  )
);

-- 5. Policy to allow sender to delete their orphan voice messages
CREATE POLICY "Allow sender to delete voice message"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-messages' AND
  (string_to_array(name, '/'))[1] = 'private' AND
  auth.uid()::text = (string_to_array(name, '/'))[2]
);
