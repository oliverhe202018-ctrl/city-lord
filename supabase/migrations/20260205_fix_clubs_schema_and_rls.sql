-- 1. Clubs Table RLS Policies
-- Enable RLS
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to create (INSERT) clubs
CREATE POLICY "Authenticated users can create clubs" 
ON public.clubs 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy: Allow everyone to view (SELECT) clubs
CREATE POLICY "Everyone can view clubs" 
ON public.clubs 
FOR SELECT 
USING (true);

-- Policy: Allow club owners to update their own clubs
CREATE POLICY "Club owners can update their own clubs" 
ON public.clubs 
FOR UPDATE 
USING (auth.uid() = owner_id);

-- 2. Storage Bucket Setup & Policies
-- Create 'club-avatars' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-avatars', 'club-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload (INSERT) avatars
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'club-avatars');

-- Policy: Allow everyone to view (SELECT) avatars
CREATE POLICY "Everyone can view avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'club-avatars');

-- Policy: Allow users to update/delete their own uploads (Optional but good practice)
CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'club-avatars' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
USING (bucket_id = 'club-avatars' AND auth.uid() = owner);
