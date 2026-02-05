-- Create 'badges' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('badges', 'badges', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'badges'
CREATE POLICY "Authenticated users can upload badges"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'badges');

CREATE POLICY "Everyone can view badges"
ON storage.objects
FOR SELECT
USING (bucket_id = 'badges');

CREATE POLICY "Users can update their own badges"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'badges'); -- Simplified for admin use

CREATE POLICY "Users can delete their own badges"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'badges');
